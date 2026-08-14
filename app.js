(function(){
'use strict';

const {tracks,tasks,totalTasks}=globalThis.LinuxGymData;
const {VirtualShell}=globalThis.LinuxGymShell;
const shell=new VirtualShell();
const $=id=>document.getElementById(id);

const els={
  app:$('app'),sidebar:$('sidebar'),trackList:$('trackList'),progressText:$('progressText'),progressPercent:$('progressPercent'),progressBar:$('progressBar'),masteryValue:$('masteryValue'),xpValue:$('xpValue'),
  adaptiveBtn:$('adaptiveBtn'),adaptiveText:$('adaptiveText'),dailyBtn:$('dailyBtn'),resetProgressBtn:$('resetProgressBtn'),homeBtn:$('homeBtn'),closeSidebarBtn:$('closeSidebarBtn'),
  contextTrack:$('contextTrack'),contextTask:$('contextTask'),trackIndex:$('trackIndex'),trackName:$('trackName'),difficultyBadge:$('difficultyBadge'),taskNumber:$('taskNumber'),taskKind:$('taskKind'),taskTitle:$('taskTitle'),taskDescription:$('taskDescription'),objectiveText:$('objectiveText'),objectiveStatus:$('objectiveStatus'),checkList:$('checkList'),conceptList:$('conceptList'),
  coachBox:$('coachBox'),coachMeta:$('coachMeta'),coachText:$('coachText'),hintBtn:$('hintBtn'),hintBox:$('hintBox'),attemptInfo:$('attemptInfo'),prevTaskBtn:$('prevTaskBtn'),nextTaskBtn:$('nextTaskBtn'),restartTaskBtn:$('restartTaskBtn'),
  terminalPanel:$('terminalPanel'),terminal:$('terminal'),terminalOutput:$('terminalOutput'),prompt:$('prompt'),commandInput:$('commandInput'),cwdStatus:$('cwdStatus'),branchStatus:$('branchStatus'),labStatus:$('labStatus'),focusBtn:$('focusBtn'),clearBtn:$('clearBtn'),resetEnvBtn:$('resetEnvBtn'),
  settingsBtn:$('settingsBtn'),settingsModal:$('settingsModal'),compactToggle:$('compactToggle'),coachToggle:$('coachToggle'),autoAdvanceToggle:$('autoAdvanceToggle'),examModal:$('examModal'),examTitle:$('examTitle'),examText:$('examText'),toastStack:$('toastStack')
};

const STORAGE='linux-gym-v2';
const today=()=>new Date().toISOString().slice(0,10);
const defaultState=()=>({
  completed:[],xp:0,currentTask:tasks[0].id,attempts:{},hints:{},scores:{},lastPracticeDate:null,streak:0,
  settings:{compact:false,coach:true,autoAdvance:false},version:2
});
let state=loadState();
let currentTask=tasks.find(t=>t.id===state.currentTask)||tasks[0];
let taskStartHistory=0;
let commandCursor=0;
let lastCommand='';
let lastResult={code:0,output:''};
let focusMode=false;
let autoAdvanceTimer=null;

function loadState(){
  try{const raw=localStorage.getItem(STORAGE);if(!raw)return defaultState();const parsed=JSON.parse(raw);return {...defaultState(),...parsed,settings:{...defaultState().settings,...(parsed.settings||{})}};}catch{return defaultState();}
}
function save(){state.currentTask=currentTask.id;localStorage.setItem(STORAGE,JSON.stringify(state));}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function pad(n){return String(n+1).padStart(2,'0');}
function taskIndex(t=currentTask){return tasks.findIndex(x=>x.id===t.id);}
function trackFor(t=currentTask){return tracks[t.trackIndex];}
function isDone(id){return state.completed.includes(id);}
function taskAttempts(id=currentTask.id){return state.attempts[id]||0;}
function hintCount(id=currentTask.id){return state.hints[id]||0;}
function difficultyName(n){return ['','Starter','Core','Applied','Advanced','Expert'][n]||'Core';}

function overallMastery(){
  if(!totalTasks)return 0;
  const completion=state.completed.length/totalTasks*100;
  const quality=state.completed.length?Object.values(state.scores).reduce((a,b)=>a+b,0)/(state.completed.length*100)*10:0;
  return Math.round(clamp(completion*.9+quality,0,100));
}
function trackMastery(track){const done=track.tasks.filter(t=>isDone(`${track.id}/${t.slug}`)).length;return Math.round(done/track.tasks.length*100);}
function adaptiveTarget(){
  const candidates=tracks.filter(t=>t.id!=='exams'&&trackMastery(t)<100).sort((a,b)=>trackMastery(a)-trackMastery(b));
  if(!candidates.length)return tracks.find(t=>t.id==='exams')?.tasks.map(t=>tasks.find(x=>x.id===`exams/${t.slug}`)).find(t=>t&&!isDone(t.id))||tasks[0];
  const weakest=candidates[0];const ability=clamp(1+Math.floor(state.completed.length/24),1,5);
  const list=weakest.tasks.map(t=>tasks.find(x=>x.id===`${weakest.id}/${t.slug}`)).filter(t=>t&&!isDone(t.id));
  return list.sort((a,b)=>Math.abs(a.difficulty-ability)-Math.abs(b.difficulty-ability))[0]||list[0];
}

function renderAll(){renderSidebar();renderTask();renderStats();renderTerminalStatus();applySettings();}
function renderStats(){
  const pct=Math.round(state.completed.length/totalTasks*100);
  els.progressText.textContent=`${state.completed.length} of ${totalTasks} complete`;
  els.progressPercent.textContent=`${pct}%`;els.progressBar.style.width=`${pct}%`;els.masteryValue.textContent=`${overallMastery()}%`;els.xpValue.textContent=String(state.xp);
  const target=adaptiveTarget();els.adaptiveText.textContent=target?`${target.trackTitle} · ${difficultyName(target.difficulty)}`:'Course complete';
}
function renderSidebar(){
  els.trackList.innerHTML='';
  tracks.forEach((tr,ti)=>{
    const wrap=document.createElement('div');wrap.className='track'+(tr.id===currentTask.trackId?' active':'')+(trackMastery(tr)===100?' done':'');
    const done=tr.tasks.filter(t=>isDone(`${tr.id}/${t.slug}`)).length;
    const btn=document.createElement('button');btn.className='track-btn';btn.innerHTML=`<span class="track-index">${pad(ti)}</span><span class="track-copy"><strong>${esc(tr.title)}</strong><small>${esc(tr.subtitle)}</small></span><span class="track-progress">${done}/${tr.tasks.length}</span>`;
    btn.addEventListener('click',()=>{const first=tasks.find(t=>t.trackId===tr.id&&!isDone(t.id))||tasks.find(t=>t.trackId===tr.id);if(first)selectTask(first);});wrap.appendChild(btn);
    const list=document.createElement('div');list.className='task-list';
    tr.tasks.forEach((raw,ri)=>{const t=tasks.find(x=>x.id===`${tr.id}/${raw.slug}`);const b=document.createElement('button');b.className='task-link'+(t.id===currentTask.id?' active':'')+(isDone(t.id)?' done':'');b.innerHTML=`<span class="task-dot"></span><span>${pad(ri)} ${esc(t.title)}</span>`;b.addEventListener('click',e=>{e.stopPropagation();selectTask(t);});list.appendChild(b);});
    wrap.appendChild(list);els.trackList.appendChild(wrap);
  });
}
function renderTask(){
  const tr=trackFor();
  els.contextTrack.textContent=tr.title;els.contextTask.textContent=currentTask.title;els.trackIndex.textContent=pad(currentTask.trackIndex);els.trackName.textContent=tr.title;
  els.difficultyBadge.textContent=difficultyName(currentTask.difficulty);els.taskNumber.textContent=pad(currentTask.taskIndex);els.taskKind.textContent=currentTask.kind.toUpperCase();els.taskTitle.textContent=currentTask.title;els.taskDescription.textContent=currentTask.description;els.objectiveText.innerHTML=inlineCode(currentTask.objective);
  els.conceptList.innerHTML=currentTask.concepts.map(x=>`<span class="concept">${esc(x)}</span>`).join('');
  renderChecks();renderHint();renderAttemptInfo();
  const idx=taskIndex();els.prevTaskBtn.disabled=idx<=0;els.nextTaskBtn.disabled=idx>=tasks.length-1;
  els.objectiveStatus.textContent=isDone(currentTask.id)?'Complete':'In progress';els.objectiveStatus.classList.toggle('complete',isDone(currentTask.id));
  if(isDone(currentTask.id)){els.coachBox.classList.add('hidden');}
}
function inlineCode(text){return esc(text).replace(/`([^`]+)`/g,'<code>$1</code>');}
function renderChecks(){
  els.checkList.innerHTML='';const statuses=evaluateChecks();
  currentTask.checks.forEach((check,i)=>{const div=document.createElement('div');div.className='check'+(statuses[i]?' done':'');div.innerHTML=`<span class="check-mark">✓</span><span>${inlineCode(check.label)}</span>`;els.checkList.appendChild(div);});
}
function renderHint(){
  const count=hintCount(),hints=currentTask.hints||[];
  if(count<=0){els.hintBox.classList.add('hidden');els.hintBox.innerHTML='';els.hintBtn.textContent='Show hint';return;}
  const shown=hints.slice(0,Math.min(count,hints.length));els.hintBox.innerHTML=shown.map((h,i)=>`<div>${i+1}. ${inlineCode(h)}</div>`).join('');els.hintBox.classList.remove('hidden');els.hintBtn.textContent=count<hints.length?'Show next hint':'Hints shown';
}
function renderAttemptInfo(){const n=taskAttempts();els.attemptInfo.textContent=n===0?'No mistakes yet':`${n} ${n===1?'mistake':'mistakes'} · adaptive score ${currentPerformance()}%`;}
function currentPerformance(){return clamp(100-taskAttempts()*12-hintCount()*8,35,100);}

function evaluateChecks(){return currentTask.checks.map(check=>evaluateCheck(check));}
function evaluateCheck(check){
  const path=check.value;
  switch(check.type){
    case 'command':{if(!lastCommand||lastResult.code!==0)return false;try{return new RegExp(check.pattern,check.flags||'i').test(lastCommand);}catch{return false;}}
    case 'history':{const recent=shell.history.slice(taskStartHistory).join('\n');try{return new RegExp(check.pattern,check.flags||'i').test(recent);}catch{return false;}}
    case 'cwd':return shell.cwd===check.value;
    case 'exists':return shell.exists(path);
    case 'missing':return !shell.exists(path);
    case 'fileContains':return (shell.readFile(path)||'').includes(check.contains||'');
    case 'mode':return shell.mode(path)===check.mode;
    case 'owner':return shell.owner(path)===check.owner;
    case 'executable':return shell.isExecutable(path);
    case 'process':return shell.hasProcess(check.value);
    case 'processMissing':return !shell.processByPid(check.value);
    case 'processNameMissing':return !shell.hasProcess(check.value);
    case 'env':return shell.env[check.value]===check.equals;
    case 'git':return shell.git[check.value]===check.equals;
    case 'gitStaged':return shell.git.staged.includes(check.value);
    case 'gitCommits':return shell.git.commits.length>=(check.min||check.value||1);
    case 'gitBranchExists':return shell.git.branches.includes(check.value);
    case 'gitBranch':return shell.git.branch===check.value;
    case 'gitRemote':return Boolean(shell.git.remotes[check.value]);
    case 'gitStash':return shell.git.stash>=(check.min||1);
    case 'dockerImage':return shell.hasDockerImage(check.value);
    case 'dockerContainer':{const c=shell.dockerContainer(check.value);return Boolean(c)&&(!check.status||c.status===check.status)&&(!check.port||c.port===check.port);}
    case 'dockerContainerMissing':return !shell.dockerContainer(check.value);
    case 'service':return shell.services[check.value]?.status===check.status;
    case 'serviceEnabled':return Boolean(shell.services[check.value]?.enabled);
    default:return false;
  }
}

function selectTask(task,opts={}){
  if(!task)return;clearTimeout(autoAdvanceTimer);currentTask=task;state.currentTask=task.id;taskStartHistory=shell.history.length;lastCommand='';lastResult={code:0,output:''};
  if(opts.resetLab)resetLab(false);else preparePrerequisites(task);
  save();renderAll();closeMobileSidebar();if(window.innerWidth<=820)setMobileView('lesson');
}
function preparePrerequisites(task){
  if(task.trackId==='git'&&task.taskIndex>0&&!shell.git.initialized){shell.git.initialized=true;shell.git.branch='main';shell.git.branches=['main'];}
  if(task.trackId==='docker'&&task.taskIndex>=2&&!shell.hasDockerImage('nginx:alpine'))shell.docker.images.push('nginx:alpine');
  if(task.trackId==='docker'&&task.taskIndex>=3&&task.taskIndex<=8&&!shell.dockerContainer('web'))shell.docker.containers.web={name:'web',image:'nginx:alpine',status:task.taskIndex>=7?'running':'running',port:'8080:80',id:'b3f9c2a18d11'};
  if(task.trackId==='docker'&&task.taskIndex===8&&shell.dockerContainer('web'))shell.docker.containers.web.status='stopped';
  if(task.trackId==='ssh'&&task.taskIndex>0&&!shell.exists('/home/student/.ssh/id_ed25519')){shell._setFile('/home/student/.ssh/id_ed25519','training-private-key\n','600');shell._setFile('/home/student/.ssh/id_ed25519.pub','ssh-ed25519 training student@linux-gym\n','644');}
  if(task.trackId==='filesystem'&&task.taskIndex>=6&&!shell.exists('/home/student/status.txt'))shell._setFile('/home/student/status.txt','ready\n','644');
  renderTerminalStatus();
}
function resetLab(showToast=true){shell.reset();taskStartHistory=0;lastCommand='';lastResult={code:0,output:''};preparePrerequisites(currentTask);clearTerminal();printWelcome();renderChecks();renderTerminalStatus();if(showToast)toast('Lab reset','The virtual Linux environment is back to a clean snapshot.');}

function onCommand(raw){
  const command=raw.trim();if(!command)return;
  appendCommand(command);lastCommand=command;const beforeDone=isDone(currentTask.id);const r=shell.execute(command);lastResult=r;
  if(r.output==='__CLEAR__'){clearTerminal();}else if(r.output){appendOutput(r.output,r.code===0?'normal':'error');}
  els.commandInput.value='';commandCursor=shell.history.length;renderTerminalStatus();
  if(!beforeDone){const passed=evaluateChecks().every(Boolean);if(passed&&r.code===0)completeCurrentTask();else if(r.code!==0||looksLikeAttempt(command)){registerAttempt(r);}}
  renderChecks();renderAttemptInfo();scrollTerminal();
}
function looksLikeAttempt(command){
  const patterns=currentTask.checks.filter(c=>c.type==='command').map(c=>c.pattern);if(!patterns.length)return false;
  const first=command.split(/\s+/)[0];return currentTask.example?.startsWith(first)&&lastResult.code===0&&!evaluateChecks().every(Boolean);
}
function registerAttempt(r){
  state.attempts[currentTask.id]=(state.attempts[currentTask.id]||0)+1;save();
  if(state.settings.coach){const n=taskAttempts();els.coachMeta.textContent=n===1?'First correction':'Adaptive correction';els.coachText.innerHTML=coachMessage(r,n);els.coachBox.classList.remove('hidden');}
}
function coachMessage(r,n){
  if(r.code!==0){const out=(r.output||'').split('\n')[0];return `The shell returned an error: <code>${esc(out)}</code>. Read the error literally, verify the path or command syntax, then retry.`;}
  const hint=currentTask.hints[Math.min(n-1,currentTask.hints.length-1)]||currentTask.hints[0];return `That command ran, but the target state is not complete yet. ${inlineCode(hint||'Compare your command with the objective.')}`;
}
function completeCurrentTask(){
  if(isDone(currentTask.id))return;
  state.completed.push(currentTask.id);const score=currentPerformance();state.scores[currentTask.id]=score;let award=currentTask.kind==='Exam'?100:20+currentTask.difficulty*10;award=Math.max(10,Math.round(award*score/100));state.xp+=award;updateStreak();save();
  els.objectiveStatus.textContent='Complete';els.objectiveStatus.classList.add('complete');els.coachBox.classList.add('hidden');renderSidebar();renderStats();renderChecks();toast('Mission complete',`+${award} XP · ${score}% execution score`,'success');
  if(currentTask.kind==='Exam'){els.examTitle.textContent=`${currentTask.title} passed`;els.examText.textContent=`You completed the scenario with a ${score}% execution score and earned ${award} XP.`;if(typeof els.examModal.showModal==='function')els.examModal.showModal();}
  if(state.settings.autoAdvance&&taskIndex()<tasks.length-1){autoAdvanceTimer=setTimeout(()=>selectTask(tasks[taskIndex()+1]),900);}
}
function updateStreak(){const d=today();if(state.lastPracticeDate===d)return;const prev=new Date();prev.setDate(prev.getDate()-1);const y=prev.toISOString().slice(0,10);state.streak=state.lastPracticeDate===y?(state.streak||0)+1:1;state.lastPracticeDate=d;}

function appendCommand(command){const line=document.createElement('div');line.className='output-line command';line.innerHTML=`<span class="prompt-copy">${esc(promptText())}</span>${esc(command)}`;els.terminalOutput.appendChild(line);}
function appendOutput(text,type='normal'){String(text).split('\n').forEach(t=>{const line=document.createElement('div');line.className='output-line '+(type==='error'?'error':'');line.textContent=t;els.terminalOutput.appendChild(line);});}
function appendInfo(text){const line=document.createElement('div');line.className='output-line dim';line.textContent=text;els.terminalOutput.appendChild(line);}
function clearTerminal(){els.terminalOutput.innerHTML='';}
function printWelcome(){appendInfo(`Linux Gym sandbox · ${totalTasks} missions · type 'help' for supported commands`);appendInfo('Your actions change a local virtual Linux state; objectives are checked automatically.');}
function promptText(){return `student@linux-gym:${shell.displayPath()}$`;}
function renderTerminalStatus(){els.prompt.textContent=promptText();els.cwdStatus.textContent=shell.displayPath();els.branchStatus.textContent=shell.git.initialized?`git:${shell.git.branch}`:'git:—';const running=Object.values(shell.docker.containers).filter(c=>c.status==='running').length;els.labStatus.textContent=running?`${running} container${running===1?'':'s'} running`:'local sandbox';}
function scrollTerminal(){requestAnimationFrame(()=>{els.terminal.scrollTop=els.terminal.scrollHeight;});}

function showHint(){
  const max=currentTask.hints.length;if(!max)return;const current=hintCount();if(current<max){state.hints[currentTask.id]=current+1;save();renderHint();renderAttemptInfo();if(state.settings.coach){els.coachMeta.textContent='Hint requested';els.coachText.innerHTML=inlineCode(currentTask.hints[Math.min(current,max-1)]);els.coachBox.classList.remove('hidden');}}
}
function toast(title,text,type=''){const box=document.createElement('div');box.className='toast '+type;box.innerHTML=`<strong>${esc(title)}</strong><span>${esc(text)}</span>`;els.toastStack.appendChild(box);setTimeout(()=>box.remove(),3400);}

function applySettings(){els.terminal.classList.toggle('compact',state.settings.compact);els.compactToggle.checked=state.settings.compact;els.coachToggle.checked=state.settings.coach;els.autoAdvanceToggle.checked=state.settings.autoAdvance;if(!state.settings.coach)els.coachBox.classList.add('hidden');}
function saveSettings(){state.settings.compact=els.compactToggle.checked;state.settings.coach=els.coachToggle.checked;state.settings.autoAdvance=els.autoAdvanceToggle.checked;save();applySettings();}
function setMobileView(view){document.body.classList.toggle('mobile-view-terminal',view==='terminal');document.querySelectorAll('.mobile-tab').forEach(b=>b.classList.toggle('active',b.dataset.mobileView===view));if(view==='course')els.sidebar.classList.add('mobile-open');if(view==='terminal')setTimeout(()=>els.commandInput.focus(),30);}
function closeMobileSidebar(){els.sidebar.classList.remove('mobile-open');}

function dailyChallenge(){
  const day=Math.floor(Date.now()/86400000);const incomplete=tasks.filter(t=>!isDone(t.id)&&t.kind!=='Exam');const pool=incomplete.length?incomplete:tasks.filter(t=>t.kind!=='Exam');selectTask(pool[day%pool.length]);toast('Daily challenge',`Today: ${currentTask.trackTitle} · ${currentTask.title}`);
}
function resetProgress(){
  if(!window.confirm('Reset all Linux Gym progress and XP on this device?'))return;
  state=defaultState();currentTask=tasks[0];localStorage.removeItem(STORAGE);resetLab(false);save();renderAll();toast('Progress reset','The course is back at mission one.');
}

els.commandInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();onCommand(els.commandInput.value);return;}
  if(e.key==='ArrowUp'){e.preventDefault();if(!shell.history.length)return;commandCursor=Math.max(0,commandCursor-1);els.commandInput.value=shell.history[commandCursor]||'';queueMicrotask(()=>els.commandInput.setSelectionRange(9999,9999));return;}
  if(e.key==='ArrowDown'){e.preventDefault();if(!shell.history.length)return;commandCursor=Math.min(shell.history.length,commandCursor+1);els.commandInput.value=commandCursor===shell.history.length?'':shell.history[commandCursor]||'';return;}
  if(e.key==='Tab'){e.preventDefault();els.commandInput.value=shell.complete(els.commandInput.value);return;}
  if(e.key.toLowerCase()==='l'&&e.ctrlKey){e.preventDefault();clearTerminal();return;}
  if(e.key.toLowerCase()==='c'&&e.ctrlKey){e.preventDefault();appendCommand(els.commandInput.value);appendInfo('^C');els.commandInput.value='';}
});
els.terminal.addEventListener('click',()=>els.commandInput.focus());
els.clearBtn.addEventListener('click',()=>{clearTerminal();els.commandInput.focus();});
els.resetEnvBtn.addEventListener('click',()=>resetLab());
els.restartTaskBtn.addEventListener('click',()=>resetLab());
els.hintBtn.addEventListener('click',showHint);
els.prevTaskBtn.addEventListener('click',()=>{const i=taskIndex();if(i>0)selectTask(tasks[i-1]);});
els.nextTaskBtn.addEventListener('click',()=>{const i=taskIndex();if(i<tasks.length-1)selectTask(tasks[i+1]);});
els.adaptiveBtn.addEventListener('click',()=>{const t=adaptiveTarget();if(t){selectTask(t);toast('Adaptive practice',`Selected from your weakest current track: ${t.trackTitle}.`);}});
els.dailyBtn.addEventListener('click',dailyChallenge);els.resetProgressBtn.addEventListener('click',resetProgress);els.homeBtn.addEventListener('click',()=>selectTask(tasks[0]));
els.settingsBtn.addEventListener('click',()=>{if(typeof els.settingsModal.showModal==='function')els.settingsModal.showModal();});
[els.compactToggle,els.coachToggle,els.autoAdvanceToggle].forEach(x=>x.addEventListener('change',saveSettings));
els.focusBtn.addEventListener('click',()=>{focusMode=!focusMode;els.app.classList.toggle('focus-terminal',focusMode);els.focusBtn.textContent=focusMode?'Exit focus':'Focus';setTimeout(()=>els.commandInput.focus(),20);});
els.closeSidebarBtn.addEventListener('click',closeMobileSidebar);
document.querySelectorAll('.mobile-tab').forEach(b=>b.addEventListener('click',()=>setMobileView(b.dataset.mobileView)));
window.addEventListener('resize',()=>{if(window.innerWidth>820){closeMobileSidebar();document.body.classList.remove('mobile-view-terminal');}});

preparePrerequisites(currentTask);taskStartHistory=shell.history.length;printWelcome();renderAll();commandCursor=shell.history.length;setTimeout(()=>els.commandInput.focus(),60);
})();
