const assert = require('node:assert/strict');

require('../data.js');
require('../shell.js');
require('../runtime-fixes.js');

const { tracks, tasks, totalTasks } = globalThis.LinuxGymData;
const { VirtualShell } = globalThis.LinuxGymShell;

assert.ok(Array.isArray(tracks) && tracks.length >= 13, 'expected 13+ learning tracks');
assert.ok(Array.isArray(tasks) && totalTasks >= 120, 'expected at least 120 missions');
assert.equal(new Set(tasks.map(t => t.id)).size, tasks.length, 'task ids must be unique');
for (const t of tasks) {
  assert.ok(t.id && t.title && t.objective && t.example, `invalid task metadata: ${t.id}`);
  assert.ok(Array.isArray(t.checks) && t.checks.length > 0, `task has no checks: ${t.id}`);
  assert.ok(t.difficulty >= 1 && t.difficulty <= 5, `invalid difficulty: ${t.id}`);
}

const sh = new VirtualShell();
function run(command, includes) {
  const r = sh.execute(command);
  assert.equal(r.code, 0, `${command} failed: ${r.output}`);
  if (includes) assert.match(r.output, includes, `${command} output mismatch`);
  return r;
}

run('help', /Linux Gym shell/);
run('pwd', /\/home\/student/);
run('mkdir -p projects/test/src');
assert.ok(sh.exists('/home/student/projects/test/src'));
run('echo ready > /tmp/ready.txt');
assert.equal(sh.readFile('/tmp/ready.txt').trim(), 'ready');
run('echo next >> /tmp/ready.txt');
assert.match(sh.readFile('/tmp/ready.txt'), /next/);
run('grep ERROR app.log | wc -l', /^2$/);
run('chmod 640 secrets.txt');
assert.equal(sh.mode('/home/student/secrets.txt'), '640');
run('sleep 30 &');
assert.ok(sh.hasProcess('sleep'));
run('pkill sleep');
assert.ok(!sh.hasProcess('sleep'));
run('ip route', /default via/);
run('curl -s https://api.local/health | grep ok', /status/);
run('export APP_ENV=staging');
run('echo $APP_ENV', /staging/);
run('git init');
run('git add README.md');
run('git commit -m "initial"', /initial/);
run('git branch feature/auth');
run('git switch feature/auth', /feature\/auth/);
assert.equal(sh.git.branch, 'feature/auth');
run('docker pull nginx:alpine');
run('docker run -d --name web -p 8080:80 nginx:alpine');
assert.equal(sh.dockerContainer('web').status, 'running');
run('docker stop web');
assert.equal(sh.dockerContainer('web').status, 'stopped');
run('docker rm web');
assert.equal(sh.dockerContainer('web'), null);
run('ssh-keygen -t ed25519');
assert.ok(sh.exists('/home/student/.ssh/id_ed25519'));
run('chmod 600 ~/.ssh/id_ed25519');
assert.equal(sh.mode('/home/student/.ssh/id_ed25519'), '600');
run('systemctl restart nginx');
assert.equal(sh.services.nginx.status, 'active');
run('tar -czf logs.tgz /var/log/nginx');
assert.ok(sh.exists('/home/student/logs.tgz'));
run('echo status > status.txt');
run('gzip status.txt');
assert.ok(sh.exists('/home/student/status.txt.gz'));
run('false || echo recovered', /recovered/);

console.log(`Linux Gym self-test passed: ${totalTasks} missions across ${tracks.length} tracks.`);
