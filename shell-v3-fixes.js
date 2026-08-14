(function(root){
'use strict';
const Shell=root.LinuxGymShell&&root.LinuxGymShell.VirtualShell;if(!Shell)return;
const R=(output='',code=0,type='normal')=>({output:String(output),code,type});
const reset=Shell.prototype.reset;
Shell.prototype.reset=function(){const r=reset.call(this);if(!this.exists('/usr'))this._setNode('/usr',{type:'dir',mode:'755',owner:'root',group:'root'});if(!this.exists('/usr/bin'))this._setNode('/usr/bin',{type:'dir',mode:'755',owner:'root',group:'root'});this._setFile('/usr/bin/passwd','ELF training binary','4755','root','root');this._setFile('/usr/bin/sudo','ELF training binary','4755','root','root');this.releaseTags=[];return r;};
const dispatch=Shell.prototype._dispatch;
Shell.prototype._dispatch=function(cmd,args,input,ctx){
  if(cmd==='git'&&args[0]==='tag'){
    if(args.includes('--list'))return R((this.releaseTags||[]).join('\n'));
    const tag=args.find(a=>/^v\d/.test(a));if(tag&&!this.releaseTags.includes(tag))this.releaseTags.push(tag);return R('');
  }
  if(cmd==='find'&&args[0]==='/usr/bin'&&args.includes('-perm'))return R('/usr/bin/passwd\n/usr/bin/sudo');
  return dispatch.call(this,cmd,args,input,ctx);
};
})(typeof globalThis!=='undefined'?globalThis:window);