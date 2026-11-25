'use strict';
(()=>{
const W=window.NEW_SCREENS;
W['new-coupon-records']={...W['new-coupons'],title:'券记录',commands:W['new-coupons'].commands.map(c=>({...c,text:c.text==='我的券'?'券记录':c.text}))};
let context={materials:[],materialCategory:0,origin:'complete',kind:'save',needed:1,used:0,progress:0,choice:'ad',wallpaperMode:'static',feedbackType:'',feedbackText:'',feedbackOrigin:'complete',retryOrigin:'complete',retryCount:0};
const DEMO_STORAGE='firevidu-confirmed-demo-20261117';
let pendingFeedbackLogin=null;
let preparedRetry=null;
let retryExitDialog=null;
const istDay=(time=Date.now())=>new Date(time+330*60000).toISOString().slice(0,10);
const endOfDay=()=>Date.parse(istDay()+'T00:00:00+05:30')+86400000;
function nextMonth(time=Date.now(),months=1){const d=new Date(time+330*60000),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.getTime()-330*60000;}
const COUPON_ACCOUNT='demo-google-account';
function initialCouponBatches(){const at=Date.now();return [{id:'demo-general',type:'general',count:2,issuedCount:2,expiry:at+15*86400000,grantedAt:at,accountId:COUPON_ACCOUNT,source:'邀请奖励（本地示例）'},{id:'demo-watermark',type:'watermark',count:1,issuedCount:1,expiry:at+15*86400000,grantedAt:at,accountId:COUPON_ACCOUNT,source:'好友注册奖励（本地示例）'}];}
let couponBatches=initialCouponBatches();
let member={active:false,plan:'month',expiry:0,daily:'',benefitsVersion:2,issuedCycles:[],payment:null},ledger=[],wallet={general:0,watermark:0},pendingWallpaper={},lastSaveSpend=[],invitationRows=[];
try{const v=JSON.parse(localStorage.getItem(DEMO_STORAGE)||'null');if(v){couponBatches=v.couponBatches||couponBatches;member=v.member||member;ledger=v.ledger||[];pendingWallpaper=v.pendingWallpaper||{};context.retryDay=v.retryDay;context.retryCount=v.retryCount||0;invitationRows=Array.isArray(v.invitationRows)?v.invitationRows:[];}}catch{}
function remember(){try{localStorage.setItem(DEMO_STORAGE,JSON.stringify({couponBatches,member,ledger,pendingWallpaper,invitationRows,retryDay:context.retryDay,retryCount:context.retryCount}));}catch{}}
function grant(type,count,expiry,source,details={}){const at=Number.isFinite(details.at)?details.at:Date.now(),id=Date.now()+'-'+Math.random().toString(36).slice(2),cycle=details.cycleId?{cycleId:details.cycleId}:{};couponBatches.push({id,type,count,issuedCount:count,expiry,source,grantedAt:at,accountId:COUPON_ACCOUNT,...cycle});ledger.unshift({id:'grant-'+id,accountId:COUPON_ACCOUNT,batchId:id,type:type==='general'?'通用券':'去水印专用券',n:count,purpose:source,source,expiry,kind:'发放',sign:'+',at,...cycle});remember();}
function publishedMemberRules(){return window.MEMBER_CONFIG?.getPublished()||window.MEMBER_BENEFITS.normalize({});}
function activeMemberRules(){return member.entitlements||{weeklyCount:7,monthlyCount:30,firstCount:30,dailyCount:3,version:'demo-v2'};}
function migrateMemberBenefits(){
 if(member.benefitsVersion===2)return;
 const legacy=ledger.find(row=>row.sign==='+'&&row.purpose==='首次开通会员'&&Number.isFinite(row.at));
 member.issuedCycles=Array.isArray(member.issuedCycles)?member.issuedCycles:[];
 member.entitlements={...member.entitlements,weeklyCount:7,monthlyCount:30,firstCount:30,dailyCount:member.entitlements?.dailyCount??3};
 if(legacy&&Number.isFinite(member.expiry)&&member.expiry>legacy.at){member.payment={id:'legacy-'+legacy.at,paidAt:legacy.at,plan:member.plan,expiresAt:member.expiry};member.payments=[member.payment];member.issuedCycles.push(member.payment.id+':0');member.monthlyAt=legacy.at;}
 member.benefitsVersion=2;remember();
}
function syncMemberPeriods(now=Date.now()){
 const summary=window.MEMBERSHIP_PERIODS.summary(member,now),current=summary.current;
 member.active=Boolean(current);member.expiry=summary.expiry||summary.latest?.expiresAt||0;
 if(current){member.payment=current;member.plan=current.plan;member.entitlements=current.entitlements||member.entitlements||publishedMemberRules();}
 return summary;
}
function issueMemberMonthly(now){
 if(!state.logged||!member.active)return;const cycle=window.MEMBERSHIP_PERIODS.monthlyCycle(member.payment,now);
 if(!cycle||(member.issuedCycles||[]).includes(cycle.cycleId))return;
 member.issuedCycles=[...(member.issuedCycles||[]),cycle.cycleId];member.monthlyAt=cycle.at;
 const weekly=member.payment.plan==='week',count=window.MEMBER_BENEFITS.periodCount(member.payment,cycle);if(count>0)grant('general',count,cycle.expiry,weekly?'7天会员赠券':'会员每月赠券',{at:cycle.at,cycleId:cycle.cycleId});else remember();
}
function memberPaymentConfirmed(now=Date.now()){return Boolean(window.MEMBERSHIP_PERIODS.summary(member,now).current);}
function refreshWallet(){const now=Date.now();for(const b of couponBatches.filter(b=>b.cycleId?.startsWith('renewal:')&&!b.recalled)){const p=window.MEMBERSHIP_PERIODS.history(member).find(p=>'renewal:'+p.id===b.cycleId);if(p&&window.MEMBERSHIP_PERIODS.revoked(p)){b.recalled=true;const n=b.count;b.count=0;if(n)ledger.unshift({id:'recall-'+b.id,accountId:COUPON_ACCOUNT,batchId:b.id,n,type:'通用券',purpose:'退款回收提前续费奖励',source:b.source,kind:'回收',sign:'−',at:now,expiry:b.expiry});remember();}}migrateMemberBenefits();syncMemberPeriods(now);issueMemberMonthly(now);const daily=state.logged&&member.active?window.MEMBER_BENEFITS.daily(member.payment,now):null;if(daily&&member.daily!==istDay()){member.daily=istDay();if(daily.count>0)grant('general',daily.count,daily.expiry,'会员每日权益',{at:daily.at,cycleId:daily.id});else remember();}wallet.general=couponBatches.filter(b=>b.type==='general'&&b.expiry>now).reduce((a,b)=>a+b.count,0);wallet.watermark=couponBatches.filter(b=>b.type==='watermark'&&b.expiry>now).reduce((a,b)=>a+b.count,0);if(!state.logged){wallet.general=0;wallet.watermark=0;}if(context.retryDay!==istDay()){context.retryDay=istDay();context.retryCount=0;remember();}}

function spend(type,count,purpose){refreshWallet();if(!Number.isInteger(count)||count<0||!['general','watermark'].includes(type)||count>wallet[type])return null;if(purpose==='保存')purpose=({standard:'普通',hd:'高清',uhd:'超清'}[state.quality]||'')+'保存';if(purpose==='设置壁纸')purpose='设置'+({static:'静态',video:'视频',motion:'3D'}[context.wallpaperMode]||'')+'壁纸';let left=count;const used=[],id='use-'+Date.now()+'-'+Math.random().toString(36).slice(2);for(const b of [...couponBatches].filter(b=>b.type===type&&b.expiry>Date.now()).sort((a,b)=>a.expiry-b.expiry)){const n=Math.min(left,b.count);if(n){b.count-=n;used.push({...b,count:n,spendId:id});left-=n;}if(!left)break;}if(count)ledger.unshift({id,accountId:COUPON_ACCOUNT,type:type==='general'?'通用券':'去水印专用券',n:count,purpose,source:[...new Set(used.map(b=>b.source))].join('、'),batches:used.map(b=>({id:b.id,source:b.source,count:b.count,expiry:b.expiry,returnedCount:0})),kind:'使用',sign:'−',at:Date.now(),returned:0,...(context.kind==='wallpaper'?{resourceId:context.wallpaperAsset,target:context.wallpaperTarget}:{})});refreshWallet();remember();return used;}
function returnCoupons(batches){for(const b of batches){const entry=ledger.find(x=>x.id===b.spendId),part=entry?.batches?.find(x=>x.id===b.id),returnId='return-'+(b.spendId||'legacy')+'-'+b.id;if(ledger.some(x=>x.id===returnId))continue;const n=Math.min(b.count,part?Math.max(0,part.count-(part.returnedCount||0)):b.count);if(!n)continue;const original=couponBatches.find(x=>x.id===b.id);if(original)original.count+=n;else{const {spendId,...rest}=b;couponBatches.push({...rest,count:n});}if(entry){entry.returned=Math.min(entry.n,(entry.returned||0)+n);if(part)part.returnedCount=(part.returnedCount||0)+n;}ledger.unshift({id:returnId,accountId:COUPON_ACCOUNT,batchId:b.id,type:b.type==='general'?'通用券':'去水印专用券',n,purpose:'保存失败返还',source:b.source,expiry:b.expiry,kind:'返还',sign:'+',at:Date.now(),relatedEventId:b.spendId});}remember();refreshWallet();}
function requireLogin(then){if(state.logged){then();return;}context.afterLogin=then;openModal('login');status('请先使用 Google 登录（本地模拟）');}
function activateMembership(){requireLogin(()=>{
 refreshWallet();const intent=context.memberIntent;context.memberIntent=null;
 if(intent!=='purchase'){if(!window.MEMBERSHIP_PERIODS.history(member).length){status('未找到可恢复的购买记录，请先选择套餐');return;}remember();go('new-member-active',false);status('已同步购买记录，未重复延长会员或发券');return;}
 const now=Date.now(),receipt=context.memberPurchase||{id:'DEMO-PAYMENT-'+now+'-'+Math.random().toString(36).slice(2),createdAt:now,plan:context.memberPlan||member.plan,entitlements:JSON.parse(JSON.stringify(publishedMemberRules()))};
 const history=window.MEMBERSHIP_PERIODS.history(member),result=window.MEMBERSHIP_PERIODS.schedule(history,{...receipt,paidAt:now,status:'支付成功',verified:true});
 const bonus=window.MEMBER_BENEFITS.renewal(result.payment,history.filter(p=>window.MEMBERSHIP_PERIODS.confirmed(p)&&!window.MEMBERSHIP_PERIODS.revoked(p)));if(!result.duplicate&&bonus&&!couponBatches.some(b=>b.cycleId===bonus.id))grant('general',bonus.count,bonus.expiry,'提前续费奖励',{at:bonus.at,cycleId:bonus.id});member.payments=[...history.filter(p=>p.id!==result.payment.id),result.payment];member.benefitsVersion=2;context.lastMemberPurchase=result.payment;context.memberPurchase=null;context.memberPlan=null;syncMemberPeriods(now);refreshWallet();remember();go('new-member-active',false);status(result.payment.startsAt>now?'续费成功，期限已接续；新周期开始时发放对应赠券':'会员已生效，赠券已按本单周期发放');
 });}
function afterLogin(){refreshWallet();const fn=context.afterLogin;context.afterLogin=null;if(fn){fn();return true;}return false;}
function saveFailed(){returnCoupons(lastSaveSpend);lastSaveSpend=[];delete state.unlocks[state.quality+'-'+state.type];context.progress=0;context.used=0;go('new-save-recovery');status('保存失败，本次未完成的抵扣不计消耗；券有效期不变，广告进度不保留');}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const [key,info] of Object.entries(W))titles[key]=(key==='new-retry'?'反馈成功 · 免广告重试提示':info.title)+' · 新增原型';
const addGroups=[['新增 · 邀请与券',['new-invite','new-invite-share-new','new-invite-records','new-coupons']],['新增 · 会员',['new-member','new-member-active','new-member-sync']],['新增 · 保存解锁',['new-unlock-save','new-unlock-watermark','new-unlock-progress','new-save-recovery']],['新增 · 壁纸',['new-wallpaper','new-wallpaper-static','new-wallpaper-motion','new-wallpaper-video','new-wallpaper-custom','new-wallpaper-unlock','new-wallpaper-system','new-wallpaper-unsupported',...Object.keys(W).filter(key=>key.startsWith('new-wallpaper-error-'))]],['新增 · 反馈与重试',['new-feedback','new-retry']]];
for(const [label,keys] of addGroups){const h=document.createElement('div');h.className='section';h.textContent=label;$('#screen-list').appendChild(h);for(const key of keys){const b=document.createElement('button');b.dataset.key=key;b.textContent=key==='new-retry'?'反馈成功 · 重试提示':key==='new-invite-records'?'邀请记录':W[key].title;const selectNewDemo=()=>{if(requestPreparedRetryExit(selectNewDemo))return;stopTimer();const wallpaperDemo={'new-wallpaper-static':['official-0','static','静态壁纸'],'new-wallpaper-motion':['official-1','motion','3D壁纸'],'new-wallpaper-video':['official-2','video','视频壁纸']}[key];if(wallpaperDemo){const [id,type,title]=wallpaperDemo;context.wallpaperAsset=id;context.wallpaperMode=type;window.WALLPAPER_V2?.selectResource({id,type,title,vip:false});}if(['new-feedback','new-retry'].includes(key)){state.type='image';context.feedbackOrigin='complete';context.retryOrigin='complete';}if(key==='new-feedback'){gotoFeedback('complete');document.body.classList.remove('directory-open');return;}if(key==='new-unlock-save'){state.quality='uhd';context.kind='save';context.needed=2;context.used=0;context.progress=0;}if(key==='new-unlock-progress'){state.quality='uhd';context.kind='save';context.needed=2;context.used=0;context.progress=1;}if(key==='new-wallpaper-unlock'){prepareWallpaperCore(context.wallpaperMode);document.body.classList.remove('directory-open');return;}go(key);document.body.classList.remove('directory-open');};b.onclick=selectNewDemo;$('#screen-list').appendChild(b);}}
function texts(root,text){return [...root.querySelectorAll('.wf-text')].filter(e=>e.dataset.sourceText===text);}
function change(root,text,value){for(const el of texts(root,text))el.textContent=value;}
function box(root,k,label,fn){const info=W[k];const t=info.commands.find(c=>c.kind==='text'&&c.text===label);if(!t)return;const cx=t.x+t.w/2,cy=t.y+t.h/2;const b=info.commands.filter(c=>c.kind==='rect'&&c.w<375&&c.h>=25&&c.h<=90&&cx>=c.x&&cx<=c.x+c.w&&cy>=c.y&&cy<=c.y+c.h).sort((a,b)=>a.w*a.h-b.w*b.h)[0]||{x:t.x-4,y:t.y-4,w:t.w+8,h:t.h+8};return region(root,k,label,b.x,b.y,b.w,b.h,fn);}
function grayButton(root,label,x,y,w,h,fn){const b=document.createElement('button');b.className='new-entry';b.type='button';b.textContent=label;b.style.cssText=`left:${x}px;top:${y}px;width:${w}px;height:${h}px`;b.onclick=fn;root.appendChild(b);return b;}
function paint(root,k){root.innerHTML='';root.classList.add('wireframe');$('#phone').dataset.height=812;for(const c of W[k].commands){const e=document.createElement('div');e.className=c.kind==='text'?'wf-text':'wf-shape';e.style.cssText=`left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;`;if(c.kind==='text'){e.textContent=c.text;e.dataset.sourceText=c.text;e.style.fontSize=(c.font||14)+'px';e.style.lineHeight=(c.h<=32?c.h:(c.font||14)*1.5)+'px';e.style.color=c.color||'#333';e.style.fontWeight=c.bold?'600':'400';e.style.textAlign=c.align==='Center'?'center':c.align==='Far'?'right':'left';}else{e.style.background=c.fill||'transparent';e.style.border=c.border?`${c.border}px solid ${c.stroke||'#ccc'}`:'none';e.style.borderRadius=(c.r||0)+'px';}root.appendChild(e);}const title=W[k].commands.find(c=>c.kind==='text'&&c.text==='‹');if(title)region(root,k,'返回',5,40,43,44,()=>{if(k==='new-wallpaper-system'||W[k]?.wallpaperFailure){cancelWallpaper();return;}if(['new-unlock-save','new-unlock-watermark','new-unlock-progress','new-save-recovery'].includes(k))go(context.origin,false);else back();});}
function selected(root,label,on){for(const b of root.querySelectorAll('button'))if(b.dataset.action===label){b.classList.toggle('wf-selected',on);b.setAttribute('aria-pressed',String(on));}}
function redraw(){render();}
function feedbackLogin(then){if(state.logged){then();return;}const pending={screen:state.screen,modal:state.modal==='failed'?'failed':null};pending.resume=()=>{if(pendingFeedbackLogin!==pending)return;pendingFeedbackLogin=null;if(state.screen===pending.screen)then();};pendingFeedbackLogin=pending;requireLogin(pending.resume);}
function cancelFeedbackLogin(){const pending=pendingFeedbackLogin;if(!pending)return;pendingFeedbackLogin=null;if(context.afterLogin===pending.resume)context.afterLogin=null;closeModal(false);if(pending.modal==='failed')openModal('failed');else{updateDirectory();fit();}}
function gotoFeedback(origin){if(state.type==='video'||!['complete','saved','failed'].includes(origin))return;feedbackLogin(()=>{context.feedbackOrigin=origin;context.feedbackType=origin==='failed'?'生成失败':'';context.feedbackText='';go('new-feedback');});}
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&pendingFeedbackLogin&&state.modal==='login'&&!document.querySelector('.field-help-popup')&&document.body.dataset.workspace!=='admin'){event.preventDefault();event.stopImmediatePropagation();cancelFeedbackLogin();}},true);
function normalAdName(){return context.kind==='wallpaper'?(context.wallpaperMode==='static'?'壁纸静态首次设置激励广告':context.wallpaperMode==='video'?'视频壁纸动态首次设置激励广告':'3D壁纸动态首次设置激励广告'):context.kind==='watermark'?'去水印的激励广告':state.quality==='uhd'?'超清保存的激励广告':'高清保存的激励广告';}
function configured(name){return typeof adAllowed!=='function'||adAllowed(name);}
function unlockSave(){if(!configured(state.quality==='uhd'?'超清保存的激励广告':'高清保存的激励广告')){state.unlocks[state.quality+'-'+state.type]=true;finishSave();return;}context.origin=state.screen;context.kind='save';context.needed=state.quality==='uhd'?2:1;context.used=0;context.progress=0;context.choice='ad';go('new-unlock-save');}
function unlockWatermark(){if(!configured('去水印的激励广告')){state.watermark=true;persist();render();toast('已去水印');return;}if(state.watermark){toast('当前作品已去水印');return;}context.origin=state.screen;context.kind='watermark';context.needed=1;context.used=0;context.progress=0;context.choice='ad';go('new-unlock-watermark');}
function chooseCoupons(n){if(n>context.needed||n>wallet.general)return;context.used=n;redraw();}
function beginUnlock(){refreshWallet();if(!configured(normalAdName())){context.used=0;context.choice='ad';context.progress=context.needed;settleUnlock();return;}if((context.used>0||context.choice!=='ad')&&!state.logged){requireLogin(beginUnlock);return;}if(context.kind==='watermark'){context.used=context.choice==='ad'?0:1;}const cost=context.used;if(context.kind==='watermark'&&context.choice==='watermark'&&wallet.watermark<1){toast('没有可用的去水印券');return;}if(!(context.kind==='watermark'&&context.choice==='watermark')&&cost>wallet.general){toast('没有足够的通用券');return;}
 const remaining=context.needed-context.used-context.progress;
 if(remaining<=0){settleUnlock();return;}
 const autoWallpaper=context.kind==='wallpaper'&&context.wallpaperAutoAds;
 const base=context.kind==='wallpaper'?(autoWallpaper?'new-unlock-progress':'new-wallpaper-unlock'):context.kind==='watermark'?'new-unlock-watermark':'new-unlock-save';
 playAd(()=>{context.progress++;if(context.progress+context.used<context.needed){if(autoWallpaper)beginUnlock();else go('new-unlock-progress',false);}else settleUnlock();},base);
}
function settleUnlock(){const type=context.kind==='watermark'&&context.choice==='watermark'?'watermark':'general';const used=spend(type,context.used,context.kind==='wallpaper'?'设置壁纸':context.kind==='watermark'?'去水印':'保存');if(used===null){toast('没有足够的可用券');return;}
 if(context.kind==='watermark'){state.watermark=true;go(context.origin,false);persist();toast('已去水印');}
 else if(context.kind==='wallpaper'){pendingWallpaper[wallpaperKey()]=true;remember();applyWallpaper();}
 else{window.INVITE_UI?.noteSaveUnlock(!configured(normalAdName())?'free':context.used>0?(context.progress>0?'mixed':'coupon'):(context.progress>0?'ad':'free'));lastSaveSpend=used;state.unlocks[state.quality+'-'+state.type]=true;finishSave();}
}
/* 设置适配器只返回明确回执。默认适配器仅演示成功，不会更改系统壁纸。 */
let wallpaperAttempt=null,wallpaperAttemptSequence=0;
const localWallpaperAdapter=async()=>({status:'success',source:'local-demo'});
let wallpaperAdapter=localWallpaperAdapter;
function wallpaperOrigin(){return ['new-wallpaper-static','new-wallpaper-motion','new-wallpaper-video','new-wallpaper-custom','new-wallpaper-custom-result','new-wallpaper-history-detail'].includes(context.origin)?context.origin:'new-wallpaper';}
function wallpaperHelp(node,title,description){if(!node)return node;node.dataset.helpTitle=title;node.dataset.help=description;node.dataset.helpStatus='已确认';return node;}
function cancelWallpaper(){const attempt=wallpaperAttempt;wallpaperAttempt=null;wallpaperAttemptSequence++;window.VIP_ACCESS?.wallpaperOutcome('cancel',attempt?.asset||context.wallpaperAsset,attempt?.mode||context.wallpaperMode);delete pendingWallpaper[attempt?.key||wallpaperKey()];context.progress=0;context.used=0;context.choice='ad';context.wallpaperAutoAds=false;remember();returnToScreen(wallpaperOrigin());toast('已取消设置');}
function completeWallpaper(attempt=wallpaperAttempt){
 if(!attempt||attempt.status!=='success'||attempt.completed||!pendingWallpaper[attempt.key])return false;
 attempt.completed=true;delete pendingWallpaper[attempt.key];remember();
 window.WALLPAPER_V2?.recordSuccess(attempt.asset,attempt.mode,attempt.resource);
 window.VIP_ACCESS?.wallpaperOutcome('success',attempt.asset,attempt.mode);window.TEMPLATE_METRICS?.wallpaperSaved();
 context.progress=0;context.used=0;context.wallpaperAutoAds=false;remember();return true;
}
function wallpaperResultBack(){if(wallpaperAttempt?.status==='pending'){cancelWallpaper();return;}returnToScreen(wallpaperOrigin());}
function applyWallpaper(){
 const key=wallpaperKey();if(!pendingWallpaper[key])return false;
 if(wallpaperAttempt?.key===key&&wallpaperAttempt.status==='pending')return wallpaperAttempt.promise;
 const attempt={id:++wallpaperAttemptSequence,key,asset:context.wallpaperAsset,mode:context.wallpaperMode,target:context.wallpaperTarget||'both',origin:wallpaperOrigin(),resource:window.WALLPAPER_V2?.currentResource?.(),status:'pending',completed:false};
 wallpaperAttempt=attempt;window.TEMPLATE_METRICS?.wallpaperBegin(attempt.asset);go('new-wallpaper-system',false);
 const request=Object.freeze({id:attempt.id,asset:attempt.asset,mode:attempt.mode,target:attempt.target,resource:attempt.resource?JSON.parse(JSON.stringify(attempt.resource)):null});
 attempt.promise=Promise.resolve().then(()=>wallpaperAdapter(request)).catch(()=>({status:'unknown'})).then(result=>{
  if(wallpaperAttempt!==attempt||attempt.id!==wallpaperAttemptSequence)return false;
  attempt.source=result?.source||'adapter';
  if(result?.status==='cancel'){cancelWallpaper();return false;}
  if(result?.status==='success'){attempt.status='success';completeWallpaper(attempt);}
  else{attempt.status='failure';attempt.code=result?.status==='failure'&&Object.hasOwn(wallpaperFailures,result.code)?result.code:'unknown';window.VIP_ACCESS?.wallpaperOutcome('failure',attempt.asset,attempt.mode);}
  if(state.screen==='new-wallpaper-system')render();return attempt.status==='success';
 });return attempt.promise;
}
function retryWallpaper(){const proceed=()=>retryWallpaperCore();if(pendingWallpaper[wallpaperKey()])return proceed();if(window.VIP_ACCESS?.beforeWallpaper(context.wallpaperMode,proceed))return;return proceed();}
function retryWallpaperCore(){if(pendingWallpaper[wallpaperKey()])return applyWallpaper();return prepareWallpaper(context.wallpaperMode);}
function wallpaperStaticFallback(){const key=wallpaperKey(),qualified=Boolean(pendingWallpaper[key]);if(qualified)delete pendingWallpaper[key];context.wallpaperMode='static';context.needed=1;context.used=0;context.progress=0;context.choice='ad';if(qualified){pendingWallpaper[wallpaperKey()]=true;remember();applyWallpaper();}else prepareWallpaper('static');}
const wallpaperFailures={
 policy:{title:'暂时无法更换壁纸',message:'当前系统不允许更换壁纸，请检查系统设置或设备管理限制后重试。',action:'重试',kind:'retry'},
 resource:{title:'壁纸加载失败',message:'壁纸资源暂时无法读取，请重试或更换壁纸。',action:'重试',kind:'retry'},
 live:{title:'无法使用动态壁纸',message:'当前系统不支持3D或视频壁纸，可以改用静态壁纸。',action:'改用静态壁纸',kind:'static'},
 lock:{title:'无法设置到锁屏',message:'当前系统未提供锁屏设置，可以先设为桌面。',action:'设为桌面',kind:'home'},
 launch:{title:'无法打开壁纸设置',message:'系统壁纸设置暂时无法打开，请稍后重试。',action:'重试',kind:'retry'},
 unknown:{title:'未能获取设置结果',message:'暂时未能获取系统设置结果，请重试。',action:'重试',kind:'retry'}
};
function renderWallpaperSystem(root,k,forcedFailure){
 const attempt=wallpaperAttempt,key=wallpaperKey(),current=attempt?.key===key?attempt:null;
 const failure=forcedFailure||W[k]?.wallpaperFailure||(current?.status==='failure'?current.code:!current?'unknown':null),spec=failure?(wallpaperFailures[failure]||wallpaperFailures.unknown):null;
 const success=!spec&&current?.status==='success',pending=!spec&&current?.status==='pending',qualified=Boolean(pendingWallpaper[key]);
 const selected=current?.target||context.wallpaperTarget||'both',targetLabel={home:'桌面壁纸',lock:'锁屏',both:'桌面和锁屏'},mode=current?.mode||context.wallpaperMode,modeLabel=mode==='static'?'静态壁纸':mode==='video'?'视频壁纸':'3D壁纸';
 const title=spec?spec.title:success?'设置成功':'正在设置…';
 const body=grayPage(root,`<section class="wp-setting-result" role="status"><span class="wp-setting-result-icon" aria-hidden="true">${success?'✓':pending?'…':'!'}</span><h2>${title}</h2><p>${spec?'失败原因失败原因':success?modeLabel+'已设为'+targetLabel[selected]:'请稍候'}</p></section><div class="wp-system-preview"><span>${modeLabel}</span></div>${spec&&qualified?'<p class="wp-failure-qualification">本次设置资格已保留，重试不再看广告或扣券。</p>':''}<div class="wp-setting-result-actions">${success?'<button type="button" class="confirmed-button primary-gray" data-wp-result="done">完成</button>':spec?`<button type="button" class="confirmed-button primary-gray" data-wp-result="${spec.kind}">${spec.action}</button><button type="button" class="confirmed-button" data-wp-result="back">返回</button>`:''}</div>`);
 wallpaperHelp(body.querySelector('.wp-setting-result'),'壁纸设置回执','用户已在预览页选好目标，本页不再重复选择位置或手动确认成功失败。默认本地适配器明确返回演示success，不会修改当前电脑或手机壁纸；正式客户端必须等待系统适配器明确回执，返回App本身不视为成功。未知回执不写成功记录。');
 wallpaperHelp(body.querySelector('.wp-system-preview'),'设置内容',modeLabel+' · '+targetLabel[selected]+'。图片仅为当前资源预览，不能作为系统成功回执。');
 if(spec)wallpaperHelp(body.querySelector('.wp-setting-result p'),'失败原因','本地原型按要求统一显示“失败原因失败原因”占位。正式客户端按系统回执展示原因；当前分支：'+spec.message);
 const qualification=body.querySelector('.wp-failure-qualification');if(qualification)wallpaperHelp(qualification,'失败保留资格','失败不退回券或重收广告；保留已取得资格，直到明确取消或本次设置成功。');
 const back=root.querySelector('[data-action="返回"]');if(back){back.onclick=wallpaperResultBack;wallpaperHelp(back,'返回','成功或失败结果返回预览；失败资格保留。适配器尚未返回时离开按主动取消处理，不新增记录。');}
 window.WALLPAPER_V2?.enhanceSystemPreview(body);
 body.onclick=event=>{const action=event.target.closest('[data-wp-result]')?.dataset.wpResult;if(action==='done'||action==='back'){wallpaperResultBack();return;}if(action==='retry')retryWallpaper();if(action==='static')wallpaperStaticFallback();if(action==='home'){context.wallpaperTarget='home';retryWallpaper();}};
 status('系统设置由适配器回执驱动；当前为本机演示，不改变设备壁纸。');
}
function showWallpaperFailure(root,code){renderWallpaperSystem(root,state.screen,code);}
 document.addEventListener('keydown',event=>{if(event.key!=='Escape'||state.modal||document.body.dataset.workspace==='admin'||document.querySelector('.field-help-popup'))return;if(state.screen!=='new-wallpaper-system'&&!W[state.screen]?.wallpaperFailure)return;event.preventDefault();event.stopImmediatePropagation();wallpaperResultBack();},true);

