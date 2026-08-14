(function(root){
'use strict';
const Shell=root.LinuxGymShell&&root.LinuxGymShell.VirtualShell;if(!Shell)return;
const R=(output='',code=0,type='normal')=>({output:String(output),code,type});
const originalReset=Shell.prototype.reset;
Shell.prototype.reset=function(){const r=originalReset.call(this);this.packages=new Set(['bash','coreutils','nginx','openssh-client']);this.kube={context:'linux-gym',replicas:{web:1},deployments:{},services:{}};this.firewall=[];this._setNode('/etc/apt/sources.list.d',{type:'dir',mode:'755',owner:'root',group:'root'});this._setFile('/etc/apt/sources.list.d/ubuntu.sources','Types: deb\nURIs: http://archive.ubuntu.com/ubuntu\n','644','root','root');this._setFile('/home/student/health.json','{"status":"ok","latency_ms":18}\n','644');this._setFile('/home/student/services.json','[{"name":"api","healthy":true},{"name":"worker","healthy":false},{"name":"web","healthy":true}]\n','644');this._setFile('/home/student/config.env','APP_ENV=staging\nPORT=8080\n','644');this._setFile('/home/student/processes.tsv','nginx\t731\nnode\t4242\n','644');this._setFile('/home/student/hosts.txt','api.local\nweb.local\n','644');this._setFile('/home/student/app.conf.tpl','environment=$APP_ENV\n','644');this._setFile('/home/student/Makefile','test:\n\t@echo tests passed\n','644');this._setFile('/home/student/server.crt','-----BEGIN CERTIFICATE-----\nTRAINING\n-----END CERTIFICATE-----\n','644');return r;};
const original=Shell.prototype._dispatch;
Shell.prototype._dispatch=function(cmd,args,input,ctx){
  if(cmd==='sudo'){if(!args.length)return R('usage: sudo command',1,'error');return this._dispatch(args[0],args.slice(1),input,ctx);}
  if(cmd==='apt'||cmd==='apt-cache'){
    const action=args[0]||'';if(action==='update')return R('Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease\nReading package lists... Done');
    if(action==='search')return R('nginx/noble 1.24.0-2ubuntu7 amd64\n  small, powerful, scalable web/proxy server');
    if(action==='show')return R('Package: nginx\nVersion: 1.24.0-2ubuntu7\nPriority: optional\nSection: httpd');
    if(action==='install'){const p=args.filter(x=>!x.startsWith('-')).slice(1).pop();if(p)this.packages.add(p);return R(`Setting up ${p||'package'} ... Done`);}
    if(action==='remove'){const p=args.filter(x=>!x.startsWith('-')).slice(1).pop();if(p)this.packages.delete(p);return R(`Removing ${p||'package'} ... Done`);}
    if(action==='clean')return R('');
    if(action==='policy'||cmd==='apt-cache')return R('nginx:\n  Installed: 1.24.0-2ubuntu7\n  Candidate: 1.24.0-2ubuntu7');
  }
  if(cmd==='dpkg'){if(args[0]==='-l')return R([...this.packages].map(p=>`ii  ${p.padEnd(18)} 1.0  amd64  Linux Gym package`).join('\n'));if(args[0]==='-s')return R(`Package: ${args[1]||'nginx'}\nStatus: install ok installed\nArchitecture: amd64`);}
  if(cmd==='dmesg')return R('[    0.000000] Linux version 6.8.0-linux-gym\n[    1.103000] systemd[1]: Started Linux Gym\n[   42.000000] eth0: link up');
  if(cmd==='vmstat')return R('procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----\n r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st\n 1  0      0 512000  64000 384000    0    0     1     4  120  300  3  1 96  0  0');
  if(cmd==='iostat')return R('avg-cpu:  %user %system %iowait %idle\n           3.00    1.00    0.20 95.80\nDevice r/s rkB/s w/s wkB/s await %util\nnvme0n1 4.0 32.0 3.0 24.0 1.2 0.8');
  if(cmd==='sha256sum')return R('c8741f4d5b4f3d9dd9d9afae8b2ccf11a82f4fd57c34f9f4d865e7a9c9a3e742  '+(args[0]||''));
  if(cmd==='openssl'){if(args[0]==='rand')return R('4f8a9c7e53b12d0018f2ce7b6490aa31');if(args[0]==='x509')return R('Certificate:\n    Data:\n        Version: 3\n        Signature Algorithm: sha256WithRSAEncryption\n        Subject: CN = linux-gym.local');}
  if(cmd==='ufw'){if(args[0]==='status')return R(this.firewall.length?'Status: active\n'+this.firewall.join('\n'):'Status: inactive');if(args[0]==='allow'){this.firewall.push(`${args[1]} ALLOW Anywhere`);return R('Rule added');}}
  if(cmd==='last')return R('student  pts/0  10.0.0.10  Fri Aug 14 17:31   still logged in');
  if(cmd==='lastlog')return R('Username         Port     From             Latest\nstudent          pts/0    10.0.0.10       Fri Aug 14 17:31:00 +0200 2026');
  if(cmd==='passwd'&&args[0]==='-S')return R(`${args[1]||'student'} P 2026-08-01 0 99999 7 -1`);
  if(cmd==='kubectl'){
    const a=args.join(' ');
    if(a==='config current-context')return R(this.kube.context);
    if(/^get nodes/.test(a))return R('NAME         STATUS   ROLES           AGE   VERSION   INTERNAL-IP\ncontrol-01   Ready    control-plane   32d   v1.33.2   10.20.0.10\nworker-01    Ready    <none>          32d   v1.33.2   10.20.0.21');
    if(/^get pods -A/.test(a))return R('NAMESPACE   NAME          READY   STATUS    RESTARTS\ndefault     api-7d9       1/1     Running   0\nkube-system coredns-abc   1/1     Running   0');
    if(/^describe pod/.test(a))return R('Name: api-7d9\nNamespace: default\nStatus: Running\nContainers:\n  api:\n    Image: app:1.1.0');
    if(/^logs /.test(a))return R('2026-08-14T15:30:00Z INFO server started\n2026-08-14T15:30:01Z INFO health=ok');
    if(/^create deployment/.test(a)){this.kube.deployments.web={image:'nginx:alpine'};return R('deployment.apps/web created');}
    if(/^scale deployment web/.test(a)){this.kube.replicas.web=3;return R('deployment.apps/web scaled');}
    if(/^expose deployment web/.test(a)){this.kube.services.web={port:80};return R('service/web exposed');}
    if(/^rollout status/.test(a))return R('deployment "web" successfully rolled out');
    if(/^get events/.test(a))return R('LAST SEEN   TYPE     REASON      OBJECT                 MESSAGE\n12s         Normal   Scheduled   pod/web-5c8d            Successfully assigned default/web-5c8d');
  }
  if(cmd==='crontab'&&args[0]==='-l')return R('0 2 * * * /home/student/backup.sh');
  if(cmd==='atq')return R('12\tFri Aug 14 23:00:00 2026 a student');
  if(cmd==='jq'){
    const file=args[args.length-1],txt=this.readFile(file)||input||'';try{const j=JSON.parse(txt);if(args.join(' ').includes('.status'))return R(j.status||'');if(Array.isArray(j))return R(j.filter(x=>x.healthy).map(x=>x.name).join('\n'));}catch{}return R('jq: parse error',4,'error');
  }
  if(cmd==='sed'){const file=args[args.length-1],txt=this.readFile(file)||input||'';return R(txt.replace(/staging/g,'production').trimEnd());}
  if(cmd==='awk'){const file=args[args.length-1],txt=this.readFile(file)||input||'';return R(txt.trim().split('\n').map(l=>l.trim().split(/\s+/)[0]).join('\n'));}
  if(cmd==='xargs')return R((input||'').trim().split(/\s+/).join('\n'));
  if(cmd==='envsubst'){const txt=input||'';return R(txt.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g,(_,k)=>this.env[k]||''));}
  if(cmd==='shellcheck')return R('');
  if(cmd==='time')return R(`real\t0m1.001s\nuser\t0m0.001s\nsys\t0m0.000s`);
  if(cmd==='make')return R(args[0]==='test'?'tests passed':'Nothing to be done');
  if(cmd==='docker'&&args[0]==='build'){const tag=args[args.indexOf('-t')+1]||'app:latest';if(!this.docker.images.includes(tag))this.docker.images.push(tag);return R(`Successfully built 7fb2a1c4\nSuccessfully tagged ${tag}`);}
  if(cmd==='docker'&&args[0]==='images')return R('REPOSITORY   TAG       IMAGE ID       CREATED       SIZE\n'+this.docker.images.map((x,i)=>{const [r,t='latest']=x.split(':');return `${r.padEnd(12)} ${t.padEnd(9)} ${String(i+1).padStart(12,'0')}   1 minute ago   45MB`;}).join('\n'));
  if(cmd==='docker'&&args[0]==='logs')return R('2026-08-14T15:00:00Z nginx started\n2026-08-14T15:01:00Z GET /health 200');
  if(cmd==='docker'&&args[0]==='compose'){if(args[1]==='config')return R('services:\n  web:\n    image: nginx:alpine');if(args[1]==='up')return R('[+] Running 1/1\n ✔ Container linux-gym-web Started');if(args[1]==='ps')return R('NAME            IMAGE          COMMAND   SERVICE   STATUS\nlinux-gym-web   nginx:alpine   nginx     web       Up');}
  return original.call(this,cmd,args,input,ctx);
};
})(typeof globalThis!=='undefined'?globalThis:window);