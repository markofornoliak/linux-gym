(function(root){
  'use strict';

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
