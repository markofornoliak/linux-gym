(function(root){
  'use strict';

  const BS=String.fromCharCode(92);
  const META=new Set('^$.*+?()[]{}|'.split(''));
  const escapeRegex=text=>[...String(text)].map(ch=>META.has(ch)?BS+ch:ch).join('');
  const canonicalPattern=example=>{
    const body=escapeRegex(String(example||'').trim()).replace(/ +/g,BS+'s+');
    return '^'+BS+'s*'+body+BS+'s*$';
  };

  const curriculum=root.LinuxGymData&&root.LinuxGymData.tasks;
  if(Array.isArray(curriculum)){
    for(const mission of curriculum){
      for(const check of mission.checks||[]){
        if(check.type==='command'){
          check.pattern=canonicalPattern(mission.example);
          check.flags='i';
        }
        if(check.type==='history'&&mission.id==='exams/exam-devops'){
          check.pattern='curl'+BS+'s+-s'+BS+'s+http://localhost/health';
          check.flags='i';
        }
      }
    }
  }

  const Shell=root.LinuxGymShell&&root.LinuxGymShell.VirtualShell;
  if(Shell){
    const originalHelp=Shell.prototype._cmd_help;
    if(originalHelp){
      Shell.prototype._cmd_help=function(...args){
        const response=originalHelp.apply(this,args);
        response.code=Number(response.code)||0;
        return response;
      };
    }
  }

  if(typeof window!=='undefined'){
    window.addEventListener('load',()=>{
      const close=document.getElementById('closeSidebarBtn');
      if(!close)return;
      close.addEventListener('click',()=>{
        if(window.innerWidth>820)return;
        document.body.classList.remove('mobile-view-terminal');
        document.querySelectorAll('.mobile-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.mobileView==='lesson'));
      });
    });
  }
})(typeof globalThis!=='undefined'?globalThis:window);
