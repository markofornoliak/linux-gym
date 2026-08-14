const assert = require('node:assert/strict');

require('../data.js');
require('../data-ext.js');
require('../shell.js');
require('../shell-ext.js');
require('../shell-v3-fixes.js');
require('../runtime-fixes.js');

const { tracks, tasks, totalTasks } = globalThis.LinuxGymData;
const { VirtualShell } = globalThis.LinuxGymShell;

assert.ok(Array.isArray(tracks) && tracks.length >= 19, 'expected 19+ learning tracks');
assert.ok(Array.isArray(tasks) && totalTasks >= 184, 'expected at least 184 missions');
assert.equal(new Set(tasks.map(t => t.id)).size, tasks.length, 'task ids must be unique');
for (const t of tasks) {
  assert.ok(t.id && t.title && t.objective && t.example, `invalid task metadata: ${t.id}`);
  assert.ok(Array.isArray(t.checks) && t.checks.length > 0, `task has no checks: ${t.id}`);
  assert.ok(t.difficulty >= 1 && t.difficulty <= 5, `invalid difficulty: ${t.id}`);
  for (const check of t.checks.filter(c => c.type === 'command')) {
    const regex = new RegExp(check.pattern, check.flags || 'i');
    assert.ok(regex.test(t.example), `canonical example does not satisfy command check: ${t.id} :: ${check.pattern} :: ${t.example}`);
  }
}

function stateCheck(shell, check, lastCommand, lastResult, historyStart) {
  switch (check.type) {
    case 'command': return lastResult.code === 0 && new RegExp(check.pattern, check.flags || 'i').test(lastCommand);
    case 'history': return new RegExp(check.pattern, check.flags || 'i').test(shell.history.slice(historyStart).join('\n'));
    case 'cwd': return shell.cwd === check.value;
    case 'exists': return shell.exists(check.value);
    case 'missing': return !shell.exists(check.value);
    case 'fileContains': return (shell.readFile(check.value) || '').includes(check.contains || '');
    case 'mode': return shell.mode(check.value) === check.mode;
    case 'owner': return shell.owner(check.value) === check.owner;
    case 'executable': return shell.isExecutable(check.value);
    case 'process': return shell.hasProcess(check.value);
    case 'processMissing': return !shell.processByPid(check.value);
    case 'processNameMissing': return !shell.hasProcess(check.value);
    case 'env': return shell.env[check.value] === check.equals;
    case 'git': return shell.git[check.value] === check.equals;
    case 'gitStaged': return shell.git.staged.includes(check.value);
    case 'gitCommits': return shell.git.commits.length >= (check.min || check.value || 1);
    case 'gitBranchExists': return shell.git.branches.includes(check.value);
    case 'gitBranch': return shell.git.branch === check.value;
    case 'gitRemote': return Boolean(shell.git.remotes[check.value]);
    case 'gitStash': return shell.git.stash >= (check.min || 1);
    case 'dockerImage': return shell.hasDockerImage(check.value);
    case 'dockerContainer': { const c = shell.dockerContainer(check.value); return Boolean(c) && (!check.status || c.status === check.status) && (!check.port || c.port === check.port); }
    case 'dockerContainerMissing': return !shell.dockerContainer(check.value);
    case 'service': return shell.services[check.value]?.status === check.status;
    case 'serviceEnabled': return Boolean(shell.services[check.value]?.enabled);
    default: throw new Error(`unknown check type ${check.type}`);
  }
}

for (const track of tracks) {
  const curriculumShell = new VirtualShell();
  for (const rawTask of track.tasks) {
    const mission = tasks.find(t => t.id === `${track.id}/${rawTask.slug}`);
    const historyStart = curriculumShell.history.length;
    const response = curriculumShell.execute(mission.example);
    assert.equal(response.code, 0, `mission example failed: ${mission.id} :: ${mission.example} :: ${response.output}`);
    for (const check of mission.checks) assert.ok(stateCheck(curriculumShell, check, mission.example, response, historyStart), `mission did not reach target state: ${mission.id} :: ${check.type} :: ${check.label}`);
  }
}

const sh = new VirtualShell();
function run(command, includes) { const r = sh.execute(command); assert.equal(r.code, 0, `${command} failed: ${r.output}`); if (includes) assert.match(r.output, includes); return r; }
run('help', /Linux Gym shell/);
run('pwd', /\/home\/student/);
run('grep ERROR app.log | wc -l', /^2$/);
run('sudo apt update', /Reading package lists/);
run('sudo apt install -y jq', /Setting up jq/);
run('kubectl get nodes -o wide', /control-01/);
run('jq -r .status health.json', /ok/);
run('openssl rand -hex 16', /^[0-9a-f]{32}$/);
run('vmstat 1 1', /memory/);
run('find /usr/bin -perm -4000', /passwd/);
run('git tag -a v1.2.0 -m "release 1.2.0"');
run('git tag --list', /v1.2.0/);
run('docker build -t app:1.2.0 .', /Successfully tagged/);
run('docker compose config', /services:/);

console.log(`Linux Gym self-test passed: ${totalTasks} missions across ${tracks.length} tracks, including full curriculum execution.`);