(function(root){
'use strict';

const COMMANDS=['alias','bash','cat','cd','chmod','chown','clear','cp','curl','cut','date','df','dig','docker','du','echo','env','export','false','find','free','git','grep','groups','head','help','history','hostname','id','ip','jobs','journalctl','kill','ls','mkdir','mv','pgrep','ping','pkill','printf','ps','pwd','rm','rmdir','scp','sleep','sort','ss','ssh','ssh-keygen','stat','systemctl','tail','tar','top','touch','tr','true','umask','unalias','uname','uniq','unset','uptime','wc','which','whoami'];

const clone=o=>JSON.parse(JSON.stringify(o));
const result=(output='',code=0,type='normal')=>({output:String(output??''),code,type});

class VirtualShell{
  constructor(){this.reset();}

  reset(){
    this.cwd='/home/student';
    this.env={USER:'student',HOME:'/home/student',SHELL:'/bin/bash',PATH:'/usr/local/bin:/usr/bin:/bin',EDITOR:'nano',APP_ENV:'development'};
    this.aliases={};
    this.history=[];
    this.commandCounter=0;
    this.nextPid=5100;
    this.umaskValue='0022';
    this.fs=new Map();
    this.processes=[
      {pid:1,user:'root',cpu:'0.0',mem:'0.1',cmd:'systemd',status:'S'},
      {pid:731,user:'root',cpu:'0.0',mem:'0.2',cmd:'nginx: master process',name:'nginx',status:'S'},
      {pid:742,user:'www-data',cpu:'0.1',mem:'0.4',cmd:'nginx: worker process',name:'nginx',status:'S'},
      {pid:4242,user:'student',cpu:'0.2',mem:'1.1',cmd:'node worker.js',name:'node',status:'S'}
    ];
    this.jobsList=[];
    this.git={initialized:false,branch:'main',branches:['main'],staged:[],commits:[],remotes:{},stash:0,dirty:['README.md']};
    this.docker={images:['alpine:3.20'],containers:{}};
    this.services={nginx:{status:'active',enabled:false},ssh:{status:'active',enabled:true},docker:{status:'active',enabled:true}};
    this.remoteCopies=[];
    this._seedFilesystem();
    return this;
  }

  _seedFilesystem(){
    ['/','/bin','/etc','/etc/nginx','/etc/ssh','/home','/home/student','/home/student/.ssh','/home/student/projects','/tmp','/var','/var/log','/var/log/nginx','/srv','/srv/app'].forEach(p=>this._setNode(p,{type:'dir',mode:'755',owner:p.startsWith('/home/student')?'student':'root',group:p.startsWith('/home/student')?'student':'root'}));
    this._setFile('/home/student/README.md','# Linux Gym Lab\nPractice safely.\n','644');
    this._setFile('/home/student/notes.txt','shell notes\npermissions notes\nnetwork notes\n','644');
    this._setFile('/home/student/inventory.txt','api\nworker\nweb\napi\ncache\nweb\n','644');
    this._setFile('/home/student/users.csv','name,role\nalice,admin\nbob,developer\ncarol,operator\n','644');
    this._setFile('/home/student/app.log','INFO boot complete\nWARN cache warmup\nERROR database timeout\nINFO retrying\nerror transient TIMEOUT\nERROR upstream unavailable\nINFO recovered\n','644');
    this._setFile('/home/student/deploy.sh','#!/bin/bash\necho existing-deploy\n','644');
    this._setFile('/home/student/secrets.txt','API_TOKEN=training-only\n','600');
    this._setFile('/home/student/status.txt','ready\n','644');
    this._setFile('/var/log/syslog','Aug 14 kernel: lab booted\nAug 14 systemd: Started nginx\n','644','root','adm');
    this._setFile('/var/log/nginx/access.log','10.0.0.5 - GET / 200\n10.0.0.6 - GET /health 200\n','644','root','adm');
    this._setFile('/var/log/nginx/error.log','2026/08/14 notice worker started\n2026/08/14 error upstream failed: connection refused\n2026/08/14 error request failed while connecting to upstream\n','640','root','adm');
    this._setFile('/etc/hosts','127.0.0.1 localhost\n10.10.0.20 app.internal\n','644','root','root');
    this._setFile('/etc/passwd','root:x:0:0:root:/root:/bin/bash\nstudent:x:1000:1000:Student:/home/student:/bin/bash\n','644','root','root');
    this._setFile('/etc/nginx/nginx.conf','events {}\nhttp { server { listen 80; } }\n','644','root','root');
    this._setFile('/etc/ssh/sshd_config','Port 22\nPasswordAuthentication no\n','644','root','root');
  }

  _setNode(path,node){this.fs.set(this.normalizePath(path),{...node});}
  _setFile(path,content='',mode='644',owner='student',group='student'){this._setNode(path,{type:'file',content:String(content),mode,owner,group});}
  normalizePath(path,base=this.cwd){
    if(path==null||path==='')return base;
    let p=String(path).replace(/^~(?=\/|$)/,this.env.HOME);
    if(!p.startsWith('/'))p=(base==='/'?'':base)+'/'+p;
    const parts=[];
    for(const seg of p.split('/')){if(!seg||seg==='.')continue;if(seg==='..')parts.pop();else parts.push(seg);}
    return '/'+parts.join('/');
  }
  displayPath(path=this.cwd){const p=this.normalizePath(path);return p===this.env.HOME?'~':p.startsWith(this.env.HOME+'/')?'~'+p.slice(this.env.HOME.length):p;}
  node(path){return this.fs.get(this.normalizePath(path));}
  exists(path){return this.fs.has(this.normalizePath(path));}
  readFile(path){const n=this.node(path);return n&&n.type==='file'?n.content:null;}
  mode(path){const n=this.node(path);return n?.mode||null;}
  owner(path){const n=this.node(path);return n?.owner||null;}
  isExecutable(path){const n=this.node(path);if(!n||n.type!=='file')return false;const m=n.mode||'000';return ['1','3','5','7'].includes(m[2])||['1','3','5','7'].includes(m[1])||['1','3','5','7'].includes(m[0]);}
  hasProcess(name){name=String(name).toLowerCase();return this.processes.some(p=>(p.name||p.cmd).toLowerCase().includes(name));}
  processByPid(pid){return this.processes.find(p=>String(p.pid)===String(pid));}
  hasDockerImage(name){return this.docker.images.includes(name);}
  dockerContainer(name){return this.docker.containers[name]||null;}

  _mkdir(path,parents=false){
    const p=this.normalizePath(path);if(this.exists(p))return false;
    const parent=p.slice(0,p.lastIndexOf('/'))||'/';
    if(!this.exists(parent)){if(!parents)return false;this._mkdir(parent,true);}
    this._setNode(p,{type:'dir',mode:'755',owner:'student',group:'student'});return true;
  }
  _write(path,content,append=false){
    const p=this.normalizePath(path);const parent=p.slice(0,p.lastIndexOf('/'))||'/';
    if(!this.exists(parent))return false;
    const old=this.node(p);const next=append&&old?.type==='file'?old.content+content:content;
    this._setFile(p,next,old?.mode||'644',old?.owner||'student',old?.group||'student');
    if(this.git.initialized&&!this.git.dirty.includes(this._gitRel(p)))this.git.dirty.push(this._gitRel(p));
    return true;
  }
  _remove(path,recursive=false){
    const p=this.normalizePath(path),n=this.node(p);if(!n)return false;
    if(n.type==='dir'){
      const children=[...this.fs.keys()].filter(k=>k.startsWith(p+'/'));
      if(children.length&&!recursive)return false;
      children.forEach(k=>this.fs.delete(k));
    }
    this.fs.delete(p);return true;
  }
  _children(path){
    const p=this.normalizePath(path);const prefix=p==='/'?'/':p+'/';
    return [...this.fs.keys()].filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length)).filter(x=>x&&!x.includes('/')).sort();
  }
  _gitRel(path){const p=this.normalizePath(path);return p.startsWith(this.cwd+'/')?p.slice(this.cwd.length+1):p.split('/').pop();}

  tokenize(input){
    const out=[];let cur='',quote=null,escape=false;
    for(let i=0;i<input.length;i++){
      const ch=input[i];
      if(escape){cur+=ch;escape=false;continue;}
      if(ch==='\\'&&quote!=="'"){escape=true;continue;}
      if(quote){if(ch===quote){quote=null;}else cur+=ch;continue;}
      if(ch==='"'||ch==="'"){quote=ch;continue;}
      if(/\s/.test(ch)){if(cur!==''){out.push(cur);cur='';}continue;}
      cur+=ch;
    }
    if(cur!=='')out.push(cur);return out;
  }

  _splitOperators(input){
    const parts=[];let cur='',quote=null,escape=false;
    for(let i=0;i<input.length;i++){
      const ch=input[i],next=input[i+1];
      if(escape){cur+=ch;escape=false;continue;}
      if(ch==='\\'&&quote!=="'"){cur+=ch;escape=true;continue;}
      if(quote){cur+=ch;if(ch===quote)quote=null;continue;}
      if(ch==='"'||ch==="'"){quote=ch;cur+=ch;continue;}
      if(ch==='&'&&next==='&'){parts.push({cmd:cur.trim(),op:'&&'});cur='';i++;continue;}
      if(ch==='|'&&next==='|'){parts.push({cmd:cur.trim(),op:'||'});cur='';i++;continue;}
      if(ch===';'){parts.push({cmd:cur.trim(),op:';'});cur='';continue;}
      cur+=ch;
    }
    parts.push({cmd:cur.trim(),op:null});return parts.filter(p=>p.cmd);
  }
  _splitPipes(input){
    const parts=[];let cur='',quote=null,escape=false;
    for(let i=0;i<input.length;i++){
      const ch=input[i],next=input[i+1];
      if(escape){cur+=ch;escape=false;continue;}
      if(ch==='\\'&&quote!=="'"){cur+=ch;escape=true;continue;}
      if(quote){cur+=ch;if(ch===quote)quote=null;continue;}
      if(ch==='"'||ch==="'"){quote=ch;cur+=ch;continue;}
      if(ch==='|'&&next!=='|'){parts.push(cur.trim());cur='';continue;}
      cur+=ch;
    }
    parts.push(cur.trim());return parts.filter(Boolean);
  }

  _expand(text){
    let s=String(text);
    s=s.replace(/\$\(([^()]+)\)/g,(_,cmd)=>this._executeLine(cmd,false).output.trim());
    s=s.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,(_,a,b)=>this.env[a||b]??'');
    return s;
  }

  execute(input){
    const raw=String(input??'').trim();if(!raw)return result('');
    this.history.push(raw);this.commandCounter++;
    return this._executeLine(raw,true);
  }
  _executeLine(raw,record){
    const parts=this._splitOperators(raw);let last=result(''),outputs=[];
    for(let i=0;i<parts.length;i++){
      const prevOp=i===0?null:parts[i-1].op;
      if(prevOp==='&&'&&last.code!==0)continue;
      if(prevOp==='||'&&last.code===0)continue;
      last=this._executePipeline(parts[i].cmd);
      if(last.output)outputs.push(last.output);
    }
    return result(outputs.join('\n'),last.code,last.type);
  }
  _executePipeline(raw){
    const pipes=this._splitPipes(raw);let input='';let last=result('');
    for(const part of pipes){last=this._executeCommand(part,input);input=last.output;if(last.code!==0&&pipes.length===1)break;}
    return last;
  }
  _executeCommand(raw,input=''){
    let command=raw.trim();let background=false;
    if(/\s&\s*$/.test(command)){background=true;command=command.replace(/\s&\s*$/,'').trim();}
    let redirect=null;
    const red=command.match(/\s(>>|>)\s*([^\s]+)\s*$/);
    if(red){redirect={append:red[1]==='>>',path:red[2]};command=command.slice(0,red.index).trim();}
    const firstToken=this.tokenize(command)[0];
    if(firstToken&&this.aliases[firstToken])command=this.aliases[firstToken]+command.slice(firstToken.length);
    command=this._expand(command);
    const args=this.tokenize(command);if(!args.length)return result('');
    const cmd=args.shift();
    let r=this._dispatch(cmd,args,input,{background,raw:command});
    if(redirect&&r.code===0){
      const ok=this._write(redirect.path,r.output+(r.output&&!r.output.endsWith('\n')?'\n':''),redirect.append);
      if(!ok)return result(`bash: ${redirect.path}: No such directory`,1,'error');
      r=result('',0);
    }
    return r;
  }

  _dispatch(cmd,args,input,ctx){
    if(cmd.startsWith('./')||cmd.startsWith('/')){
      const p=this.normalizePath(cmd);if(this.exists(p)&&this.node(p).type==='file')return this._runScript(p,args); 
    }
    const fn=this['_cmd_'+cmd.replace(/-/g,'_')];
    if(typeof fn!=='function')return result(`bash: ${cmd}: command not found`,127,'error');
    try{return fn.call(this,args,input,ctx)||result('');}catch(e){return result(`${cmd}: ${e.message}`,1,'error');}
  }

  _cmd_help(){return result('Linux Gym shell\n\nCore: pwd ls cd mkdir touch cp mv rm find cat echo\nText: grep head tail wc sort uniq cut tr\nSystem: chmod chown stat ps pgrep kill jobs ip ss curl dig\nDev: git docker ssh scp systemctl journalctl tar gzip\nShell: export env alias history which help\n\nPipes, >, >>, &&, ||, ;, variables and command substitution are supported.','0','info');}
  _cmd_clear(){return result('__CLEAR__');}
  _cmd_pwd(){return result(this.cwd);}
  _cmd_cd(args){const p=this.normalizePath(args[0]||this.env.HOME),n=this.node(p);if(!n)return result(`cd: ${args[0]||''}: No such file or directory`,1,'error');if(n.type!=='dir')return result(`cd: ${args[0]}: Not a directory`,1,'error');this.cwd=p;return result('');}
  _cmd_ls(args){
    let long=false,all=false;const paths=[];
    args.forEach(a=>{if(a.startsWith('-')){if(a.includes('l'))long=true;if(a.includes('a'))all=true;}else paths.push(a);});
    const target=this.normalizePath(paths[0]||'.'),n=this.node(target);if(!n)return result(`ls: cannot access '${paths[0]||'.'}': No such file or directory`,2,'error');
    const names=n.type==='dir'?this._children(target):[target.split('/').pop()];
    const shown=all&&n.type==='dir'?['.','..',...names]:names.filter(x=>all||!x.startsWith('.'));
    if(!long)return result(shown.join('  '));
    const lines=shown.map(name=>{
      if(name==='.'||name==='..')return `drwxr-xr-x 2 student student 4096 Aug 14 10:00 ${name}`;
      const p=n.type==='dir'?this.normalizePath(name,target):target,nn=this.node(p);return `${this._modeString(nn)} 1 ${nn.owner||'student'} ${nn.group||'student'} ${nn.type==='file'?String(nn.content.length).padStart(4):'4096'} Aug 14 10:00 ${name}`;
    });return result(lines.join('\n'));
  }
  _modeString(n){if(!n)return '----------';const d=n.type==='dir'?'d':'-';const m=String(n.mode||'644').padStart(3,'0');const bits={0:'---',1:'--x',2:'-w-',3:'-wx',4:'r--',5:'r-x',6:'rw-',7:'rwx'};return d+bits[m[0]]+bits[m[1]]+bits[m[2]];}
  _cmd_mkdir(args){const parents=args.includes('-p');const paths=args.filter(a=>!a.startsWith('-'));if(!paths.length)return result('mkdir: missing operand',1,'error');for(const p of paths){if(this.exists(p)&&!parents)return result(`mkdir: cannot create directory '${p}': File exists`,1,'error');if(!this.exists(p)&&!this._mkdir(p,parents))return result(`mkdir: cannot create directory '${p}': No such file or directory`,1,'error');}return result('');}
  _cmd_touch(args){if(!args.length)return result('touch: missing file operand',1,'error');for(const p of args){const full=this.normalizePath(p);if(!this.exists(full)){if(!this._write(full,''))return result(`touch: cannot touch '${p}': No such file or directory`,1,'error');}}return result('');}
  _cmd_cat(args,input){if(!args.length)return result(input);let out=[];for(const p of args){const n=this.node(p);if(!n)return result(`cat: ${p}: No such file or directory`,1,'error');if(n.type!=='file')return result(`cat: ${p}: Is a directory`,1,'error');out.push(n.content.replace(/\n$/,''));}return result(out.join('\n'));}
  _cmd_echo(args){return result(args.join(' '));}
  _cmd_printf(args){return result(args.join(' ').replace(/\\n/g,'\n'));}
  _cmd_cp(args){const clean=args.filter(a=>!a.startsWith('-'));if(clean.length<2)return result('cp: missing destination file operand',1,'error');const src=this.node(clean[0]);if(!src)return result(`cp: cannot stat '${clean[0]}': No such file or directory`,1,'error');if(src.type!=='file')return result('cp: directory copy requires -r in this lab',1,'error');const dst=this.normalizePath(clean[1]);this._setFile(dst,src.content,src.mode,src.owner,src.group);return result('');}
  _cmd_mv(args){if(args.length<2)return result('mv: missing destination file operand',1,'error');const src=this.normalizePath(args[0]),n=this.node(src);if(!n)return result(`mv: cannot stat '${args[0]}': No such file or directory`,1,'error');const dst=this.normalizePath(args[1]);this.fs.set(dst,n);this.fs.delete(src);return result('');}
  _cmd_rm(args){const recursive=args.some(a=>a==='-r'||a==='-rf'||a==='-fr');const paths=args.filter(a=>!a.startsWith('-'));if(!paths.length)return result('rm: missing operand',1,'error');for(const p of paths){if(!this.exists(p))return result(`rm: cannot remove '${p}': No such file or directory`,1,'error');if(!this._remove(p,recursive))return result(`rm: cannot remove '${p}': Is a directory`,1,'error');}return result('');}
  _cmd_rmdir(args){if(!args.length)return result('rmdir: missing operand',1,'error');for(const p of args){const n=this.node(p);if(!n||n.type!=='dir')return result(`rmdir: failed to remove '${p}'`,1,'error');if(this._children(p).length)return result(`rmdir: failed to remove '${p}': Directory not empty`,1,'error');this.fs.delete(this.normalizePath(p));}return result('');}
  _cmd_find(args){const start=args[0]||'.';let name=null;const i=args.indexOf('-name');if(i>=0)name=args[i+1];const base=this.normalizePath(start);if(!this.exists(base))return result(`find: '${start}': No such file or directory`,1,'error');let keys=[...this.fs.keys()].filter(k=>k===base||k.startsWith(base+'/'));if(name){const regex=new RegExp('^'+name.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')+'$');keys=keys.filter(k=>regex.test(k.split('/').pop()));}return result(keys.map(k=>base===this.cwd&&k.startsWith(this.cwd)?'.'+k.slice(this.cwd.length):k).join('\n'));}

  _source(args,input){if(input!==''&&input!=null)return String(input);const p=args[args.length-1];const n=p?this.node(p):null;return n?.type==='file'?n.content:'';}
  _cmd_grep(args,input){let insensitive=false,lineNumbers=false;const clean=[];for(const a of args){if(a==='-i')insensitive=true;else if(a==='-n')lineNumbers=true;else if(a.startsWith('-')&&a!=='-'){}else clean.push(a);}if(!clean.length)return result('grep: missing pattern',2,'error');const pattern=clean.shift();let src=input!==''?String(input):'';if(!src&&clean[0]){const n=this.node(clean[0]);if(!n)return result(`grep: ${clean[0]}: No such file or directory`,2,'error');src=n.content;}let re;try{re=new RegExp(pattern,insensitive?'i':'');}catch{re={test:x=>(insensitive?x.toLowerCase():x).includes(insensitive?pattern.toLowerCase():pattern)};}const lines=src.replace(/\n$/,'').split('\n');const found=[];lines.forEach((l,i)=>{if(re.test(l))found.push((lineNumbers?`${i+1}:`:'')+l);});return result(found.join('\n'),found.length?0:1);}
  _cmd_head(args,input){let n=10,file=null;for(let i=0;i<args.length;i++){if(args[i]==='-n'){n=Number(args[++i]||10);}else if(/^-[0-9]+$/.test(args[i]))n=Number(args[i].slice(1));else file=args[i];}const src=input!==''?String(input):(this.readFile(file)||'');if(file&&!this.exists(file))return result(`head: cannot open '${file}'`,1,'error');return result(src.replace(/\n$/,'').split('\n').slice(0,n).join('\n'));}
  _cmd_tail(args,input){let n=10,file=null;for(let i=0;i<args.length;i++){if(args[i]==='-n'){n=Number(args[++i]||10);}else if(/^-[0-9]+$/.test(args[i]))n=Number(args[i].slice(1));else file=args[i];}const src=input!==''?String(input):(this.readFile(file)||'');if(file&&!this.exists(file))return result(`tail: cannot open '${file}'`,1,'error');return result(src.replace(/\n$/,'').split('\n').slice(-n).join('\n'));}
  _cmd_wc(args,input){const linesFlag=args.includes('-l'),wordsFlag=args.includes('-w'),bytesFlag=args.includes('-c');const files=args.filter(a=>!a.startsWith('-'));const src=input!==''?String(input):(files[0]?this.readFile(files[0]):'')??'';if(files[0]&&!this.exists(files[0]))return result(`wc: ${files[0]}: No such file or directory`,1,'error');const lines=src===''?0:src.split('\n').length-(src.endsWith('\n')?1:0),words=(src.trim().match(/\S+/g)||[]).length,bytes=src.length;let val=linesFlag?lines:wordsFlag?words:bytesFlag?bytes:`${lines} ${words} ${bytes}`;return result(`${val}${files[0]?' '+files[0]:''}`);}
  _cmd_sort(args,input){const file=args.find(a=>!a.startsWith('-'));const src=input!==''?String(input):(file?this.readFile(file):'')??'';return result(src.replace(/\n$/,'').split('\n').sort().join('\n'));}
  _cmd_uniq(args,input){const file=args.find(a=>!a.startsWith('-'));const src=input!==''?String(input):(file?this.readFile(file):'')??'';const lines=src.replace(/\n$/,'').split('\n'),out=[];for(const l of lines)if(out[out.length-1]!==l)out.push(l);return result(out.join('\n'));}
  _cmd_cut(args,input){let delimiter='\t',field=1,file=null;for(let i=0;i<args.length;i++){const a=args[i];if(a==='-d')delimiter=args[++i]||delimiter;else if(a.startsWith('-d')&&a.length>2)delimiter=a.slice(2);else if(a==='-f')field=Number(args[++i]||1);else if(a.startsWith('-f'))field=Number(a.slice(2));else if(!a.startsWith('-'))file=a;}const src=input!==''?String(input):(file?this.readFile(file):'')??'';return result(src.replace(/\n$/,'').split('\n').map(l=>l.split(delimiter)[field-1]??'').join('\n'));}
  _cmd_tr(args,input){if(args.length<2)return result('tr: missing operand',1,'error');let src=input||'';if(args[0]==='a-z'&&args[1]==='A-Z')src=src.toUpperCase();else if(args[0]==='A-Z'&&args[1]==='a-z')src=src.toLowerCase();return result(src);}

  _cmd_whoami(){return result(this.env.USER);}
  _cmd_id(){return result('uid=1000(student) gid=1000(student) groups=1000(student),27(sudo),998(docker)');}
  _cmd_groups(){return result('student sudo docker');}
  _cmd_chmod(args){if(args.length<2)return result('chmod: missing operand',1,'error');const spec=args[0];for(const p of args.slice(1)){const n=this.node(p);if(!n)return result(`chmod: cannot access '${p}'`,1,'error');if(/^[0-7]{3,4}$/.test(spec))n.mode=spec.slice(-3);else if(spec==='+x'||spec==='a+x'){n.mode=this._toggleX(n.mode,true);}else if(spec==='-x'||spec==='a-x'){n.mode=this._toggleX(n.mode,false);}else return result(`chmod: invalid mode: '${spec}'`,1,'error');}return result('');}
  _toggleX(mode,on){const digits=String(mode||'644').padStart(3,'0').split('').map(Number);return digits.map(d=>String(on?(d|1):(d&6))).join('');}
  _cmd_chown(args){if(args.length<2)return result('chown: missing operand',1,'error');const [who,...files]=args,[owner,group]=who.split(':');for(const p of files){const n=this.node(p);if(!n)return result(`chown: cannot access '${p}'`,1,'error');n.owner=owner||n.owner;n.group=group||n.group;}return result('');}
  _cmd_stat(args){const p=args[0];if(!p)return result('stat: missing operand',1,'error');const n=this.node(p);if(!n)return result(`stat: cannot statx '${p}'`,1,'error');const size=n.type==='file'?n.content.length:4096;return result(`  File: ${p}\n  Size: ${size}\tType: ${n.type}\nAccess: (0${n.mode}/${this._modeString(n)})  Uid: (1000/${n.owner})   Gid: (1000/${n.group})`);}
  _cmd_umask(args){if(args[0]&&/^[0-7]{3,4}$/.test(args[0])){this.umaskValue=args[0].padStart(4,'0');return result('');}return result(this.umaskValue);}

  _cmd_ps(args){const aux=args.includes('aux')||args.includes('-ef');if(!aux)return result('  PID TTY          TIME CMD\n'+this.processes.filter(p=>p.user==='student').map(p=>`${String(p.pid).padStart(5)} pts/0    00:00:00 ${(p.name||p.cmd).split(' ')[0]}`).join('\n'));const header='USER       PID %CPU %MEM COMMAND';return result(header+'\n'+this.processes.map(p=>`${String(p.user).padEnd(10)} ${String(p.pid).padStart(5)} ${p.cpu} ${p.mem} ${p.cmd}`).join('\n'));}
  _cmd_pgrep(args){const name=args[0];if(!name)return result('pgrep: no matching criteria specified',2,'error');const found=this.processes.filter(p=>(p.name||p.cmd).includes(name));return result(found.map(p=>p.pid).join('\n'),found.length?0:1);}
  _cmd_sleep(args,input,ctx){const seconds=args[0]||'1';if(ctx.background){const pid=this.nextPid++;const p={pid,user:'student',cpu:'0.0',mem:'0.0',cmd:`sleep ${seconds}`,name:'sleep',status:'S'};this.processes.push(p);this.jobsList.push({id:this.jobsList.length+1,pid,cmd:`sleep ${seconds} &`,status:'Running'});return result(`[${this.jobsList.length}] ${pid}`);}return result('');}
  _cmd_jobs(){return result(this.jobsList.map(j=>`[${j.id}]  ${j.status.padEnd(8)} ${j.cmd}`).join('\n'));}
  _cmd_kill(args){let sig='TERM';const clean=[];for(const a of args){if(a.startsWith('-'))sig=a.slice(1);else clean.push(a);}if(!clean.length)return result('kill: usage: kill [-s sigspec] pid',1,'error');for(const pid of clean){const idx=this.processes.findIndex(p=>String(p.pid)===String(pid));if(idx<0)return result(`kill: (${pid}) - No such process`,1,'error');this.processes.splice(idx,1);this.jobsList=this.jobsList.filter(j=>String(j.pid)!==String(pid));}return result('');}
  _cmd_pkill(args){const name=args.filter(a=>!a.startsWith('-'))[0];if(!name)return result('pkill: no matching criteria specified',2,'error');const before=this.processes.length;const killed=this.processes.filter(p=>(p.name||p.cmd).includes(name)).map(p=>p.pid);this.processes=this.processes.filter(p=>!killed.includes(p.pid));this.jobsList=this.jobsList.filter(j=>!killed.includes(j.pid));return result('',before===this.processes.length?1:0);}
  _cmd_uptime(){return result('10:38:42 up 14 days,  3:21,  1 user,  load average: 0.18, 0.22, 0.19');}
  _cmd_top(){return result('top - 10:38:42 up 14 days, load average: 0.18, 0.22, 0.19\nTasks: 42 total, 1 running, 41 sleeping\n%Cpu(s): 3.2 us, 1.1 sy, 95.7 id\nMiB Mem : 7984 total, 2140 free, 2860 used, 2984 buff/cache\n\n  PID USER      %CPU %MEM COMMAND\n  742 www-data   0.4  0.4 nginx\n 4242 student    0.2  1.1 node');}

  _cmd_ip(args){const sub=args[0]||'addr';if(sub==='addr'||sub==='a')return result('1: lo: <LOOPBACK,UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500\n    inet 10.10.0.15/24 brd 10.10.0.255 scope global eth0');if(sub==='route'||sub==='r')return result('default via 10.10.0.1 dev eth0\n10.10.0.0/24 dev eth0 proto kernel scope link src 10.10.0.15');return result(`ip: unknown object '${sub}'`,1,'error');}
  _cmd_ss(){return result('Netid State  Local Address:Port  Process\ntcp   LISTEN 0.0.0.0:22          users:(("sshd",pid=610))\ntcp   LISTEN 0.0.0.0:80          users:(("nginx",pid=731))\ntcp   LISTEN 127.0.0.1:5432      users:(("postgres",pid=811))');}
  _cmd_ping(args){let count=4,host=args[args.length-1];const i=args.indexOf('-c');if(i>=0)count=Number(args[i+1]||4);if(!host||host.startsWith('-'))return result('ping: usage error: Destination address required',2,'error');let out=`PING ${host} (93.184.216.34) 56(84) bytes of data.`;for(let n=1;n<=count;n++)out+=`\n64 bytes from 93.184.216.34: icmp_seq=${n} ttl=56 time=${(18+n/10).toFixed(1)} ms`;out+=`\n--- ${host} ping statistics ---\n${count} packets transmitted, ${count} received, 0% packet loss`;return result(out);}
  _cmd_curl(args){const head=args.includes('-I')||args.includes('--head'),silent=args.includes('-s')||args.includes('--silent');const url=args.find(a=>/^https?:\/\//.test(a));if(!url)return result('curl: (2) no URL specified',2,'error');if(url.includes('api.local/health'))return result('{"status":"ok","service":"api"}');if(url.includes('localhost/health'))return result('ok');if(url==='http://localhost'||url==='http://localhost/')return head?result('HTTP/1.1 200 OK\nServer: nginx\nContent-Type: text/html'):result('<h1>Linux Gym nginx</h1>');if(url.includes('example.com'))return head?result('HTTP/2 200\ncontent-type: text/html\nserver: envoy\ncache-control: max-age=86000'):result('<!doctype html><title>Example Domain</title><h1>Example Domain</h1>');return result(`curl: (6) Could not resolve host: ${url.replace(/^https?:\/\//,'')}`,6,'error');}
  _cmd_dig(args){const host=args.find(a=>!a.startsWith('-'));if(!host)return result('dig: no query name',1,'error');const ip=host==='app.internal'?'10.10.0.20':'93.184.216.34';return result(`; <<>> DiG 9.18 <<>> ${host}\n;; ANSWER SECTION:\n${host}.\t300\tIN\tA\t${ip}\n\n;; Query time: 12 msec`);}
  _cmd_hostname(){return result('linux-gym');}

  _cmd_export(args){if(!args.length)return this._cmd_env();for(const item of args){const i=item.indexOf('=');if(i>0)this.env[item.slice(0,i)]=item.slice(i+1);}return result('');}
  _cmd_env(){return result(Object.entries(this.env).map(([k,v])=>`${k}=${v}`).join('\n'));}
  _cmd_unset(args){args.forEach(k=>delete this.env[k]);return result('');}
  _cmd_alias(args){if(!args.length)return result(Object.entries(this.aliases).map(([k,v])=>`alias ${k}='${v}'`).join('\n'));const joined=args.join(' ');const m=joined.match(/^([A-Za-z_][\w-]*)=(.*)$/);if(!m)return result('alias: invalid alias definition',1,'error');this.aliases[m[1]]=m[2];return result('');}
  _cmd_unalias(args){args.forEach(k=>delete this.aliases[k]);return result('');}
  _cmd_history(){return result(this.history.map((h,i)=>`${String(i+1).padStart(4)}  ${h}`).join('\n'));}
  _cmd_which(args){const c=args[0];if(!c)return result('');if(COMMANDS.includes(c)||c==='bash')return result(`/usr/bin/${c}`);return result('',1);}
  _cmd_uname(args){return args.includes('-a')?result('Linux linux-gym 6.8.0-gym #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux'):result('Linux');}
  _cmd_date(){return result('Fri Aug 14 10:38:42 CEST 2026');}
  _cmd_true(){return result('',0);}
  _cmd_false(){return result('',1);}
  _cmd_bash(args){const p=args[0];if(!p)return result('GNU bash, version 5.2.21(1)-release');const full=this.normalizePath(p);if(!this.exists(full))return result(`bash: ${p}: No such file or directory`,127,'error');return this._runScript(full,args.slice(1));}
  _runScript(path,args=[]){const n=this.node(path);if(!n||n.type!=='file')return result(`bash: ${path}: No such file`,127,'error');const lines=n.content.split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));const outputs=[];let code=0;for(const line of lines){const r=this._executeLine(line,false);if(r.output)outputs.push(r.output);code=r.code;if(code!==0)break;}return result(outputs.join('\n'),code);}

  _needGit(){return this.git.initialized?null:result('fatal: not a git repository (or any of the parent directories): .git',128,'error');}
  _cmd_git(args){const sub=args.shift();if(!sub)return result('usage: git <command> [<args>]');if(sub==='init'){this.git.initialized=true;this.git.branch='main';this.git.branches=['main'];return result(`Initialized empty Git repository in ${this.cwd}/.git/`);}const err=this._needGit();if(err)return err;
    if(sub==='status'){const staged=this.git.staged.length?`Changes to be committed:\n  ${this.git.staged.map(x=>'modified: '+x).join('\n  ')}`:'nothing added to commit';const dirty=this.git.dirty.filter(x=>!this.git.staged.includes(x));return result(`On branch ${this.git.branch}\n${staged}${dirty.length?`\nChanges not staged for commit:\n  ${dirty.map(x=>'modified: '+x).join('\n  ')}`:''}`);}
    if(sub==='add'){if(!args.length)return result('Nothing specified, nothing added.',1,'error');const files=args[0]==='.'?this.git.dirty:args;for(const f of files)if(!this.git.staged.includes(f))this.git.staged.push(f);return result('');}
    if(sub==='commit'){const i=args.indexOf('-m');const msg=i>=0?args[i+1]:'commit';if(!this.git.staged.length)return result('nothing to commit, working tree clean',1,'error');const hash=Math.random().toString(16).slice(2,9);this.git.commits.unshift({hash,msg,branch:this.git.branch,files:[...this.git.staged]});this.git.dirty=this.git.dirty.filter(x=>!this.git.staged.includes(x));this.git.staged=[];return result(`[${this.git.branch} ${hash}] ${msg}`);}
    if(sub==='branch'){if(!args[0])return result(this.git.branches.map(b=>(b===this.git.branch?'* ':'  ')+b).join('\n'));const b=args[0];if(!this.git.branches.includes(b))this.git.branches.push(b);return result('');}
    if(sub==='switch'||sub==='checkout'){let create=false,b=args[0];if(b==='-c'||b==='-b'){create=true;b=args[1];}if(!b)return result('fatal: missing branch name',1,'error');if(create&&!this.git.branches.includes(b))this.git.branches.push(b);if(!this.git.branches.includes(b))return result(`fatal: invalid reference: ${b}`,128,'error');this.git.branch=b;return result(`Switched to ${create?'a new branch':'branch'} '${b}'`);}
    if(sub==='log'){if(!this.git.commits.length)return result('fatal: your current branch does not have any commits yet',128,'error');return result(this.git.commits.map(c=>args.includes('--oneline')?`${c.hash} ${c.msg}`:`commit ${c.hash}\n    ${c.msg}`).join('\n'));}
    if(sub==='diff'){return result(this.git.dirty.length?this.git.dirty.map(f=>`diff --git a/${f} b/${f}\n--- a/${f}\n+++ b/${f}\n@@ -1 +1 @@\n-training\n+updated`).join('\n'):'');}
    if(sub==='remote'){if(args[0]==='add'&&args[1]&&args[2]){this.git.remotes[args[1]]=args[2];return result('');}if(args[0]==='-v'||!args[0])return result(Object.entries(this.git.remotes).flatMap(([n,u])=>[`${n}\t${u} (fetch)`,`${n}\t${u} (push)`]).join('\n'));}
    if(sub==='stash'){this.git.stash++;this.git.dirty=[];this.git.staged=[];return result(`Saved working directory and index state WIP on ${this.git.branch}`);}
    return result(`git: '${sub}' is not implemented in this lab`,1,'error');
  }

  _cmd_docker(args){const sub=args.shift();if(!sub)return result('Usage: docker COMMAND');
    if(sub==='images')return result('REPOSITORY          TAG       IMAGE ID       SIZE\n'+this.docker.images.map((x,i)=>{const [r,t='latest']=x.split(':');return `${r.padEnd(19)} ${t.padEnd(9)} ${('a1b2c3d'+i).padEnd(14)} 12.4MB`;}).join('\n'));
    if(sub==='pull'){const image=args[0];if(!image)return result('docker: pull requires exactly 1 argument',1,'error');if(!this.docker.images.includes(image))this.docker.images.push(image);return result(`${image}: Pulling from library/${image.split(':')[0]}\nDigest: sha256:8ab4...\nStatus: Downloaded newer image for ${image}`);}
    if(sub==='run'){
      let name=null,port=null,image=null,detach=false;for(let i=0;i<args.length;i++){const a=args[i];if(a==='-d')detach=true;else if(a==='--name')name=args[++i];else if(a==='-p')port=args[++i];else if(!a.startsWith('-'))image=a;}
      if(!image)return result('docker: "run" requires an image',1,'error');if(!this.docker.images.includes(image))return result(`Unable to find image '${image}' locally`,125,'error');name=name||`container-${Object.keys(this.docker.containers).length+1}`;this.docker.containers[name]={name,image,status:'running',port,id:Math.random().toString(16).slice(2,14)};return result(this.docker.containers[name].id);
    }
    if(sub==='ps'){const all=args.includes('-a');const rows=Object.values(this.docker.containers).filter(c=>all||c.status==='running');return result('CONTAINER ID   IMAGE          STATUS          PORTS               NAMES\n'+rows.map(c=>`${c.id.padEnd(14)} ${c.image.padEnd(14)} ${c.status.padEnd(15)} ${(c.port||'').padEnd(19)} ${c.name}`).join('\n'));}
    if(sub==='logs'){const c=this.docker.containers[args[0]];return c?result('nginx: configuration loaded\nnginx: worker process started\nGET /health 200'):result(`Error: No such container: ${args[0]}`,1,'error');}
    if(sub==='exec'){const c=this.docker.containers[args[0]];if(!c||c.status!=='running')return result(`Error: container ${args[0]} is not running`,1,'error');const command=args.slice(1).join(' ');return command==='hostname'?result(c.id.slice(0,12)):result(`executed in ${c.name}: ${command}`);}
    if(sub==='inspect'){const c=this.docker.containers[args[0]];return c?result(JSON.stringify([{Id:c.id,Name:'/ '+c.name,Config:{Image:c.image},State:{Status:c.status},NetworkSettings:{Ports:c.port}}],null,2)):result(`Error: No such object: ${args[0]}`,1,'error');}
    if(sub==='stop'){const c=this.docker.containers[args[0]];if(!c)return result(`Error: No such container: ${args[0]}`,1,'error');c.status='stopped';return result(c.name);}
    if(sub==='start'){const c=this.docker.containers[args[0]];if(!c)return result(`Error: No such container: ${args[0]}`,1,'error');c.status='running';return result(c.name);}
    if(sub==='rm'){const name=args.filter(a=>!a.startsWith('-'))[0],c=this.docker.containers[name];if(!c)return result(`Error: No such container: ${name}`,1,'error');if(c.status==='running'&&!args.includes('-f'))return result(`Error: You cannot remove a running container ${name}`,1,'error');delete this.docker.containers[name];return result(name);}
    if(sub==='build'){const i=args.indexOf('-t'),tag=i>=0?args[i+1]:'local/image:latest';if(!this.docker.images.includes(tag))this.docker.images.push(tag);return result(`#1 [internal] load build definition\n#2 [1/2] FROM alpine:3.20\n#3 exporting to image\n#3 naming to ${tag}\nBuild complete`);}
    if(sub==='info')return result('Containers: '+Object.keys(this.docker.containers).length+'\n Images: '+this.docker.images.length+'\n Storage Driver: overlay2');
    return result(`docker: '${sub}' is not implemented in this lab`,1,'error');
  }

  _cmd_ssh_keygen(args){
    if(args.includes('-lf')){const p=args[args.indexOf('-lf')+1];if(!this.exists(p))return result(`${p} is not a public key file`,1,'error');return result('256 SHA256:Q8n0XkM7b8B4G7y1l3x4r9l5VZ6e7X9A student@linux-gym (ED25519)');}
    const type=args[args.indexOf('-t')+1]||'rsa';if(type!=='ed25519'&&type!=='rsa')return result('unknown key type',1,'error');this._setFile('/home/student/.ssh/id_ed25519','-----BEGIN OPENSSH PRIVATE KEY-----\ntraining-key\n-----END OPENSSH PRIVATE KEY-----\n','600');this._setFile('/home/student/.ssh/id_ed25519.pub','ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGymTrainingOnly student@linux-gym\n','644');return result('Generating public/private ed25519 key pair.\nYour identification has been saved in /home/student/.ssh/id_ed25519\nYour public key has been saved in /home/student/.ssh/id_ed25519.pub');
  }
  _cmd_ssh(args){const verbose=args.includes('-v');const host=args.filter(a=>!a.startsWith('-')).pop();if(!host)return result('usage: ssh destination',255,'error');let resolved=host;if(host==='appbox'){const cfg=this.readFile('/home/student/.ssh/config')||'';if(!/Host\s+appbox/.test(cfg))return result('ssh: Could not resolve hostname appbox',255,'error');resolved='dev@server.local';}const prefix=verbose?'OpenSSH_9.6p1\ndebug1: Reading configuration data /home/student/.ssh/config\ndebug1: Connecting to server.local [10.10.0.30] port 22.\n':'';return result(prefix+`Connected to ${resolved}.\nWelcome to the Linux Gym remote sandbox.`);}
  _cmd_scp(args){if(args.length<2)return result('usage: scp source target',1,'error');const src=this.normalizePath(args[0]);if(!this.exists(src))return result(`scp: stat local "${args[0]}": No such file or directory`,1,'error');this.remoteCopies.push({source:src,target:args[1]});return result(`${args[0]}                                      100%   ${(this.readFile(src)||'').length}B   1.2KB/s   00:00`);}

  _cmd_systemctl(args){const action=args[0],name=args[1];if(!action)return result('systemctl: too few arguments',1,'error');if(action==='list-units')return result(Object.entries(this.services).map(([n,s])=>`${n}.service loaded ${s.status} running`).join('\n'));if(!name||!this.services[name])return result(`Unit ${name||''}.service could not be found.`,4,'error');const svc=this.services[name];if(action==='status')return result(`● ${name}.service - ${name} service\n   Loaded: loaded (/lib/systemd/system/${name}.service; ${svc.enabled?'enabled':'disabled'})\n   Active: ${svc.status} (running) since Fri 2026-08-14 08:12:31 CEST`);if(action==='restart'||action==='start'){svc.status='active';return result('');}if(action==='stop'){svc.status='inactive';return result('');}if(action==='enable'){svc.enabled=true;return result(`Created symlink /etc/systemd/system/multi-user.target.wants/${name}.service → /lib/systemd/system/${name}.service.`);}if(action==='disable'){svc.enabled=false;return result('');}return result(`Unknown operation ${action}.`,1,'error');}
  _cmd_journalctl(args){if(args.includes('-p')&&args[args.indexOf('-p')+1]==='err')return result('Aug 14 09:42:11 linux-gym nginx[742]: upstream connection failed\nAug 14 09:42:12 linux-gym kernel: training disk warning cleared');const ui=args.indexOf('-u'),unit=ui>=0?args[ui+1]:'system';return result(`Aug 14 08:12:31 linux-gym systemd[1]: Started ${unit}.service\nAug 14 09:42:11 linux-gym ${unit}[742]: upstream connection failed\nAug 14 09:42:14 linux-gym ${unit}[742]: upstream recovered`);}
  _cmd_df(args){return result('Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        40G   18G   20G  48% /\ntmpfs           1.0G  1.2M  1.0G   1% /run');}
  _cmd_du(args){const path=args.filter(a=>!a.startsWith('-')).pop()||'.';return result(`${path==='/var/log'?'24M':'1.2M'}\t${path}`);}
  _cmd_free(args){return result('               total        used        free      shared  buff/cache   available\nMem:           7.8Gi       2.8Gi       2.1Gi       128Mi       2.9Gi       4.6Gi\nSwap:          2.0Gi          0B       2.0Gi');}
  _cmd_tar(args){const ci=args.indexOf('-czf');if(ci>=0&&args[ci+1]){const dest=args[ci+1];this._write(dest,'SIMULATED_TAR_GZIP\n'+args.slice(ci+2).join('\n'));return result('');}return result('tar: this lab currently supports `tar -czf ARCHIVE PATH`',2,'error');}
  _cmd_gzip(args){const p=args[0];if(!p)return result('gzip: compressed data not written to a terminal',1,'error');const content=this.readFile(p);if(content==null)return result(`gzip: ${p}: No such file or directory`,1,'error');const n=this.node(p);this._setFile(this.normalizePath(p)+'.gz','GZIP:'+content,n.mode,n.owner,n.group);this.fs.delete(this.normalizePath(p));return result('');}

  complete(input){
    const text=String(input);const parts=text.split(/\s+/);const last=parts[parts.length-1];
    if(parts.length===1){const matches=COMMANDS.filter(c=>c.startsWith(last));if(matches.length===1)return matches[0];return text;}
    const slash=last.lastIndexOf('/'),dirPart=slash>=0?last.slice(0,slash+1):'',base=slash>=0?last.slice(0,slash)||'.':'.',prefix=slash>=0?last.slice(slash+1):last;const dir=this.normalizePath(base);if(!this.exists(dir)||this.node(dir).type!=='dir')return text;const matches=this._children(dir).filter(n=>n.startsWith(prefix));if(matches.length===1){const completed=dirPart+matches[0]+(this.node(this.normalizePath(matches[0],dir)).type==='dir'?'/':'');parts[parts.length-1]=completed;return parts.join(' ');}return text;
  }
}

root.LinuxGymShell={VirtualShell,COMMANDS};
})(typeof globalThis!=='undefined'?globalThis:window);