function wallpaperKey(){return (context.wallpaperAsset||'official')+':'+context.wallpaperMode;}
function prepareWallpaper(mode){context.wallpaperMode=mode;const proceed=()=>prepareWallpaperCore(mode);if(pendingWallpaper[wallpaperKey()])return proceed();if(window.WALLPAPER_V2?.beforePrepare(mode,()=>resumeWallpaperHistory(mode)))return;if(window.VIP_ACCESS?.beforeWallpaper(mode,proceed))return;return proceed();}
function resumeWallpaperHistory(mode){context.wallpaperMode=mode;context.kind='wallpaper';context.choice='ad';context.needed=0;context.used=0;context.progress=0;context.origin=state.screen;pendingWallpaper[wallpaperKey()]=true;remember();applyWallpaper();}
function prepareWallpaperCore(mode){context.wallpaperMode=mode;context.kind='wallpaper';context.choice='ad';if(!state.screen.startsWith('new-wallpaper-unlock')&&state.screen!=='new-wallpaper-system'&&!W[state.screen]?.wallpaperFailure)context.origin=state.screen;context.needed=mode==='static'?1:2;context.used=0;context.progress=0;if(pendingWallpaper[wallpaperKey()])return applyWallpaper();refreshWallet();if(!configured(normalAdName())){context.needed=0;pendingWallpaper[wallpaperKey()]=true;remember();return applyWallpaper();}context.wallpaperAutoAds=wallet.general<=0;if(context.wallpaperAutoAds)return beginUnlock();go('new-wallpaper-unlock');}
function wireframeNav(root,k){for(const [label,x,fn] of [['首页',0,()=>go('home')],['壁纸',93.75,()=>go('new-wallpaper')],['作品',187.5,()=>go('works')],['我的',281.25,profile]])region(root,k,label,x,740,93.75,60,fn);}
function renderNew(k,root){if(pendingFeedbackLogin&&state.screen!==pendingFeedbackLogin.screen){if(context.afterLogin===pendingFeedbackLogin.resume)context.afterLogin=null;pendingFeedbackLogin=null;}refreshWallet();root.classList.remove('wireframe');if(!W[k])return false;if(k==='new-retry'){renderRetryPrompt(root);return true;}if(k==='new-wallpaper-unlock'&&(pendingWallpaper[wallpaperKey()]||wallet.general<=0)){root.innerHTML='';context.used=0;context.wallpaperAutoAds=true;Promise.resolve().then(()=>{if(state.screen!==k)return;if(pendingWallpaper[wallpaperKey()])applyWallpaper();else beginUnlock();});return true;}paint(root,k);if(['new-unlock-save','new-unlock-watermark'].includes(k))blendUnlock(root,k);status('新增界面按已确认规则演示 · 账号、支付、广告和系统设置均为本地模拟');
 if(k==='new-wallpaper-system'||W[k].wallpaperFailure){renderWallpaperSystem(root,k);return true;}
 const custom={'new-invite':renderInvite,'new-invite-records':renderInviteRecords,'new-coupons':renderCoupons,'new-coupon-records':renderCouponRecords,'new-member':renderMember,'new-member-active':renderMemberActive,'new-feedback':renderFeedback};if(custom[k]){custom[k](root);return true;}
 if(k==='new-invite-share-new'){
  box(root,k,'×',()=>go('new-invite'));box(root,k,'复制邀请链接',()=>status('专属邀请链接尚未接入；本地演示不生成真实邀请资格'));
  for(const t of ['WhatsApp','Instagram','更多'])box(root,k,t,()=>status('本地演示选择 '+t+'；不发送真实邀请'));box(root,k,'查看好友进度  ›',()=>{go('new-invite');const body=root.querySelector('.confirmed-body'),progress=root.querySelector('.invite-progress');if(body&&progress)body.scrollTop=progress.offsetTop;});
 }
 if(k==='new-member-sync'){
  box(root,k,'同步购买状态',()=>status('未连接真实支付平台；可点击“支付成功”体验本地核验成功分支'));
  box(root,k,'支付成功',activateMembership);
 }
 if(k==='new-unlock-save'||k==='new-wallpaper-unlock'){
  const n=context.needed;
  if(k==='new-unlock-save'){
   change(root,'超清保存',state.quality==='uhd'?'超清保存':'高清保存');change(root,'需要解锁 2 次广告权益',`需要解锁 ${n} 次广告权益`);change(root,'可用通用券：以实际余额为准',`可用通用券：${wallet.general} 张`);change(root,'图片 / 视频作品预览',state.type==='video'?'视频效果预览':'图片效果预览');box(root,k,'×',()=>go(context.origin,false));
  }
  for(let i=0;i<3;i++){const label=i+' 张';const b=box(root,k,label,()=>chooseCoupons(i));if(b){b.disabled=i>n||i>wallet.general;selected(root,label,i===context.used);}}
  change(root,'当前示例：选 0 张券',`已选择 ${context.used} 张通用券`);change(root,'当前示例：不使用券',context.used?`使用 ${context.used} 张通用券`:'不使用券');change(root,'还需观看 2 条广告',`还需观看 ${Math.max(0,n-context.used-context.progress)} 条广告`);
  if(k==='new-wallpaper-unlock'){
   change(root,'本次3D效果',context.wallpaperMode==='static'?'本次静态效果':context.wallpaperMode==='video'?'本次视频效果':'本次3D效果');change(root,'设置3D壁纸',context.wallpaperMode==='static'?'设置静态壁纸':context.wallpaperMode==='video'?'设置视频壁纸':'设置3D壁纸');change(root,'本次设置需解锁 2 次权益',`本次设置需解锁 ${n} 次权益`);
   change(root,'3D壁纸设置',context.wallpaperMode==='static'?'静态壁纸设置':context.wallpaperMode==='video'?'视频壁纸设置':'3D壁纸设置');
   for(const t of ['本次需要 2 次激励广告权益','本次需 2 次激励广告权益','本次需要 2 次权益'])change(root,t,`本次需要 ${n} 次激励广告权益`);
   change(root,'通用券可用：实际余额',`通用券可用：${wallet.general} 张`);
  }
  box(root,k,k==='new-unlock-save'?'继续解锁':'继续并设置壁纸',beginUnlock);
 }
 if(k==='new-unlock-watermark'){
  const opts=[['○  不使用券，观看广告','ad'],['○  去水印专用券（可用 — 张）','watermark'],['○  通用券（可用 — 张）','general']];
  for(const [t,value] of opts){const b=box(root,k,t,()=>{context.choice=value;redraw();});change(root,t,t.replace('○',context.choice===value?'●':'○').replace('—',value==='watermark'?wallet.watermark:wallet.general));if(b){b.disabled=value==='watermark'&&!wallet.watermark||value==='general'&&!wallet.general;selected(root,t,context.choice===value);}}
  box(root,k,'确认解锁',beginUnlock);
 }
 if(k==='new-unlock-progress'){
  change(root,'超清保存',context.kind==='wallpaper'?'壁纸设置':state.quality==='uhd'?'超清保存':'高清保存');change(root,'已完成 1 / 2 次',`已完成 ${context.progress+context.used} / ${context.needed} 次`);
  box(root,k,'继续观看广告',beginUnlock);const b=box(root,k,'选择 1 张通用券抵扣',()=>requireLogin(()=>{context.used++;settleUnlock();}));if(b)b.disabled=wallet.general<context.used+1;
 }
 if(k==='new-save-recovery'){
  box(root,k,'重试保存',()=>{if(context.kind==='wallpaper'){prepareWallpaper(context.wallpaperMode);return;}if(state.quality==='standard')finishSave();else unlockSave();});box(root,k,'查看保存说明',()=>status('请检查相册权限及设备空间；保存失败不计消耗，券有效期不变；已过期券仍过期，广告进度不保留'));
 }
 if(k==='new-wallpaper'){
  wireframeNav(root,k);addNavigation(root,k);change(root,'上传照片，自定义壁纸  +','上传照片，生成3D壁纸  +');const customEntry=box(root,k,'上传照片，自定义壁纸  +',()=>{context.wallpaperAsset='custom';go('new-wallpaper-custom');});if(customEntry)wallpaperHelp(customEntry,'上传照片生成3D壁纸','上传自己的照片后直接生成3D效果预览，不再添加装饰元素。生成时展示一次插页，会员按独立广告配置；首次设为壁纸仍按静态一次、3D效果两次正常激励广告解锁。');wallpaperGrid(root,k);
 }
 if(k==='new-wallpaper-static')box(root,k,'设置壁纸',()=>prepareWallpaper('static'));
 if(k==='new-wallpaper-motion')box(root,k,'设置3D壁纸',()=>prepareWallpaper('motion'));
 if(k==='new-wallpaper-video')box(root,k,'设置视频壁纸',()=>prepareWallpaper('video'));
 if(k==='new-wallpaper-custom'){
  status('请加载照片生成3D壁纸模块，使用上传照片直接生成效果预览。');
 }
 if(k==='new-wallpaper-unsupported'){
  box(root,k,'切换静态模式',()=>go('new-wallpaper-static'));box(root,k,'返回更换壁纸',()=>go('new-wallpaper'));
 }

 return true;
}
function blendUnlock(root,k){
 const base=D.svg[context.origin]?context.origin:'confirm-video';
 for(const el of [...root.querySelectorAll('.wf-shape,.wf-text')])if(parseFloat(el.style.top)<382)el.remove();
 const layer=document.createElement('div');layer.className='unlock-native-base';layer.innerHTML=D.svg[base];updateWatermark(layer,base);root.prepend(layer);
 const shade=document.createElement('div');shade.className='unlock-native-shade';root.insertBefore(shade,layer.nextSibling);
}
function hasPreparedRetry(){const meta=window.VIP_ACCESS?.currentTemplate;return Boolean(preparedRetry&&state.screen===preparedRetry.screen&&state.type===preparedRetry.type&&(!meta||meta.id===preparedRetry.templateId)&&window.VIP_ACCESS?.state?.templateAttempt===preparedRetry.attemptId);}
function prepareRetry(){
 refreshWallet();if(context.retryCount>=2){returnFeedbackOrigin();return;}
 const meta=window.VIP_ACCESS?.currentTemplate;
 preparedRetry={id:Date.now()+'-'+Math.random().toString(36).slice(2),templateId:meta?.id||'',attemptId:window.VIP_ACCESS?.state?.templateAttempt,type:state.type,screen:state.type==='video'?'detail-video':'detail-image'};
 go(preparedRetry.screen,false);
}
function beginPreparedRetry(proceed){
 if(!preparedRetry)return false;
 if(!hasPreparedRetry()){preparedRetry=null;return false;}
 if(!state.logged){requireLogin(()=>startCreating());return true;}
 refreshWallet();if(context.retryCount>=2){preparedRetry=null;returnFeedbackOrigin();return true;}
 if(window.RETRY_PHOTOS?.beforeStart()===false)return true;
 preparedRetry=null;context.retryCount++;remember();
 state.unlocks={};state.watermark=false;state.videoSaving=false;
 proceed();return true;
}
function closeRetryExitDialog(restoreFocus=true){
 const dialog=retryExitDialog;if(!dialog)return;
 retryExitDialog=null;document.removeEventListener('keydown',dialog.onKey,true);
 dialog.mask.remove();dialog.panel.remove();
 if(restoreFocus&&dialog.previous?.isConnected)dialog.previous.focus({preventScroll:true});
}
function requestPreparedRetryExit(proceed=returnFeedbackOrigin){
 if(!hasPreparedRetry())return false;
 if(retryExitDialog)return true;
 const root=$('#screen'),retry=preparedRetry,previous=document.activeElement;
 const mask=document.createElement('div');mask.className='retry-prompt-mask retry-exit-mask';
 const panel=document.createElement('section');panel.className='retry-prompt retry-exit-prompt';
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','retry-exit-title');panel.setAttribute('aria-describedby','retry-exit-message');
 panel.innerHTML='<strong id="retry-exit-title">退出重新制作？</strong><p id="retry-exit-message">退出后将失去本次免广告重做机会。</p><div><button type="button" data-retry-exit="continue">继续制作</button><button type="button" data-retry-exit="confirm">确认退出</button></div>';
 const buttons=[...panel.querySelectorAll('button')],cancel=()=>closeRetryExitDialog();
 const onKey=event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}
  else if(event.key==='Tab'){event.preventDefault();const index=buttons.indexOf(document.activeElement);buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}
 };
 retryExitDialog={mask,panel,previous,onKey};
 mask.onclick=event=>{event.stopPropagation();cancel();};
 panel.querySelector('[data-retry-exit="continue"]').onclick=cancel;
 panel.querySelector('[data-retry-exit="confirm"]').onclick=()=>{
  closeRetryExitDialog(false);if(preparedRetry!==retry)return;
  preparedRetry=null;window.RETRY_PHOTOS?.reset();proceed();
 };
 root.append(mask,panel);document.addEventListener('keydown',onKey,true);buttons[0].focus({preventScroll:true});
 return true;
}
function exitPreparedRetry(){return requestPreparedRetryExit();}
function renderRetryPrompt(root){
 const origin=D.svg[context.feedbackOrigin]&&context.feedbackOrigin!=='failed'?context.feedbackOrigin:'complete';root.classList.remove('wireframe');root.innerHTML=D.svg[origin];$('#phone').dataset.height=D.scenes.find(s=>s.key===origin)?.height||812;
 const mask=document.createElement('div');mask.className='retry-prompt-mask';root.appendChild(mask);
 const panel=document.createElement('div');panel.className='retry-prompt';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','本次免广告重试');panel.innerHTML='<strong>恭喜获得本次免费再试一次的机会</strong><p>模板不变，可重新选择照片后制作。<br>本次不显示插页广告。</p><div><button data-retry="cancel" data-escape-dismiss>暂不重试</button><button data-retry="confirm">立即重试</button></div>';root.appendChild(panel);
 panel.querySelector('[data-retry="cancel"]').onclick=()=>returnFeedbackOrigin();
 panel.querySelector('[data-retry="confirm"]').onclick=prepareRetry;
 status('立即重试先返回原模板详情；点击开始制作才计次数，本次跳过插页，VIP体验资格沿用。');
}
function returnFeedbackOrigin(){if(context.feedbackOrigin==='failed'){returnToScreen('creating');openModal('failed');}else returnToScreen(context.feedbackOrigin);}
function wallpaperGrid(root,k){
 for(const el of [...root.querySelectorAll('.wf-text,.wf-shape')]){const y=parseFloat(el.style.top);if(y>=180&&y<735)el.remove();}
 const list=document.createElement('div');list.className='wallpaper-grid';list.setAttribute('aria-label','官方壁纸列表');root.appendChild(list);
 if(window.WALLPAPER_RANKING)window.WALLPAPER_RANKING.mount(root,list);
 else{const message=document.createElement('p');message.textContent='壁纸列表暂不可用，请刷新页面';list.appendChild(message);}
}
function grayPage(root,html){root.querySelector('.confirmed-body')?.remove();for(const e of [...root.querySelectorAll('.wf-text,.wf-shape')])if(parseFloat(e.style.top)>=90)e.remove();const body=document.createElement('section');body.className='confirmed-body';body.innerHTML=html;root.appendChild(body);return body;}
const act=(label,id,primary=false)=>`<button type="button" data-new-action="${id}" class="confirmed-button ${primary?'primary-gray':''}">${esc(label)}</button>`;
const card=(title,body)=>`<article class="confirmed-card"><h3>${esc(title)}</h3>${body}</article>`;
const rewardsHelp=(title,description)=>`data-help-title="${esc(title)}" data-help="${esc(description)}" data-help-status="已确认"`;
function rewardTime(value){if(value===null||value===undefined||value==='')return null;const n=typeof value==='number'?value:Date.parse(value);return Number.isFinite(n)&&n>0?n:null;}
const rewardDate=value=>{const n=rewardTime(value);return n===null?'时间未记录':new Date(n).toLocaleString('zh-CN',{timeZone:'Asia/Kolkata',hour12:false});};
const couponName=type=>type==='general'?'通用券':type==='watermark'?'去水印专用券':type||'券';
function inviteProgress(){const rows=state.logged?invitationRows:[],today=new Set(rows.filter(row=>rewardTime(row.registeredAt)!==null&&istDay(rewardTime(row.registeredAt))===istDay()).map(row=>row.friendId||row.id)).size;const receipts=rows.flatMap(row=>[['registrationRewardAt','去水印券'],['universalRewardAt','通用券']].map(([field,type])=>({time:rewardTime(row[field]),name:row.name||'好友',type}))).filter(row=>row.time!==null).sort((a,b)=>b.time-a.time);const recent=receipts[0];return {limit:today>=5,html:`<section class="invite-progress" ${rewardsHelp('好友进度','好友通过邀请链接注册后自动绑定，在这里直接查看注册奖励和首次广告高清保存奖励的到账情况。')}><h3>好友进度</h3>${recent?`<p class="invite-reward-receipt" role="status" ${rewardsHelp('邀请奖励到账','只根据已有邀请奖励记录显示到账反馈；注册时邀请人获去水印券，首次看激励广告完成高清保存后双方各获1张通用券；15天有效。')}>${esc(recent.name)}的邀请奖励已到账：${recent.type} × 1</p>`:''}${rows.length?rows.map(row=>`<article class="confirmed-card invite-friend" ${rewardsHelp('好友邀请进度','同一好友的注册阶段和首次广告高清保存阶段分别记录，每个阶段只奖励一次。')}><h3>${esc(row.name||'好友')}</h3><div class="invite-stage" ${rewardsHelp('注册奖励','好友通过邀请链接注册后，邀请人获得1张去水印券；未有到账记录时不显示已到账。')}><strong>${rewardTime(row.registeredAt)!==null?'已注册':'等待好友注册'}</strong><span>${rewardTime(row.registrationRewardAt)!==null?'去水印券 × 1 已到账':'注册奖励未到账'}</span></div><div class="invite-stage" ${rewardsHelp('首次广告高清保存奖励','好友首次实际观看激励广告并成功完成高清保存，双方各得1张通用券，有效期15天。用券免广告或限免保存不触发；第二阶段可跨天到账。')}><strong>${rewardTime(row.firstAdSaveAt)!==null?'首次广告高清保存已完成':'等待首次广告高清保存'}</strong><span>${rewardTime(row.universalRewardAt)!==null?'通用券 × 1 已到账':'通用券奖励未到账'}</span></div></article>`).join(''):`<div class="invite-empty"><strong>${state.logged?'暂无好友进度':'登录后查看好友进度'}</strong><p class="confirmed-note">${state.logged?'好友通过邀请链接注册后，这里会显示进度和奖励到账情况。':'使用 Google 登录后，可邀请好友并查看奖励进度。'}</p></div>`}</section>`};}
function renderInvite(root){const progress=inviteProgress();const b=grayPage(root,`<h2>邀请好友，分两步领券</h2>${progress.limit?`<p class="invite-limit" role="status" ${rewardsHelp('今日已上限','今天已有5位新好友成功注册，达到当日邀请奖励上限；印度时间00:00重置。之前好友的首次广告高清保存奖励仍可后续到账。')}>今日已上限</p>`:''}${card('好友注册成功','<strong>你得 1 张去水印券</strong>')}${card('好友首次看广告完成高清保存','<strong>你和好友各得 1 张通用券</strong><p>用券免广告或普通免费保存不计入</p>')}<p class="confirmed-note">邀请奖励发放后 15 天过期</p>${act('立即邀请','share',true)}${progress.html}<button type="button" data-new-action="rules" class="rewards-text-link" ${rewardsHelp('活动规则','查看邀请两阶段奖励、每日5位新好友、印度零点日切以及15天有效期的规则。')}>活动规则</button>`);b.onclick=e=>{const id=e.target.closest('[data-new-action]')?.dataset.newAction;if(id==='share')requireLogin(()=>go('new-invite-share-new'));if(id==='rules')grayDialog(root,'活动规则','每天最多 5 位新注册好友获得奖励资格，印度时间 00:00 重置。通过邀请链接注册后，邀请人得 1 张去水印券；好友首次实际观看激励广告并完成高清保存后，邀请人和好友各得 1 张通用券。用券免广告或限免保存不计入第二阶段。同一好友每阶段仅奖励一次，第二阶段可跨天到账，不占新一天的邀请名额。邀请所得券发放后15天过期。');};b.querySelector('[data-new-action=share]').setAttribute('data-help','使用Google登录后分享自己的邀请链接，好友通过链接注册后自动绑定。');}
function renderInviteRecords(root){renderInvite(root);}
function couponRecords(){const used=ledger.filter(row=>row.sign==='−'||row.sign==='-'||!row.sign).map((row,index)=>({...row,id:row.id||'legacy-use-'+index,status:'使用',type:couponName(row.type),n:Math.max(0,(Number(row.n)||0)-(Number(row.returned)||0)),time:rewardTime(row.at)})).filter(row=>row.n>0);const expired=couponBatches.filter(row=>row.count>0&&row.expiry<=Date.now()).map(row=>({id:'expired-'+row.id,status:'过期',type:couponName(row.type),n:row.count,purpose:row.source,time:rewardTime(row.expiry)}));return [...used,...expired].sort((a,b)=>(b.time||0)-(a.time||0));}
function renderCouponRecords(root){refreshWallet();const rows=state.logged?couponRecords():[];const body=grayPage(root,`<div class="confirmed-coupon-records">${state.logged?rows.map(row=>`<article class="confirmed-card coupon-record" data-coupon-record="${esc(row.status)}" ${rewardsHelp(row.status+'记录',row.status==='使用'?'显示实际成功消耗的券数量；失败未完成的抵扣不计消耗。':'只显示到期时没有用完的券；已使用的部分不重复计为过期。')}><div class="coupon-record-heading"><h3>${esc(row.type)} × ${row.n}</h3><span class="coupon-record-state">${row.status}</span></div><p>${esc(row.purpose||'')}</p><small>${row.status==='过期'?'过期':'使用'}时间：${rewardDate(row.time)}${row.time===null?'':'（印度时间）'}</small></article>`).join('')||'<p class="confirmed-note">暂无使用或过期记录</p>':act('Google 登录后查看','login',true)}</div>`);body.onclick=e=>{if(e.target.closest('[data-new-action=login]'))requireLogin(()=>go('new-coupon-records',false));};}
function renderCoupons(root){refreshWallet();const available=couponBatches.filter(b=>b.count>0&&b.expiry>Date.now()).sort((a,b)=>a.expiry-b.expiry);const body=grayPage(root,`<h2 ${rewardsHelp('可用券余额','分别统计未过期且尚未使用的通用券和去水印券。通用券可抵保存、去水印和壁纸设置广告，VIP体验广告除外；去水印券只能去水印。')}>通用 ${state.logged?wallet.general:0} · 去水印 ${state.logged?wallet.watermark:0}</h2><p class="confirmed-note" ${rewardsHelp('用券顺序','用户主动选择用券，系统优先使用快过期的同类券。')}>通用券可抵保存、去水印和壁纸设置广告；VIP体验广告不可用券。去水印券仅用于去水印，优先用快过期的券。</p><div class="confirmed-coupon-list">${state.logged?available.map(b=>`<article class="confirmed-card" ${rewardsHelp('可用'+couponName(b.type),'显示该批次尚未使用的券数量、来源及到期时间。到期后从可用列表移到记录，标为过期。')}><h3>${couponName(b.type)} × ${b.count}</h3><p>${esc(b.source)}</p><small>到期：${rewardDate(b.expiry)}（印度时间）</small></article>`).join('')||'<p>暂无可用券</p>':act('Google 登录后查看','login',true)}</div>`);body.onclick=e=>{if(e.target.closest('[data-new-action=login]'))requireLogin(()=>go('new-coupons',false));};const record=grayButton(root,'记录',318,45,41,38,()=>requireLogin(()=>go('new-coupon-records')));record.classList.add('coupon-record-link');record.setAttribute('data-help-title','券记录');record.setAttribute('data-help','查看券的使用和过期记录；保存失败返还的券不重复计为已使用。');}
const MEMBER_PLAN_LABELS={week:'周卡',month:'月卡',year:'年卡'};
function memberDisplayCopy(rules,plan=member.plan){const p=window.MEMBER_BENEFITS.forPlan(rules,plan);return (plan==='year'?'开通赠'+p.initialCount+'张，之后每月赠'+p.monthlyCount+'张':'每期赠'+p.initialCount+'张通用券')+'，每日'+p.dailyCount+'张；券用完可继续看广告解锁。';}
function memberRenewalCopy(){return '<div class="member-renewal-copy"><p><strong>续费规则</strong></p><p>未到期续费从已购买期限的到期日接续，基础赠券等新周期开始再发。提前续费额外奖励在付款确认后立即送，到新购套餐结束时过期。</p><p>新套餐按顺序生效，不提前切换。周卡每日券共7次：生效日先发当天日券，之后6个印度零点发放，当天有效。月卡、年卡按对应有效天数发放，同日不重复发。</p><p>周卡每7天、月卡每月、年卡每年自动续订，可在管理订阅中取消。</p></div>';}
function memberPlanPreview(plan,rules,now=Date.now()){
 const periods=window.MEMBERSHIP_PERIODS,history=state.logged?periods.history(member):[],payment=periods.schedule(history,{id:'preview-'+plan,plan,paidAt:now,verified:true,status:'支付成功',entitlements:rules}).payment;
 const firstDay=istDay(payment.startsAt),firstMidnight=Date.parse(firstDay+'T00:00:00+05:30');
 // 旧单或已领取日券的同日重开沿用业务去重，展示总量也不重复承诺这批日券。
 const skipFirstDaily=state.logged&&(firstDay===istDay(now)?member.daily===firstDay:history.some(p=>periods.confirmed(p,now)&&!periods.revoked(p)&&window.MEMBER_BENEFITS.daily(p,firstMidnight)));
 return {...window.MEMBER_BENEFITS.total(payment,{skipFirstDaily}),payment,skipFirstDaily};
}
function memberPlanCard(plan,rules,selected,preview=memberPlanPreview(plan,rules)){const p=window.MEMBER_BENEFITS.forPlan(rules,plan),weekly=plan==='week',unit={week:'7天',month:'月',year:'年'}[plan];return `<article class="member-plan-card ${selected?'is-selected':''}" data-member-plan="${plan}" aria-label="${MEMBER_PLAN_LABELS[plan]}套餐权益"><div class="member-plan-eyebrow">${weekly?'短期体验':plan==='month'?'持续创作':'长期畅用'}</div><h3>${MEMBER_PLAN_LABELS[plan]}</h3><div class="member-plan-price"><strong>${esc(p.price)}</strong><span>/ ${unit}</span></div><p class="member-plan-period">${weekly?'7×24小时有效':plan==='year'?'一个会员年有效':'一个会员月有效'}</p><div class="member-plan-gift"><strong>开通共获得<span class="member-plan-total"><b>${preview.total.toLocaleString()}</b> 张通用免广告券</span></strong><small>按下方规则分批发放</small></div><ul><li><strong>${plan==='year'?'每月发放 '+p.monthlyCount+' 张通用券':'单次发放 '+p.initialCount+' 张通用券'}</strong><small>${plan==='year'?'生效时先发 '+p.initialCount+' 张；后续11次按开通日发放':'生效时发放'}；${weekly?'本单周期结束时过期':'对应会员月结束时过期'}</small></li><li><strong>每日 ${p.dailyCount} 张通用券</strong><small>${preview.skipFirstDaily?'生效当天日券已发，不重复领；之后印度每日0点发':weekly?'生效日先得 '+(p.initialCount+p.dailyCount)+' 张，之后6个印度零点再发':'生效日先发，之后印度每日0点发放'}；当天有效</small></li><li>提前续费额外送 ${p.renewalBonus} 张<small>付款确认即送，本单结束过期；总量另算</small></li><li>直接使用VIP模板和壁纸</li><li>用券解锁保存、去水印和壁纸设置</li><li>券用完，可继续看广告解锁</li></ul><p class="member-plan-renew">${weekly?'每7天':plan==='year'?'每年':'每月'}自动续订，可随时取消</p></article>`;}

