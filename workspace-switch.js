'use strict';
/* App 与后台共用的本地演示外壳；切换不会提交任何线上请求。 */
(()=>{
 const main=document.querySelector('.viewer > main'),toolbar=document.querySelector('.tool-right'),sceneTitle=document.querySelector('#scene-title');
 if(!main||!toolbar||!window.ADMIN_UI||!window.ADMIN_NEW)return;
 let workspace='app',mounted=false,resetting=false,appTitle=sceneTitle.textContent,observer=null;
 const originalReset=document.querySelector('#reset').onclick,originalDirectory=document.querySelector('#toggle-directory').onclick;
 const switcher=document.createElement('div');switcher.className='workspace-switch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label','切换 App 和后台演示');
 switcher.innerHTML='<button type="button" data-workspace="app" aria-pressed="true" data-help-title="App 演示" data-help="查看原 App 界面与新增黑白灰流程。切换不会清除当前 App 操作状态。">App</button><button type="button" data-workspace="admin" aria-pressed="false" data-help-title="后台演示" data-help="查看现有后台的本地复刻及新增黑白灰页面，不操作线上后台数据。">后台</button>';
 toolbar.prepend(switcher);
 const adminWorkspace=document.createElement('section');adminWorkspace.id='admin-workspace';adminWorkspace.hidden=true;adminWorkspace.setAttribute('aria-label','后台本地演示');
 const adminView=document.createElement('div');adminView.id='admin-view';adminWorkspace.appendChild(adminView);main.insertBefore(adminWorkspace,main.querySelector(':scope > footer'));
 function syncTitle(){if(workspace!=='admin')return;const key=window.ADMIN_UI.current,info=window.ADMIN_UI.screens.find(s=>s.key===key);sceneTitle.textContent='后台 · '+(key==='admin-new-member'?'会员与订单查询 / 会员价格配置':info?.title||'管理系统');const content=adminWorkspace.querySelector('#admin-content');if(content&&!content.classList.contains('admin-wallpaper-creation')&&!window.ADMIN_NEW.screens.some(s=>s.key===key))content.classList.remove('admin-new');}
 function registerAndMount(view){
  const api=window.ADMIN_UI;
  api.register(window.ADMIN_NEW.screens,(key,root)=>window.ADMIN_NEW.render(key,root));
  window.ADMIN_NEW.onNavigate=key=>{window.ADMIN_UI.go(key);syncTitle();};
  api.mount(view);mounted=true;
  view.addEventListener('admin:screen',syncTitle);
  view.addEventListener('click',e=>{if(e.target.closest('[data-admin-action="collapse"]'))view.classList.toggle('workspace-admin-collapsed');});
  observer?.disconnect();observer=new MutationObserver(syncTitle);observer.observe(view,{childList:true,subtree:true});syncTitle();
 }
 function switchWorkspace(next,skipGuard=false){
  if(next===workspace||resetting)return;
  if(workspace==='app'&&window.NEW_UI?.requestPreparedRetryExit(()=>switchWorkspace(next,skipGuard)))return;
  if(!skipGuard&&window.WALLPAPER_EDITOR?.guardExit(()=>switchWorkspace(next,true)))return;
  if(!skipGuard&&window.MEMBER_CONFIG?.guardExit(()=>switchWorkspace(next,true)))return;
  window.FIELD_HELP?.close();
  if(next==='admin'){
   appTitle=sceneTitle.textContent;
   if(typeof stopTimer==='function')stopTimer();
   workspace='admin';document.body.dataset.workspace='admin';adminWorkspace.hidden=false;
   if(!mounted)registerAndMount(adminView);else syncTitle();
  }else{
   workspace='app';document.body.dataset.workspace='app';adminWorkspace.hidden=true;sceneTitle.textContent=appTitle;
   const scene=window.__DEMO__?.state?.screen;
   if(['splash','creating','ad-image','ad-video'].includes(scene)&&typeof render==='function')render();
   if(typeof fit==='function')requestAnimationFrame(fit);
  }
  for(const button of switcher.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.workspace===workspace));
  document.querySelector('#toggle-directory').setAttribute('aria-label',workspace==='admin'?'展开或收起后台侧栏':'展开或收起界面目录');
 }
 switcher.addEventListener('click',e=>{const button=e.target.closest('[data-workspace]');if(button)switchWorkspace(button.dataset.workspace);});
 document.querySelector('#toggle-directory').onclick=e=>{if(workspace==='app')originalDirectory?.(e);else adminWorkspace.querySelector('[data-admin-action="collapse"]')?.click();};
 function resetCurrentWorkspace(){
  if(workspace==='app'&&window.NEW_UI?.requestPreparedRetryExit(resetCurrentWorkspace))return;
  window.FIELD_HELP?.close();
  if(workspace==='app'){window.VIP_ACCESS?.reset();originalReset?.();return;}
  if(resetting)return;resetting=true;
  const button=document.querySelector('#reset');button.disabled=true;
  // 重新执行同一份本地后台脚本以恢复其闭包中的示例状态，App 状态保持不变。
  const loader=document.createElement('script');loader.src='admin.js?v=20261118-retry-photos';
  loader.onload=()=>{
   try{observer?.disconnect();const old=adminWorkspace.querySelector('#admin-view'),fresh=document.createElement('div');fresh.id='admin-view';old.replaceWith(fresh);registerAndMount(fresh);}
   finally{resetting=false;button.disabled=false;loader.remove();}
  };
  loader.onerror=()=>{resetting=false;button.disabled=false;sceneTitle.textContent='后台 · 本地脚本未能重新加载，请刷新页面';loader.remove();};
  document.body.appendChild(loader);
 }
 document.querySelector('#reset').onclick=()=>{if(window.WALLPAPER_EDITOR?.guardExit(resetCurrentWorkspace))return;if(window.MEMBER_CONFIG?.guardExit(resetCurrentWorkspace))return;resetCurrentWorkspace();};
 // 后台打开时，Esc 关闭字段说明或后台弹层，不触发隐藏的 App 返回。
 document.addEventListener('keydown',e=>{if(workspace!=='admin'||e.key!=='Escape'||document.querySelector('.field-help-popup'))return;e.stopImmediatePropagation();if(window.WALLPAPER_EDITOR?.handleEscape())return;if(window.MEMBER_CONFIG?.handleEscape())return;window.ADMIN_UI.closeOverlays();adminWorkspace.querySelectorAll('.an-modal-mask').forEach(x=>x.remove());},true);
 document.body.dataset.workspace='app';
 window.WORKSPACE_UI={switch:switchWorkspace,get current(){return workspace;},get admin(){return adminWorkspace;}};
})();
