(function(root){
'use strict';
const d=root.LinuxGymData;if(!d)return;
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
const mk=(slug,title,objective,example,concepts,difficulty=3,kind='Practice')=>({slug,title,description:`Practice ${title.toLowerCase()} in the same stateful Linux Gym environment.`,objective,example,checks:[{type:'command',label:`Run \`${example}\``,pattern:`^\\s*${esc(example)}\\s*$`,flags:'i'}],hints:[`Try: \`${example}\``],concepts,difficulty,kind});
const tr=(id,title,subtitle,rows)=>({id,title,subtitle,tasks:rows.map(r=>mk(...r))});
const added=[
tr('packages','Packages & Software','10 reps · apt, dpkg and repositories',[
['apt-update','Refresh package indexes','Refresh the local APT package index.','sudo apt update',['apt','repositories'],2],
['apt-search','Search packages','Search available packages for nginx.','apt search nginx',['apt','discovery'],2],
['apt-show','Inspect package metadata','Show package information for nginx.','apt show nginx',['apt','metadata'],2],
['apt-install','Install software','Install jq with APT.','sudo apt install -y jq',['apt','packages'],3],
['dpkg-list','List installed packages','List installed Debian packages.','dpkg -l',['dpkg','inventory'],2],
['dpkg-query','Query one package','Query the installed nginx package.','dpkg -s nginx',['dpkg','metadata'],3],
['apt-policy','Inspect candidate versions','Display nginx package policy and candidate version.','apt-cache policy nginx',['apt','versions'],3],
['apt-remove','Remove software','Remove jq without prompting.','sudo apt remove -y jq',['apt','lifecycle'],3],
['apt-clean','Clean package cache','Clear downloaded package cache.','sudo apt clean',['apt','maintenance'],3],
['repo-files','Inspect repository sources','List configured APT source files.','ls /etc/apt/sources.list.d',['repositories','filesystem'],3]
]),
tr('observability','Observability & Logs','10 reps · metrics, logs and diagnostics',[
['journal-errors','Filter service errors','Show nginx errors from the journal.','journalctl -u nginx -p err',['journalctl','logs'],3],
['journal-follow','Follow a service','Follow nginx journal output.','journalctl -u nginx -f',['journalctl','streaming'],3],
['dmesg-tail','Inspect kernel messages','Show the most recent kernel messages.','dmesg | tail',['kernel','logs'],3],
['uptime','Read load averages','Display uptime and load averages.','uptime',['load','uptime'],2],
['free','Inspect memory','Display memory usage in human-readable form.','free -h',['memory','metrics'],2],
['df','Inspect filesystem capacity','Display filesystem usage in human-readable form.','df -h',['disk','capacity'],2],
['du','Find directory size','Measure /var/log disk usage.','du -sh /var/log',['disk','du'],2],
['top','Inspect live processes','Take a batch snapshot with top.','top -b -n 1',['processes','metrics'],3],
['vmstat','Inspect VM pressure','Print one vmstat sample.','vmstat 1 1',['vmstat','performance'],3],
['iostat','Inspect IO','Display extended disk IO statistics.','iostat -xz 1 1',['iostat','performance'],4]
]),
tr('security','Security & Hardening','10 reps · crypto, firewall and audit',[
['sha256','Hash a file','Calculate the SHA-256 digest of notes.txt.','sha256sum notes.txt',['hashing','integrity'],2],
['openssl-rand','Generate entropy','Generate 16 random bytes as hex.','openssl rand -hex 16',['openssl','entropy'],3],
['openssl-cert','Inspect a certificate','Inspect a local X.509 certificate.','openssl x509 -in server.crt -text -noout',['tls','x509'],4],
['ss-listen','Audit listeners','List listening TCP/UDP sockets with process information.','ss -tulpn',['sockets','audit'],3],
['ufw-status','Inspect firewall','Display firewall status.','sudo ufw status',['firewall','ufw'],3],
['ufw-allow','Open a port','Allow TCP port 443 through UFW.','sudo ufw allow 443/tcp',['firewall','rules'],4],
['last','Audit logins','Show recent login sessions.','last',['audit','logins'],2],
['lastlog','Audit account login state','Show last-login information for accounts.','lastlog',['audit','accounts'],3],
['find-suid','Find SUID binaries','Search /usr/bin for SUID executables.','find /usr/bin -perm -4000',['permissions','suid'],4],
['passwd-status','Inspect password state','Show password status for student.','passwd -S student',['accounts','hardening'],3]
]),
tr('kubernetes','Kubernetes','10 reps · cluster operations',[
['kubectl-context','Inspect context','Show the current Kubernetes context.','kubectl config current-context',['kubernetes','context'],2],
['kubectl-nodes','Inspect nodes','List cluster nodes with extended details.','kubectl get nodes -o wide',['kubernetes','nodes'],2],
['kubectl-pods','Inspect pods','List pods in all namespaces.','kubectl get pods -A',['kubernetes','pods'],2],
['kubectl-describe','Diagnose a pod','Describe the api-7d9 pod.','kubectl describe pod api-7d9',['kubernetes','diagnostics'],3],
['kubectl-logs','Read workload logs','Read logs from the api-7d9 pod.','kubectl logs api-7d9',['kubernetes','logs'],3],
['kubectl-deploy','Create a deployment','Create an nginx deployment.','kubectl create deployment web --image=nginx:alpine',['kubernetes','deployment'],4],
['kubectl-scale','Scale a workload','Scale web to three replicas.','kubectl scale deployment web --replicas=3',['kubernetes','scaling'],4],
['kubectl-service','Expose a workload','Expose web internally on port 80.','kubectl expose deployment web --port=80',['kubernetes','service'],4],
['kubectl-rollout','Inspect rollout','Display rollout status for web.','kubectl rollout status deployment/web',['kubernetes','rollout'],4],
['kubectl-events','Inspect cluster events','List recent events ordered by creation time.','kubectl get events --sort-by=.metadata.creationTimestamp',['kubernetes','events'],4]
]),
tr('automation','Automation & Scheduling','10 reps · cron, JSON and shell automation',[
['crontab-list','Inspect schedules','List the current user crontab.','crontab -l',['cron','scheduling'],2],
['atq','Inspect queued jobs','List queued one-shot at jobs.','atq',['at','scheduling'],2],
['jq-field','Parse JSON','Extract the status field from health.json.','jq -r .status health.json',['jq','json'],3],
['jq-filter','Filter JSON arrays','Select healthy items from services.json.','jq -r ".[] | select(.healthy == true) | .name" services.json',['jq','json'],4],
['sed-replace','Transform text','Replace staging with production in config.env output.','sed "s/staging/production/g" config.env',['sed','text'],3],
['awk-field','Process columns','Print the first column of processes.tsv.','awk "{print $1}" processes.tsv',['awk','text'],3],
['xargs','Compose commands','Echo each item from hosts.txt through xargs.','cat hosts.txt | xargs -n1 echo',['xargs','pipelines'],3],
['envsubst','Render a template','Render app.conf.tpl using environment variables.','envsubst < app.conf.tpl',['templates','env'],4],
['shellcheck','Lint a script','Run ShellCheck against deploy.sh.','shellcheck deploy.sh',['bash','lint'],3],
['time-command','Measure a command','Measure the execution of sleep 1.','time sleep 1',['performance','timing'],2]
]),
tr('cicd','CI/CD & Release Engineering','10 reps · build, release and deployment flow',[
['make','Run a build target','Run the test target from the Makefile.','make test',['make','build'],3],
['git-tag','Create a release tag','Create annotated tag v1.2.0.','git tag -a v1.2.0 -m "release 1.2.0"',['git','release'],4],
['git-tags','Inspect releases','List repository tags.','git tag --list',['git','release'],2],
['docker-build','Build an image','Build app version 1.2.0 from the current directory.','docker build -t app:1.2.0 .',['docker','build'],4],
['docker-images','Inspect images','List local Docker images.','docker images',['docker','images'],2],
['docker-logs','Read container logs','Read logs for the web container.','docker logs web',['docker','logs'],3],
['compose-config','Validate Compose','Render and validate Docker Compose configuration.','docker compose config',['compose','validation'],4],
['compose-up','Start a stack','Start the Compose stack detached.','docker compose up -d',['compose','deployment'],4],
['compose-ps','Inspect a stack','Display Compose service state.','docker compose ps',['compose','operations'],3],
['release-exam','Release pipeline exam','Run tests, build the release image and inspect it.','make test && docker build -t app:1.2.0 . && docker images',['ci','docker','release'],5,'Exam']
])
];
const start=d.tracks.length;added.forEach((track,offset)=>{d.tracks.push(track);track.tasks.forEach((t,ri)=>d.tasks.push({...t,trackId:track.id,trackTitle:track.title,trackIndex:start+offset,taskIndex:ri,id:`${track.id}/${t.slug}`}));});
d.totalTasks=d.tasks.length;
})(typeof globalThis!=='undefined'?globalThis:window);