function renderMember(root){
 const rules=publishedMemberRules(),plans=['week','month','year'],selectedPlan=plans.includes(context.memberPlan||member.plan)?context.memberPlan||member.plan:'month',initial=plans.indexOf(selectedPlan);context.memberPlan=selectedPlan;
 const order=[plans[(initial+2)%3],selectedPlan,plans[(initial+1)%3]],now=Date.now(),previews=Object.fromEntries(plans.map(plan=>[plan,memberPlanPreview(plan,rules,now)]));
 const body=grayPage(root,`<h2>选择适合你的会员</h2><div class="member-carousel-heading"><span>左右滑动，查看套餐权益</span><span data-member-counter aria-live="polite"></span></div><div class="member-plan-carousel" role="region" aria-label="左右滑动选择会员套餐" aria-keyshortcuts="ArrowLeft ArrowRight" tabindex="0"><div class="member-plan-track">${order.map(plan=>memberPlanCard(plan,rules,plan===selectedPlan,previews[plan])).join('')}</div></div><div class="member-purchase-actions">${act('','buy',true)}<p class="member-purchase-renew" data-member-renew></p>${act('恢复购买','restore')}</div>${card('权益介绍','<p>上方总量是本次套餐内分批发放的通用免广告券合计，不是开通当天全部到账。总量按本次实际生效期限计算，月卡会随月份天数变化，年卡会随闰年变化；提前续费奖励另算。</p><p>生效日先发当天日券，后续按印度时间0点发放；日券当天有效，不累计，同一业务日只发一批。</p>'+memberRenewalCopy())}`);
 const viewport=body.querySelector('.member-plan-carousel'),track=body.querySelector('.member-plan-track');let drag=null,motion=null,suppressCardClickUntil=0,wheelLocked=false,wheelTimer;
 const cards=()=>[...track.children],step=()=>track.children[1].offsetLeft-track.children[0].offsetLeft,base=()=>(viewport.clientWidth-track.children[1].offsetWidth)/2-step();
 const place=x=>{track.style.transform=`translate3d(${x}px,0,0)`;};
 function update(plan){context.memberPlan=plan;for(const el of cards())el.classList.toggle('is-selected',el.dataset.memberPlan===plan);body.querySelector('[data-member-counter]').textContent=(plans.indexOf(plan)+1)+' / 3';body.querySelector('[data-new-action=buy]').textContent=(member.active?'续费':'开通')+MEMBER_PLAN_LABELS[plan]+' · '+(rules.plans?.[plan]?.price||'xx')+' / '+({week:'7天',month:'月',year:'年'}[plan]);body.querySelector('[data-member-renew]').textContent=({week:'每7天',month:'每月',year:'每年'}[plan])+'自动续订，可取消';}
 function finishMotion(){if(!motion)return;const {direction,timer}=motion;clearTimeout(timer);motion=null;track.style.transition='none';if(direction===1)track.append(track.firstElementChild);else if(direction===-1)track.prepend(track.lastElementChild);place(base());viewport.classList.remove('is-animating');}
 function move(direction){if(motion||drag||!track.isConnected)return;const target=track.children[1+direction];update(target.dataset.memberPlan);viewport.classList.add('is-animating');const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;track.style.transition=reduced?'none':'transform 240ms cubic-bezier(.22,.61,.36,1)';motion={direction,timer:setTimeout(finishMotion,reduced?0:300)};place(base()-direction*step());}
 track.ontransitionend=e=>{if(e.target===track&&e.propertyName==='transform')finishMotion();};
 update(selectedPlan);place(base());requestAnimationFrame(()=>{if(track.isConnected&&!drag&&!motion)place(base());});
 viewport.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}};
 viewport.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)<=Math.abs(e.deltaY))return;e.preventDefault();clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{wheelLocked=false;},180);if(!wheelLocked&&Math.abs(e.deltaX)>6){wheelLocked=true;move(e.deltaX>0?1:-1);}},{passive:false});
 viewport.onpointerdown=e=>{if(e.button!==0||motion)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,horizontal:false,plan:e.target.closest('[data-member-plan]')?.dataset.memberPlan};viewport.setPointerCapture(e.pointerId);track.style.transition='none';};
 viewport.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.horizontal&&Math.abs(dx)>6&&Math.abs(dx)>Math.abs(dy))drag.horizontal=true;if(!drag.horizontal)return;e.preventDefault();viewport.classList.add('is-dragging');const scale=viewport.getBoundingClientRect().width/viewport.offsetWidth;drag.dx=Math.max(-step(),Math.min(step(),dx/scale));place(base()+drag.dx);};
 const finishDrag=(e,cancelled=false)=>{if(!drag||e.pointerId!==drag.id)return;const current=drag;drag=null;viewport.classList.remove('is-dragging');suppressCardClickUntil=performance.now()+300;if(cancelled){if(current.horizontal)move(0);return;}if(current.horizontal){move(Math.abs(current.dx)>step()*.18?(current.dx<0?1:-1):0);}else if(current.plan){const index=cards().findIndex(el=>el.dataset.memberPlan===current.plan);if(index!==1)move(index-1);}};
 viewport.onpointerup=e=>finishDrag(e);viewport.onpointercancel=e=>finishDrag(e,true);
 for(const el of [...cards(),body.querySelector('[data-new-action=buy]')]){el.dataset.helpTitle='套餐与续费规则';el.dataset.help='套餐总量＝单次赠券＋年卡后续11次月券＋本次有效期内每日赠券；按实际生效期限计算，同日已发日券不重复承诺。开通后按规则分批到账，日券当天有效，提前续费额外奖励另算。'+window.MEMBERSHIP_PERIODS.help;el.dataset.helpStatus='已确认';}
 body.onclick=e=>{const selected=e.target.closest('[data-member-plan]');if(selected&&performance.now()>suppressCardClickUntil){const index=cards().indexOf(selected);if(index!==1)move(index-1);}const id=e.target.closest('[data-new-action]')?.dataset.newAction;if(id==='buy'||id==='restore')requireLogin(()=>{context.memberIntent=id==='buy'?'purchase':'restore';context.memberPurchase=id==='buy'?{id:'DEMO-PAYMENT-'+Date.now()+'-'+Math.random().toString(36).slice(2),createdAt:Date.now(),plan:context.memberPlan,entitlements:JSON.parse(JSON.stringify(rules))}:null;go('new-member-sync');});};
}
function renewalRewardCopy(){const p=context.lastMemberPurchase,b=p&&couponBatches.find(b=>b.cycleId==='renewal:'+p.id);return b&&!b.recalled?card('提前续费奖励已到账','<strong>'+b.issuedCount+' 张通用券</strong><p>已立即发放，到新购套餐结束时过期。</p><small>'+new Date(b.expiry).toLocaleString('zh-CN',{timeZone:'Asia/Kolkata'})+'（印度时间）</small>'):'';}
function renderMemberActive(root){refreshWallet();const periods=window.MEMBERSHIP_PERIODS.summary(member),rules=member.active?activeMemberRules():publishedMemberRules();const body=grayPage(root,`<h2>${member.active?MEMBER_PLAN_LABELS[member.plan]+'已生效':'尚未开通会员'}</h2><p class="confirmed-note">${esc(memberDisplayCopy(rules))}</p>${card('当前套餐权益','<p>'+esc(memberDisplayCopy(rules))+'</p><p>直接使用VIP模板和壁纸，无需观看体验广告。</p>'+memberRenewalCopy())}${renewalRewardCopy()}${card('我的通用券',`<strong>${state.logged?wallet.general:0} 张</strong><p>优先使用快过期的券，用完仍可看广告</p>`)}<p class="confirmed-note">${member.active?'有效期至 '+new Date(member.expiry).toLocaleString('zh-CN',{timeZone:'Asia/Kolkata'})+'（印度时间）':'核验成功后发放会员权益'}</p>${periods.queued.length?card('已续费待生效',periods.queued.map(p=>'<p>'+esc(MEMBER_PLAN_LABELS[p.plan])+'：'+esc(new Date(p.startsAt).toLocaleString('zh-CN',{timeZone:'Asia/Kolkata'}))+' 至 '+esc(new Date(p.expiresAt).toLocaleString('zh-CN',{timeZone:'Asia/Kolkata'}))+'</p>').join('')):''}${act('查看我的券','coupons',true)}${act('恢复购买 / 同步状态','sync')}${act(member.active?'续费会员':'选择套餐续费','renew')}`);for(const el of body.querySelectorAll('h2,[data-new-action=renew]')){el.dataset.helpTitle='会员续费与赠券规则';el.dataset.help=window.MEMBERSHIP_PERIODS.help;el.dataset.helpStatus='已确认';}body.onclick=e=>{const id=e.target.closest('[data-new-action]')?.dataset.newAction;if(id==='coupons')requireLogin(()=>go('new-coupons'));if(id==='sync')requireLogin(()=>{context.memberIntent='restore';go('new-member-sync');});if(id==='renew')go('new-member');};}

