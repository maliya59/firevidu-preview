/* VIP体验：本地演示的额外两次激励广告与共享日额度，不代替保存/去水印/设置广告。 */
(()=>{'use strict';
if(window.VIP_ACCESS)return;
const STORAGE='firevidu-vip-access-v1',SESSION='firevidu-vip-access-session-v1';
const ACCOUNT='demo-google-account',SCREEN='vip-experience',LIMIT=2,ADS=2;
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const H=(title,description)=>`data-help-title="${E(title)}" data-help="${E(description)}" data-help-status="已确认"`;
const copy=value=>JSON.parse(JSON.stringify(value));
const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const day=(time=Date.now())=>new Date(time+330*60000).toISOString().slice(0,10);
let flow=null,login=null,quotaFocus=null;
let session={template:{id:'ordinary-image',type:'image',vip:false,title:''},templateAttempt:null,wallpaper:{id:'official',type:'static',vip:false,title:''}};
try{const saved=JSON.parse(sessionStorage.getItem(SESSION)||'null');if(saved&&typeof saved==='object')session={...session,...saved};}catch{}

function state(){return window.__DEMO__?.state||{};}
function logged(){return state().logged===true;}
function isMember(){const member=window.NEW_UI?.member;return logged()&&member?.active===true&&Number(member.expiry)>Date.now();}
function normalize(meta={},domain='template'){
 const raw=String(meta.type||'');
 const type=domain==='template'?(raw==='video'?'video':'image'):
  ['motion','3D','3d','wallpaper3d','体感'].includes(raw)?'motion':['video','wallpaper-video','视频'].includes(raw)?'video':'static';
 return {id:String(meta.id??(domain==='template'?'ordinary-'+type:'official')),type,vip:meta.vip===true,title:String(meta.title||'')};
}
session.template=normalize(session.template,'template');session.wallpaper=normalize(session.wallpaper,'wallpaper');
function saveSession(){try{sessionStorage.setItem(SESSION,JSON.stringify(session));}catch{}}
function readStore(){
 let store={version:1,accounts:{}};
 try{const value=JSON.parse(localStorage.getItem(STORAGE)||'null');if(value&&typeof value==='object')store={...store,...value,accounts:value.accounts&&typeof value.accounts==='object'?value.accounts:{}};}catch{}
 return store;
}
function account(store){
 const old=store.accounts[ACCOUNT],today=day();
 const row=old&&typeof old==='object'?{...old}:{day:today,count:0};
 if(row.day!==today){row.day=today;row.count=0;}
 row.count=Number.isSafeInteger(row.count)&&row.count>=0?row.count:0;
 row.templateGrants=row.templateGrants&&typeof row.templateGrants==='object'?row.templateGrants:{};
 row.wallpaperGrants=row.wallpaperGrants&&typeof row.wallpaperGrants==='object'?row.wallpaperGrants:{};
 store.accounts[ACCOUNT]=row;return row;
}
function writeStore(store){try{localStorage.setItem(STORAGE,JSON.stringify(store));return true;}catch{return false;}}
function navigate(key,record=false){try{if(typeof go==='function'){go(key,record);return;}}catch(error){throw error;}}
function explain(message){if(typeof status==='function')status(message);}
function registerScreen(){try{if(typeof titles!=='undefined')titles[SCREEN]='体验VIP功能';}catch{}}
function resolvedMeta(meta,domain){
 const result=normalize(meta,domain);
 if(window.VIP_FLAGS?.isVip)result.vip=window.VIP_FLAGS.isVip(domain,result.id,result.vip)===true;
 return result;
}
function currentMeta(domain){
 if(domain==='template')return resolvedMeta(session.template,'template');
 const asset=window.NEW_UI?.context?.wallpaperAsset;
 // 非VIP自定义壁纸等入口仍走原规则，不能继承刚浏览过的VIP壁纸。
 if(asset&&String(asset)!==session.wallpaper.id)return resolvedMeta({id:asset,type:window.NEW_UI?.context?.wallpaperMode,vip:false},'wallpaper');
 return resolvedMeta(session.wallpaper,'wallpaper');
}
function authorized(request){
 if(!logged())return false;
 const row=account(readStore());
 const grant=request.domain==='template'?row.templateGrants[session.templateAttempt]:row.wallpaperGrants[request.meta.id];
 return Boolean(grant&&grant.resourceId===request.meta.id&&grant.account===ACCOUNT&&grant.trial===true);
}
function sameRequest(left,right){return left&&right&&left.domain===right.domain&&left.kind===right.kind&&left.meta.id===right.meta.id;}
function stillSelected(request){return currentMeta(request.domain).id===request.meta.id;}
function clearLogin(){
 const old=login;login=null;
 if(old&&window.NEW_UI?.context?.afterLogin===old.resume)window.NEW_UI.context.afterLogin=null;
}
function cancelLogin(){
 const old=login;if(!old)return;clearLogin();
 if(state().screen===old.request.origin&&state().modal==='login'){
  if(typeof closeModal==='function')closeModal(false);
  if(typeof updateDirectory==='function')updateDirectory();if(typeof fit==='function')fit();
 }
 if(old.request.domain==='template'&&flow?.request===old.request)drawCurrent();
}
function cancelFlow(destination){
 const old=flow;if(!old)return;old.cancelled=true;flow=null;removeTemplateSheet();
 if(destination!==false&&state().screen!==old.request.origin)navigate(destination||old.request.origin,false);
 if(old.restoreFocus?.isConnected)old.restoreFocus.focus?.({preventScroll:true});
}
function requestLogin(request,intent='trial'){
 clearLogin();
 const pending={request};
 pending.resume=()=>{
  if(login!==pending)return;
  clearLogin();
  if(!logged()||state().screen!==request.origin||!stillSelected(request))return;
  if(request.domain==='template'&&flow?.request===request){if(isMember()){const active=flow;flow=null;removeTemplateSheet();if(active.request.kind==='create'){session.templateAttempt=null;saveSession();}request.proceed();}else if(intent==='member')openMembership(flow);else chooseTemplateTrial(flow);}else continueRequest(request);
 };
 login=pending;
 if(request.domain==='template')removeTemplateSheet();
 if(window.NEW_UI?.context)window.NEW_UI.context.afterLogin=pending.resume;
 if(typeof openModal==='function')openModal('login');
 else{clearLogin();explain('请先使用Google登录。');}
}
function closeQuota(){
 document.querySelector('.vip-access-dialog-mask')?.remove();
 if(quotaFocus?.isConnected)quotaFocus.focus?.({preventScroll:true});quotaFocus=null;
}
function showQuota(origin=state().screen){
 if(state().screen===SCREEN)navigate(origin||'home',false);
 closeQuota();const host=document.querySelector('#screen');if(!host)return;
 quotaFocus=document.activeElement;
 const mask=document.createElement('div');mask.className='vip-access-dialog-mask';
 mask.innerHTML=`<section class="vip-access-dialog" role="dialog" aria-modal="true" aria-label="今日使用额度已用完"><h2 ${H('今日使用额度已用完','普通用户今日体验额度已经用完；未发起新任务，不会再播放体验广告。')}>今日使用额度已用完</h2><p>开通VIP后可继续使用。</p><div><button type="button" data-vip-access="quota-close" ${H('返回','关闭提示，保留当前预览。')}>返回</button><button type="button" class="vip-primary" data-vip-access="quota-member" ${H('开通VIP','进入会员套餐页面；本地演示不会发起真实付款。')}>开通VIP</button></div></section>`;
 host.appendChild(mask);
 mask.onclick=event=>{const action=event.target.closest('[data-vip-access]')?.dataset.vipAccess;if(event.target===mask||action==='quota-close')closeQuota();else if(action==='quota-member'){closeQuota();navigate('new-member',true);}};
 mask.querySelector('button')?.focus();
}
function removeTemplateSheet(){document.querySelector('.vip-template-choice-mask')?.remove();}
function openMembership(active){
 if(flow!==active||active.watching||active.launching)return;
 if(!logged()){requestLogin(active.request,'member');return;}
 active.returnPhase=active.phase;active.phase='member';removeTemplateSheet();navigate('new-member',true);
}
function chooseTemplateTrial(active){
 if(flow!==active||active.watching||active.launching)return;
 if(isMember()){flow=null;removeTemplateSheet();if(active.request.kind==='create'){session.templateAttempt=null;saveSession();}active.request.proceed();return;}
 if(!logged()){requestLogin(active.request,'trial');return;}
 if(account(readStore()).count>=LIMIT){active.error='今日体验次数已用完，开通VIP后可继续使用。';drawCurrent();return;}
 active.phase='ads';watchAd(active);
}
function drawTemplateSheet(root){
 const active=flow;if(!active||active.request.domain!=='template'||!logged()||state().screen!==active.request.origin||state().modal||active.phase==='member')return;
 if(active.photos?.length&&!root.querySelector('.new-photo'))for(const photo of active.photos)root.append(photo.cloneNode(true));
 removeTemplateSheet();const full=logged()&&account(readStore()).count>=LIMIT,progress=active.phase==='ads';
 const mask=document.createElement('div');mask.className='vip-template-choice-mask';mask.innerHTML=`<section class="vip-template-choice-sheet" role="dialog" aria-modal="true" aria-label="选择VIP模板使用方式"><header><h2 ${H('使用VIP模板','未开通VIP时，可选择开通VIP或观看额外两次激励广告体验本次。')}>使用VIP模板</h2><button type="button" data-vip-choice="close" aria-label="关闭VIP使用方式">×</button></header><p class="vip-template-choice-name" ${H('模板名称','这里对应本次选择的模板，原型用（模板名称）占位。')}>（模板名称）</p><p>开通VIP直接使用，或连续观看2条激励广告体验本次。</p>${progress?`<div class="vip-ad-progress" ${H('体验广告进度','完整看完两次额外激励广告后才开始本次体验，不能用券抵扣。')}><div aria-hidden="true">${[0,1].map(i=>`<i class="${active.completed>i?'done':''}"></i>`).join('')}</div><span>已完成 ${active.completed} / 2 次广告</span></div>`:''}${full?'<p class="vip-template-quota">今日体验次数已用完，开通VIP后可继续使用。</p>':''}${active.error?`<p class="vip-error" role="alert">${E(active.error)}</p>`:''}<button type="button" class="vip-primary" data-vip-choice="member" ${active.watching||active.launching?'disabled':''} ${H('开通VIP','进入会员中心选择套餐；已选模板和照片保留，未付款不改变权益。')}>开通VIP</button><button type="button" class="vip-template-trial" data-vip-choice="trial" ${full||active.watching||active.launching?'disabled':''} ${H('看广告体验本次','主动选择后才播放两次额外激励广告。完整解锁并实际发起任务才计一次体验；关闭弹窗不扣次。')}>${full?'今日体验次数已用完':active.launching?'正在进入…':active.watching?'广告播放中…':active.completed>=ADS?'重试进入':progress&&active.completed?'继续观看激励广告':'看广告体验本次'}</button><button type="button" class="vip-template-cancel" data-vip-choice="close">暂不使用</button></section>`;
 mask.onclick=event=>{event.stopPropagation();const action=event.target.closest('[data-vip-choice]')?.dataset.vipChoice;if(event.target===mask||action==='close')cancelFlow(false);else if(action==='member')openMembership(active);else if(action==='trial')chooseTemplateTrial(active);};
 mask.onkeydown=event=>{if(event.key!=='Tab')return;const controls=[...mask.querySelectorAll('button:not(:disabled)')],first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}};
 root.append(mask);mask.querySelector('[data-vip-choice="member"]')?.focus({preventScroll:true});
}
function resumeTemplateMembership(active){
 if(flow!==active||active.request.domain!=='template'||!stillSelected(active.request))return;
 navigate(active.request.origin,false);
}
function experienceAdEnabled(domain){return !window.AD_CONFIG||window.AD_CONFIG.isEnabled(domain==='wallpaper'?'VIP壁纸体验激励广告':'VIP模板体验激励广告','regular');}
function beginFlow(request,skipAds=false){
 if(flow)cancelFlow(false);
 flow={id:uid(),request,completed:request.domain==='template'?0:skipAds?ADS:0,watching:false,launching:false,cancelled:false,error:'',phase:'choice',restoreFocus:document.activeElement,photos:request.domain==='template'?[...document.querySelectorAll('#screen .new-photo')].map(el=>el.cloneNode(true)):[]};
 if(request.domain==='template'){drawCurrent();return;}
 if(skipAds){finishTrialAds(flow);return;}registerScreen();navigate(SCREEN,false);
}
function continueRequest(request){
 if(!stillSelected(request))return;
 if(!currentMeta(request.domain).vip||isMember()){
  if(request.kind==='create'){session.templateAttempt=null;saveSession();}
  request.proceed();return;
 }
 if(request.kind!=='create'&&authorized(request)){request.proceed();return;}
 if(!logged()){requestLogin(request);return;}
 if(request.domain==='template'){beginFlow(request);return;}
 if(account(readStore()).count>=LIMIT){showQuota(request.origin);return;}
 beginFlow(request,!experienceAdEnabled(request.domain));
}
function before(kind,domain,proceed,mode){
 if(typeof proceed!=='function')return false;
 const meta=copy(currentMeta(domain));
 // 成功设置过的同一壁纸按历史记录复用已获得的模式资格，不再重复收取VIP体验广告。
 if(domain==='wallpaper'&&window.WALLPAPER_V2?.allowBypass(meta.id,mode))return false;
 if(!meta.vip||isMember()){
  if(kind==='create'){session.templateAttempt=null;saveSession();}
  return false;
 }
 const request={id:uid(),kind,domain,meta,mode,origin:state().screen||'home',proceed};
 if(login&&sameRequest(login.request,request))return true;
 if(flow&&sameRequest(flow.request,request))return true;
 if(logged()&&kind!=='create'&&authorized(request))return false;
 continueRequest(request);return true;
}
function rollbackLaunch(id,domain,resourceId,chargedDay){
 const store=readStore(),row=account(store);
 const grant=domain==='template'?row.templateGrants[id]:row.wallpaperGrants[resourceId];
 if(!grant||grant.id!==id)return;
 if(domain==='template')delete row.templateGrants[id];else delete row.wallpaperGrants[resourceId];
 if(row.day===chargedDay)row.count=Math.max(0,row.count-1);
 writeStore(store);
 if(session.templateAttempt===id){session.templateAttempt=null;saveSession();}
}
function commitLaunch(active){
 if(flow!==active||active.cancelled||!stillSelected(active.request))return;
 const request=active.request;
 if(!logged()){cancelFlow();requestLogin(request);return;}
 if(!currentMeta(request.domain).vip||isMember()){
  flow=null;removeTemplateSheet();if(request.kind==='create'){session.templateAttempt=null;saveSession();}
  if(state().screen!==request.origin)navigate(request.origin,false);
  request.proceed();return;
 }
 const store=readStore(),row=account(store);
 if(row.count>=LIMIT){flow=null;removeTemplateSheet();if(state().screen!==request.origin)navigate(request.origin,false);showQuota(request.origin);return;}
 const id='trial-'+uid(),grant={id,account:ACCOUNT,resourceId:request.meta.id,trial:true,mode:request.mode||request.meta.type,startedAt:Date.now(),day:row.day,failed:false};
 row.count++;
 if(request.domain==='template')row.templateGrants[id]=grant;else row.wallpaperGrants[request.meta.id]=grant;
 if(!writeStore(store)){
  active.launching=false;active.error='暂时无法保存体验状态，请重试。';
  const retryPage=request.domain==='template'?request.origin:SCREEN;
  if(state().screen!==retryPage)navigate(retryPage,false);
  drawCurrent();return;
 }
 if(request.domain==='template'){session.templateAttempt=id;saveSession();}
 flow=null;removeTemplateSheet();
 try{
  // 先恢复原页面，后续制作和保存可沿用正常返回路径。
  if(state().screen!==request.origin)navigate(request.origin,false);
  request.proceed(request.domain==='template'&&request.kind==='create'?{skipInterstitial:true}:undefined);
 }
 catch{
  rollbackLaunch(id,request.domain,request.meta.id,grant.day);
  flow=active;active.launching=false;active.error='暂时无法开始体验，请重试。';if(request.domain==='template')navigate(request.origin,false);else navigate(SCREEN,false);
 }
}
async function launch(active){
 if(flow!==active||active.launching||active.completed<ADS)return;
 active.launching=true;active.error='';drawCurrent();
 let entered=false;
 try{
  if(navigator.locks?.request){await navigator.locks.request(STORAGE+':'+ACCOUNT,()=>{entered=true;commitLaunch(active);});}
  else{entered=true;commitLaunch(active);}
 }catch{
  if(!entered)commitLaunch(active);
  else if(flow===active){active.launching=false;active.error='暂时无法开始体验，请重试。';drawCurrent();}
 }
}
function finishTrialAds(active){
 const {request}=active;
 const placement=request.domain==='wallpaper'?'vip-wallpaper-interstitial':request.kind==='create'?'image-create-interstitial':null;
 if(!placement||active.interstitialClosed||window.AD_CONFIG?.isEnabled(placement,'regular')===false){launch(active);return;}
 active.watching=true;
 playAd(()=>{
  if(flow!==active||!stillSelected(request))return;
  active.watching=false;
  active.interstitialClosed=true;
  launch(active);
 },request.origin,'interstitial',{label:'插页广告'});
}
function watchAd(active){
 if(flow!==active||active.watching||active.launching)return;
 if(!currentMeta(active.request.domain).vip||isMember()){
  flow=null;removeTemplateSheet();if(state().screen!==active.request.origin)navigate(active.request.origin,false);continueRequest(active.request);return;
 }
 const isTemplate=active.request.domain==='template';
 if(!logged()){cancelFlow();requestLogin(active.request);return;}
 if(!experienceAdEnabled(active.request.domain))active.completed=ADS;
 if(active.completed>=ADS){finishTrialAds(active);return;}
 active.watching=true;active.error='';
 if(isTemplate)removeTemplateSheet();else drawCurrent();
 if(typeof playAd!=='function'){active.watching=false;active.error='广告暂时不可用，请稍后重试。';drawCurrent();return;}
 const trial={
  label:'激励广告 '+(active.completed+1)+' / '+ADS,
  autoAdvance:active.completed+1<ADS,
  cancel:()=>cancelFlow()
 };
 let settled=false;
 try{playAd(()=>{
  if(settled)return;settled=true;
  if(flow!==active||active.cancelled||!stillSelected(active.request))return;
  active.watching=false;active.completed++;
  watchAd(active);
 },active.request.origin,'rewarded',trial);}catch{
  active.watching=false;active.error='广告暂时不可用，请稍后重试。';
  const retryPage=isTemplate?active.request.origin:SCREEN;
  if(state().screen!==retryPage)navigate(retryPage,false);
  drawCurrent();
 }
}
function drawCurrent(){const root=document.querySelector('#screen');if(!root)return;if(flow?.request.domain==='template'){drawTemplateSheet(root);return;}if(state().screen===SCREEN)draw(root);}
function draw(root){
 const active=flow,meta=active?.request.meta;
 const title=meta?.title||(active?.request.domain==='wallpaper'?'VIP壁纸':'VIP模板');
 root.classList.add('vip-access');
 root.innerHTML=`<section class="vip-screen"><div class="vip-status-bar"><span>9:41</span><span aria-hidden="true">▂▄▆ ▰</span></div><header class="vip-header"><button type="button" data-vip-access="back" aria-label="返回" ${H('返回','退出本次尚未开始的体验，不扣除体验次数。')}>‹</button><h1 ${H('体验VIP功能','普通用户通过额外两次激励广告体验本次VIP内容，实际VIP可直接使用。')}>体验VIP功能</h1></header><main class="vip-body">${active?`<div class="vip-item-preview" ${H(title,'当前准备体验的VIP内容。体验资格只用于本次内容，不替代保存、去水印或设置壁纸的原有解锁规则。')}><span>VIP</span><strong>${E(title)}</strong></div><p class="vip-intro" ${H('体验方式','两次广告必须实际完成，不能使用通用券或去水印券代替。')}>连续观看2条激励广告。关闭随后出现的插页后，继续设置壁纸。</p><div class="vip-ad-progress" ${H('体验广告进度','完整看完两次激励广告后才开始本次体验；不能使用免广告券抵扣。')}><div aria-hidden="true">${[0,1].map(index=>`<i class="${active.completed>index?'done':''}"></i>`).join('')}</div><span>已完成 ${active.completed} / 2 次广告</span></div>${active.error?`<p class="vip-error" role="alert">${E(active.error)}</p>`:''}<button type="button" class="vip-primary vip-start" data-vip-access="watch" ${active.watching||active.launching?'disabled':''} ${H('体验VIP功能','每次体验前实际完成两次激励广告。本次开始后，保存、去水印和壁纸设置仍按原有规则解锁。')}>${active.launching?'正在进入…':active.completed>=ADS?'重试':active.completed?'继续观看激励广告':'观看激励广告'}</button><button type="button" class="vip-cancel" data-vip-access="back" ${H('暂不体验','返回本次体验前的页面，不扣除尚未发起任务的体验次数。')}>暂不体验</button>`:'<p>本次体验已结束。</p><button type="button" class="vip-primary vip-start" data-vip-access="back">返回</button>'}</main><div class="vip-home-indicator" aria-hidden="true"></div></section>`;
 const phone=document.querySelector('#phone');if(phone)phone.dataset.height='812';
 root.onclick=event=>{const action=event.target.closest('[data-vip-access]')?.dataset.vipAccess;if(action==='back'){if(flow)cancelFlow();else navigate('home',false);}else if(action==='watch'&&flow)watchAd(flow);};
 root.oninput=null;root.onchange=null;
}
function render(key,root){
 if(login&&key!==login.request.origin)clearLogin();
 if(flow?.request.domain==='template'){
  const active=flow,memberPages=['new-member','new-member-sync','new-member-active','new-billing-policy','new-service-terms'];
  if(key===active.request.origin){
   if(active.phase==='member'&&isMember()){flow=null;Promise.resolve().then(()=>{if(state().screen===active.request.origin&&stillSelected(active.request)){if(active.request.kind==='create'){session.templateAttempt=null;saveSession();}active.request.proceed();}});}
   else{if(active.phase==='member')active.phase=active.returnPhase||'choice';Promise.resolve().then(()=>{if(flow===active)drawCurrent();});}
  }else if(active.phase==='member'&&memberPages.includes(key)){
   if(key==='new-member-active')Promise.resolve().then(()=>{if(flow!==active||!isMember()||state().screen!==key)return;const body=root.querySelector('.confirmed-body');if(!body||body.querySelector('[data-vip-resume]'))return;const button=document.createElement('button');button.type='button';button.className='confirmed-button primary-gray';button.dataset.vipResume='true';button.textContent='继续使用此VIP模板';button.onclick=()=>resumeTemplateMembership(active);body.prepend(button);});
  }else if(!['ad-image','ad-video'].includes(key))cancelFlow(false);
  root.classList.remove('vip-access');return false;
 }
 if(flow&&![SCREEN,'ad-image','ad-video'].includes(key))cancelFlow(false);
 if(key!==SCREEN){root.classList.remove('vip-access');return false;}
 registerScreen();draw(root);return true;
}

function enhanceModal(key,sheet){
 if(key!=='login'||!login)return;
 const cancel=event=>{event?.stopPropagation();cancelLogin();};
 const mask=sheet.parentElement?.querySelector('.modal-mask');if(mask)mask.onclick=cancel;
 const google=sheet.querySelector('[data-action="Continue with Google"]');
 if(!google){for(const button of sheet.querySelectorAll('[data-action="关闭"],[data-action="关闭登录弹窗"]'))button.onclick=cancel;return;}
 const domain=login.request.domain==='wallpaper'?'壁纸':'模板';
 sheet.classList.add('vip-login-sheet');sheet.dataset.vipLoginDomain=login.request.domain;
 sheet.style.cssText='left:0;top:auto;bottom:0;width:375px;height:auto;max-height:calc(100% - 40px)';
 sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','vip-login-title');
 sheet.innerHTML=`<button type="button" class="vip-login-close" data-vip-login="cancel" aria-label="关闭VIP登录提示" ${H('暂不登录','关闭提示，保留当前'+domain+'和已选择照片，不扣除VIP体验次数。')}>×</button><h2 id="vip-login-title">登录后使用VIP${domain}</h2><p class="vip-login-intro">普通${domain}无需登录，VIP${domain}需登录识别账号权益。</p><div class="vip-login-entitlements"><p><strong>已开通VIP</strong><span>登录后直接使用，无需重复购买。</span></p><p><strong>未开通VIP</strong><span>${login.request.domain==='template'?'登录后可选择开通VIP，或看广告体验本次。':'登录后可观看广告体验，无需先购买。'}</span></p></div><div class="vip-login-actions"></div><button type="button" class="vip-login-cancel" data-vip-login="cancel">暂不登录</button>`;
 // Keep the original Google action and its existing login/resume behavior.
 google.className='vip-login-google';google.style.cssText='';google.textContent='Google 登录';google.setAttribute('aria-label','Google 登录');
 google.dataset.helpTitle='Google 登录';google.dataset.help=login.request.domain==='template'?'先登录识别账号VIP权益；有效VIP继续原任务，未开通时再显示开通VIP或看广告体验的选择弹窗。登录本身不付款，也不播放广告。':'识别当前账号的VIP权益；已开通VIP直接使用，未开通VIP继续原广告体验流程，不会由登录动作发起购买。';google.dataset.helpStatus='已确认';
 sheet.querySelector('.vip-login-actions').appendChild(google);
 for(const button of sheet.querySelectorAll('[data-vip-login="cancel"]'))button.onclick=cancel;
 google.focus?.({preventScroll:true});
}
function selectTemplate(meta){
 const next=normalize(meta,'template');
 if(flow)cancelFlow(false);clearLogin();closeQuota();
 session.template=next;session.templateAttempt=null;saveSession();return copy(next);
}
function selectWallpaper(meta){
 const next=normalize(meta,'wallpaper');
 if(flow&&flow.request.domain==='wallpaper'&&flow.request.meta.id!==next.id)cancelFlow(false);
 if(login&&login.request.domain==='wallpaper'&&login.request.meta.id!==next.id)clearLogin();
 session.wallpaper=next;saveSession();return copy(next);
}
function wallpaperOutcome(outcome,asset,mode){
 const id=String(asset||currentMeta('wallpaper').id),store=readStore(),row=account(store),grant=row.wallpaperGrants[id];
 if(!grant)return;
 if(outcome==='failure'){grant.failed=true;grant.mode=mode||grant.mode;grant.failedAt=Date.now();}
 else if(outcome==='cancel'||outcome==='success')delete row.wallpaperGrants[id];
 else return;
 writeStore(store);
}
function reset(){
 if(flow)cancelFlow(false);clearLogin();closeQuota();
 const store=readStore();delete store.accounts[ACCOUNT];writeStore(store);
 session={template:normalize({},'template'),templateAttempt:null,wallpaper:normalize({},'wallpaper')};saveSession();
}
function getState(){
 const row=account(readStore());
 return copy({account:ACCOUNT,day:row.day,used:row.count,limit:LIMIT,template:currentMeta('template'),templateAttempt:session.templateAttempt,
  templateAuthorized:authorized({domain:'template',meta:currentMeta('template')}),wallpaper:currentMeta('wallpaper'),wallpaperGrants:row.wallpaperGrants,
  flow:flow?{id:flow.id,kind:flow.request.kind,domain:flow.request.domain,resourceId:flow.request.meta.id,phase:flow.phase,adsCompleted:flow.completed,watching:flow.watching,launching:flow.launching}:null,pendingLogin:Boolean(login)});
}
window.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||document.body.dataset.workspace==='admin'||document.querySelector('.field-help-popup'))return;
 if(document.querySelector('.vip-access-dialog-mask')){event.preventDefault();event.stopImmediatePropagation();closeQuota();return;}
 if(login&&state().modal==='login'){event.preventDefault();event.stopImmediatePropagation();cancelLogin();return;}
 if(flow&&(state().screen===SCREEN||flow.request.domain==='template'&&state().screen===flow.request.origin)){event.preventDefault();event.stopImmediatePropagation();cancelFlow();}
},true);
const API={selectTemplate,selectWallpaper,
 openTemplate(meta){const normalized=normalize(meta,'template');if(typeof start==='function')start(normalized.type,normalized);},
 beforeCreate:proceed=>before('create','template',proceed),beforeResultAction:proceed=>before('result','template',proceed),
 beforeWallpaper:(mode,proceed)=>before('wallpaper','wallpaper',proceed,mode),wallpaperOutcome,render,enhanceModal,isMember,getState,reset,
 getTemplate(){return copy(currentMeta('template'));},getWallpaper(){return copy(currentMeta('wallpaper'));},
 get currentTemplate(){return copy(currentMeta('template'));},get currentWallpaper(){return copy(currentMeta('wallpaper'));},
 get state(){return getState();}};
window.VIP_ACCESS=API;registerScreen();
})();