function grayDialog(root,title,message,done){const mask=document.createElement('div');mask.className='retry-prompt-mask';const panel=document.createElement('div');panel.className='retry-prompt';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',title);panel.innerHTML=`<strong>${esc(title)}</strong><p>${esc(message)}</p><button class="confirmed-button primary-gray" data-escape-dismiss>完成</button>`;root.append(mask,panel);panel.querySelector('button').onclick=()=>{mask.remove();panel.remove();done?.();};}
function renderFeedback(root){if(!state.logged){const body=grayPage(root,`<p>登录后可提交问题反馈</p>${act('Google 登录后反馈','feedback-login',true)}`);body.onclick=e=>{if(e.target.closest('[data-new-action=feedback-login]'))feedbackLogin(()=>go('new-feedback',false));};return;}const types=['人物异常','效果不符','内容缺失','生成失败','其他'];const body=grayPage(root,`<h2>告诉我们哪里不满意</h2><p>问题类型</p><div class="confirmed-feedback-types">${types.map(t=>`<button aria-pressed="${context.feedbackType===t}" class="confirmed-button ${context.feedbackType===t?'selected':''}" data-feedback="${t}">${context.feedbackType===t?'●':'○'} ${t}</button>`).join('')}</div><label>补充说明（选填）<textarea aria-label="反馈补充说明" placeholder="描述问题，方便我们排查">${esc(context.feedbackText)}</textarea></label>${act('提交反馈','submit',true)}`);body.querySelector('textarea').oninput=e=>context.feedbackText=e.target.value;body.onclick=e=>{const type=e.target.closest('[data-feedback]')?.dataset.feedback;if(type){context.feedbackType=type;renderFeedback(root);return;}if(e.target.closest('[data-new-action="submit"]'))feedbackLogin(()=>{if(!context.feedbackType){toast('请选择问题类型');return;}refreshWallet();context.retryOrigin=context.feedbackOrigin;grayDialog(root,'感谢反馈','感谢你的反馈，我们会持续优化效果。',()=>{refreshWallet();if(context.retryCount<2)go('new-retry');else returnFeedbackOrigin();});})};}
function enhanceModal(k,sheet){if(k==='login'&&pendingFeedbackLogin){const cancel=event=>{event?.stopPropagation();cancelFeedbackLogin();};sheet.parentElement.querySelector('.modal-mask').onclick=cancel;for(const button of sheet.querySelectorAll('[data-action="关闭"],[data-action="关闭登录弹窗"]'))button.onclick=cancel;}if(k==='failed'&&state.type!=='video'){stopTimer();const h=parseFloat(sheet.style.height)||190,w=parseFloat(sheet.style.width)||303;sheet.style.height=(h+48)+'px';const svg=sheet.querySelector('svg');if(svg)svg.style.height=h+'px';const feedback=grayButton(sheet,'问题反馈',20,h+5,w-40,30,()=>gotoFeedback('failed'));feedback.setAttribute('data-help-title','问题反馈');feedback.setAttribute('data-help','登录后反馈本次生成失败。未登录先显示Google登录；取消登录会返回本次失败结果。');}}

// 给原有彩色 UI 增加既有需求中的入口。原生控件与文字仍沿用 Sketch 备份。
function moveBelow(root,threshold,delta){const svg=root.querySelector(':scope>svg');if(!svg)return;const content=[...svg.children].find(e=>e.tagName.toLowerCase()==='g');if(!content)return;const wrap=document.createElementNS(NS,'g');wrap.setAttribute('transform',`translate(0 ${delta})`);const moving=[...content.children].filter(e=>{try{const b=e.getBBox(),m=e.getCTM(),pt=new DOMPoint(b.x,b.y).matrixTransform(m);return pt.y>=threshold-1&&b.height<700;}catch{return false;}});for(const e of moving)wrap.appendChild(e);content.appendChild(wrap);for(const e of root.querySelectorAll('.hotspot,.text-input'))if(parseFloat(e.style.top)>=threshold-8)e.style.top=(parseFloat(e.style.top)+delta)+'px';const h=Number($('#phone').dataset.height)+delta;$('#phone').dataset.height=h;const vb=svg.getAttribute('viewBox')?.split(/[ ,]+/).map(Number);if(vb){vb[3]=h;svg.setAttribute('viewBox',vb.join(' '));}svg.setAttribute('height',h);svg.style.height=h+'px';}
function profileLayout(root,k){
 const source=root.querySelector(':scope>svg'),layers=entries(k),menu=layers.find(l=>l.type==='rectangle'&&l.x===20&&l.y===210&&l.w===335);if(!source||!menu)return;
 const nav=layers.find(l=>l.type==='rectangle'&&l.x<=0&&l.w>=375&&l.h>=70&&l.h<=90&&l.y>650),navTop=nav?.y||731;
 const banner=layers.find(l=>l.type==='group'&&l.w===320&&l.h===50&&l.y>600),hasBanner=typeof adAllowed!=='function'||adAllowed('个人中心下方横幅广告');
 if(state.logged&&k==='profile-in'){for(const layer of layers)if(layer.text?.includes('你的创意'))hide(root,layer);const name=layers.find(l=>l.text==='谷歌名称');if(name){const badge=document.createElement('div');badge.className='profile-user-id';badge.textContent='用户 ID：'+window.USER_IDENTITY.currentId();badge.style.cssText=`position:absolute;left:${name.x}px;top:${name.y+name.h+7}px;font-size:11px;line-height:18px;color:#d5c8e8;z-index:4`;badge.dataset.helpTitle='用户ID';badge.dataset.help=window.USER_IDENTITY.help;root.append(badge);}}
 const pane=document.createElement('section');pane.className='profile-content';pane.setAttribute('aria-label','个人中心内容');pane.style.cssText=`top:184px;height:${(hasBanner&&banner?banner.y-12:navTop-10)-184}px`;
 const inside=document.createElement('div');inside.className='profile-content-inner';inside.style.height=(126+menu.h)+'px';pane.appendChild(inside);
 const menuSvg=document.createElementNS(NS,'svg');menuSvg.classList.add('profile-menu-svg');menuSvg.setAttribute('viewBox',`0 ${menu.y} 375 ${menu.h}`);menuSvg.setAttribute('width','375');menuSvg.setAttribute('height',menu.h);menuSvg.style.cssText=`top:126px;height:${menu.h}px`;
 const group=document.createElementNS(NS,'g');group.setAttribute('fill','none');group.setAttribute('fill-rule','evenodd');menuSvg.appendChild(group);
 const elements=new Set(layers.filter(l=>l.x>=menu.x-1&&l.x+l.w<=menu.x+menu.w+1&&l.y>=menu.y-1&&l.y+l.h<=menu.y+menu.h+1).map(l=>node(root,l.id)).filter(Boolean));
 const highest=[...elements].filter(el=>{for(let parent=el.parentElement;parent&&parent!==source;parent=parent.parentElement)if(elements.has(parent))return false;return true;});
 const inverse=source.getCTM().inverse();for(const el of highest){const transform=inverse.multiply(el.parentNode.getCTM()),wrap=document.createElementNS(NS,'g');wrap.setAttribute('transform',`matrix(${transform.a} ${transform.b} ${transform.c} ${transform.d} ${transform.e} ${transform.f})`);wrap.appendChild(el);group.appendChild(wrap);}
 inside.appendChild(menuSvg);
 for(const target of [...root.querySelectorAll(':scope>.hotspot,:scope>.text-input')]){const y=parseFloat(target.style.top);if(y>=menu.y-1&&y<menu.y+menu.h){target.style.top=(126+y-menu.y)+'px';inside.appendChild(target);}}
 root.appendChild(pane);
 grayButton(inside,'会员中心  ›',16,0,167,54,()=>go(member.active?'new-member-active':'new-member')).setAttribute('data-help','进入周卡、月卡和年卡会员页面，查看会员权益或开通状态。');
 grayButton(inside,'邀请有礼  ›',191,0,168,54,()=>go('new-invite')).setAttribute('data-help','进入邀请页，查看好友进度和奖励到账情况。');
 grayButton(inside,state.logged?`我的券  通用 ${wallet.general} · 去水印 ${wallet.watermark}  ›`:'登录后查看我的券  ›',16,62,343,48,()=>requireLogin(()=>go('new-coupons'))).setAttribute('data-help','登录后查看可用通用券、去水印券及使用和过期记录。');
}
function addNavigation(root,k){
 const sourceKey=k==='new-wallpaper'?'profile-in':k==='empty'?'works':k;const l=entries(sourceKey).find(x=>x.type==='text'&&x.text==='首页'&&x.y>650);if(!l)return;
 const originalY=l.y-31,isProfile=['profile','profile-in'].includes(k),sourceNav=isProfile?entries(k).find(x=>x.type==='group'&&x.x<=0&&x.w>=375&&x.y>650&&x.h>=70&&x.h<=90):null,y=k==='new-wallpaper'?740:sourceNav?.y||originalY;
 for(const e of [...root.querySelectorAll('.hotspot')])if(['首页','作品','我的'].includes(e.dataset.action)||e.dataset.action?.startsWith('底部导航 · '))e.remove();
 if(sourceNav)hide(root,sourceNav);
 const bar=document.createElement('div');bar.className='new-nav native-nav'+(isProfile?' profile-four-nav':'');bar.style.top=y+'px';bar.setAttribute('role','navigation');bar.setAttribute('aria-label','主导航');
 const items=[['首页',68,()=>go('home')],['壁纸',0,()=>go('new-wallpaper')],['作品',188,()=>go(state.deleted.length>=3?'empty':'works')],['我的',308,profile]];
 for(const [i,[t,cx,fn]] of items.entries()){
  const btn=document.createElement('button');btn.setAttribute('aria-label',t);btn.onclick=fn;
  if(t==='壁纸'){btn.className='wallpaper-new-tab';btn.innerHTML='<span>▧</span>壁纸';}
  else{const prefix='nav-'+k+'-'+i+'-';let svg=D.svg[k==='new-wallpaper'&&t==='我的'?'home':sourceKey].replace(/id="([^"]+)"/g,(_,id)=>'id="'+prefix+id+'"').replace(/url\(#([^)]*)\)/g,(_,id)=>'url(#'+prefix+id+')').replace(/(href|xlink:href)="#([^"]+)"/g,(_,a,id)=>a+'="#'+prefix+id+'"');btn.innerHTML=svg;const el=btn.querySelector('svg');const cropY=k==='new-wallpaper'&&t==='我的'?entries('home').find(x=>x.type==='text'&&x.text==='首页'&&x.y>650).y-31:originalY;el.setAttribute('viewBox',`${cx-46.875} ${cropY} 93.75 58`);el.setAttribute('width','93.75');el.setAttribute('height','58');el.style.cssText='width:93.75px;height:58px';}
  bar.appendChild(btn);
 }
 root.appendChild(bar);
 const homebar=document.createElement('div');homebar.className='new-homebar';homebar.style.top=(Number($('#phone').dataset.height)-16)+'px';root.appendChild(homebar);
}
function emptySearchBanner(root){
 if(!configured('首页下方横幅广告'))return;
 const banner=document.createElement('div');banner.className='new-empty-search-banner';banner.dataset.adPlacement='empty-search-banner';banner.setAttribute('aria-label','首页搜索无结果底部横幅广告');banner.style.cssText='position:absolute;left:27.5px;top:740px;width:320px;height:50px;box-sizing:border-box;border:1px solid #d8ad22;border-radius:5px;background:#ffe16a;color:#352b00;display:flex;align-items:center;justify-content:center;text-align:center;font:600 13px/1.4 sans-serif';
 const label=document.createElement('span');label.textContent='横幅广告';const size=document.createElement('small');size.textContent='Banner320×50';size.style.cssText='display:block;font:11px/1.4 sans-serif';label.appendChild(size);banner.appendChild(label);
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','关闭本页横幅广告');close.style.cssText='position:absolute;right:3px;top:2px;width:20px;height:20px;border:0;border-radius:50%;background:transparent;color:#6b5810;font:18px/1 sans-serif;cursor:pointer';close.onclick=()=>{banner.remove();status('已关闭本页横幅广告（本地演示）');};banner.appendChild(close);root.appendChild(banner);
}
function enhance(k,root){
 refreshWallet();root.classList.remove('wireframe');const banner=['home','search','no-search'].includes(k)?'首页下方横幅广告':['detail-image','detail-video'].includes(k)?'模板详情下方横幅广告':['profile','profile-in'].includes(k)?'个人中心下方横幅广告':['works','work-image','work-video','empty'].includes(k)?'作品下方横幅广告':'制作完成下方横幅广告';if(typeof adAllowed==='function'&&!adAllowed(banner))hideBanner(root,k);if(k==='creating'&&!adAllowed('正在制作原生广告卡片'))hide(root,{id:'lF04D33D1B6274F68B07C7758DF3592E4'});if(['home','works'].includes(k)&&!adAllowed('模板原生广告')){const left=195,top=k==='home'?459:409;for(const layer of entries(k).filter(x=>x.x>=left&&x.x<left+165&&x.y>=top&&x.y<top+266))hide(root,layer);}
 if(k==='no-search')emptySearchBanner(root);
 if(hasPreparedRetry()){
  window.RETRY_PHOTOS?.enhance(k,root);
  const begin=root.querySelector('[data-action="开始制作"]');if(begin){begin.dataset.helpTitle='开始本次重试';begin.dataset.help='模板不变，可保留或重新选择照片后开始。本次不显示制作前插页，VIP体验资格沿用；选图不扣次数，实际开始才扣一次反馈重试机会，保存广告仍按原规则。';begin.dataset.helpStatus='已确认';}
  const previous=root.querySelector('[data-action="返回"]');if(previous)previous.onclick=exitPreparedRetry;
 }
 if(['profile','profile-in'].includes(k))profileLayout(root,k);
 if(k==='home')grayButton(root,'邀请有礼',273,48,86,28,()=>go('new-invite'));
 if(['home','works','empty','profile','profile-in'].includes(k))addNavigation(root,k);
 if(k==='complete'&&state.type!=='video'){
  const label=find(k,'模板名称');if(label){setText(root,label,'问题反馈');const meaning='登录后反馈本次刚制作完成的结果。未登录先显示Google登录；取消登录会留在本次结果页。已有作品详情没有此入口。',textNode=node(root,label.id);if(textNode){textNode.setAttribute('data-help-title','问题反馈');textNode.setAttribute('data-help',meaning);}const button=region(root,k,'问题反馈',label.x,label.y,label.w,label.h,()=>gotoFeedback(k));button.classList.add('native-feedback-hit');button.setAttribute('data-help-title','问题反馈');button.setAttribute('data-help',meaning);}
 }
 if(k==='saved'&&state.type!=='video'){
  const button=grayButton(root,'问题反馈',150,629,75,22,()=>gotoFeedback(k));button.classList.add('native-feedback-link');button.setAttribute('data-help-title','问题反馈');button.setAttribute('data-help','登录后反馈本次刚完成的图片结果。未登录先显示Google登录；取消后留在本次保存成功页。');
 }
 if(['save-image','confirm-video'].includes(k)){
  const b=root.querySelector('[data-action="确认保存"]');if(b)b.onclick=()=>{const proceed=()=>{if(state.quality==='standard'||state.unlocks[state.quality+'-'+state.type])finishSave();else unlockSave();};if(window.VIP_ACCESS?.beforeResultAction(proceed))return;proceed();};
 }
}
function cancelLoginIntent(){
 context.afterLogin=null;
 pendingFeedbackLogin=null;
}
window.NEW_UI={cancelLoginIntent,loginForCouponReward(then){requireLogin(then);},grantInviteReward(id,type,count,expiry=Date.now()+15*86400000,at){if(!state.logged||couponBatches.some(b=>b.cycleId===id))return false;grant(type,count,expiry,'邀请奖励',{cycleId:id,at});return true;},get couponAudit(){return JSON.parse(JSON.stringify({account:{id:COUPON_ACCOUNT,userId:window.USER_IDENTITY.currentId(),name:state.name||'Google演示账号',label:'当前演示账号',member:Boolean(member.active&&memberPaymentConfirmed()&&member.expiry>Date.now())},batches:couponBatches,ledger}));},grantAdCoupon(id,expiry){if(!state.logged||couponBatches.some(b=>b.cycleId===id))return false;grant('general',1,expiry,'广告观看奖励',{cycleId:id});return true;},render:renderNew,enhance,unlockWatermark,beginPreparedRetry,hasPreparedRetry,exitPreparedRetry,requestPreparedRetryExit,clearPreparedRetry:()=>{closeRetryExitDialog(false);preparedRetry=null},get preparedRetry(){return preparedRetry?{...preparedRetry}:null},wallpaper:{prepare:prepareWallpaper,retry:retryWallpaper,complete:completeWallpaper,cancel:cancelWallpaper,apply:applyWallpaper,setAdapter(adapter){wallpaperAdapter=typeof adapter==='function'?adapter:localWallpaperAdapter;},get result(){if(!wallpaperAttempt)return null;const {promise,...result}=wallpaperAttempt;return JSON.parse(JSON.stringify(result));},get pending(){return {...pendingWallpaper}}},get context(){return context},get wallet(){refreshWallet();return wallet},get member(){return member},get batches(){return couponBatches},get ledger(){return JSON.parse(JSON.stringify(ledger))},goFeedback:gotoFeedback,afterLogin,saveFailed,refresh:refreshWallet,enhanceModal,adsRemoved:()=>typeof adAllowed==='function'?!adAllowed('制作同款开始制作插页广告'):member.active&&state.logged};
const originalReset=$('#reset').onclick;$('#reset').onclick=()=>{window.RETRY_PHOTOS?.reset();preparedRetry=null;wallpaperAttempt=null;wallpaperAttemptSequence++;wallpaperAdapter=localWallpaperAdapter;couponBatches=initialCouponBatches();member={active:false,plan:'month',expiry:0,daily:'',benefitsVersion:2,issuedCycles:[],payment:null};pendingWallpaper={};lastSaveSpend=[];ledger=[];invitationRows=[];context.afterLogin=null;context.memberIntent=null;context.memberPlan=null;context.retryCount=0;remember();refreshWallet();context.progress=0;context.used=0;originalReset();};
stopTimer();render();
})();
