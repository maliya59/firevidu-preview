/* V2累计变更审阅层与新增广告的本地模拟。没有真实广告SDK或服务端发奖。 */
(()=>{'use strict';
const S='firevidu-ad-review-v26',E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),day=t=>new Date((t??Date.now())+19800000).toISOString().slice(0,10),expiry=t=>Date.parse(day(t)+'T00:00:00+05:30')+86400000;
let saved={daily:{},reward:{},lastFull:0,counts:{},rewardSequence:0,settings:{B01:true,B02:true,O01:true,O04:true}},session={seen:new Set(),n:0},visit=null,detail=null,full=null,background=0,resumeVisit=null,playback=null,rewardDayTimer=null,pendingConfigRefresh=false;
try{const stored=JSON.parse(localStorage.getItem(S)||'{}'),record=value=>value&&typeof value==='object'&&!Array.isArray(value);if(record(stored)){for(const key of ['daily','reward','counts','settings'])if(record(stored[key]))saved[key]=stored[key];if(Number.isFinite(stored.lastFull)&&stored.lastFull>=0)saved.lastFull=stored.lastFull;if(Number.isSafeInteger(stored.rewardSequence)&&stored.rewardSequence>=0)saved.rewardSequence=stored.rewardSequence;}}catch{}
for(const [key,value]of Object.entries(saved.reward)){if(!value||typeof value!=='object'||Array.isArray(value)){delete saved.reward[key];continue;}value.count=Number.isSafeInteger(value.count)&&value.count>=0?Math.min(5,value.count):value.granted?1:0;if(!Number.isFinite(value.failedAt))value.failedAt=!value.granted&&Number.isFinite(value.at)?value.at:0;delete value.granted;value.pending=false;}
const remember=()=>{try{localStorage.setItem(S,JSON.stringify(saved));}catch{}},ordinary=()=>{window.NEW_UI?.refresh();return !(state.logged&&window.NEW_UI?.member.active);},appVisible=()=>!document.hidden&&document.body.dataset.workspace!=='admin'&&!full,enabled=(id,context={})=>saved.settings[id]!==false&&ordinary()&&(window.AD_CONFIG?.isEnabled(slots[id],'regular',context)!==false),now=()=>Date.now();
const slots={B01:'模板浏览返回插页广告',B02:'券包自愿领券激励广告',O01:'壁纸首页原生广告',O04:'壁纸首页底部横幅广告'};
// The original backend table specifies returning after at least three minutes in the background.
const RESUME_BACKGROUND_MS=180000;
const resumeBrowsingScreens=new Set(['home','search','no-search','categories','works','empty','work-image','work-video','profile','profile-in','about','new-wallpaper','new-wallpaper-search','new-wallpaper-static','new-wallpaper-motion','new-wallpaper-video','new-wallpaper-history-detail','new-coupons','new-coupon-records','new-invite','new-invite-records','new-member-active']);
const rules={
 resume:'回前台开屏：返回桌面后，在后台连续满3分钟再回来，展示一次开屏广告，关闭后回到原页面。普通用户和会员各用独立开关，继承原有配置。不打断广告、选券、保存、输入、会员确认或其他进行中的任务；本次不适合展示就跳过，不补弹，不计入模板浏览返回插页次数。',
 B01:'返回模板列表插页：只浏览未改照片，前台可见累计满10秒；同会话同模板只计一次，每3次有效浏览判断一次。每日最多2次；距任意全屏结束至少120秒。跳过也清空本轮3次，不排队补弹。会员不新增。广告关闭后保留原栏目、搜索和滚动位置。',
 B02:'主动看1条激励领1张当日通用券：仅登录普通用户，每账号每个印度业务日最多成功领取5次，每次1张。奖励完成后发券，印度次日00:00到期；取消或未完成不发券、不占5次领取机会，失败后间隔60秒可重试，成功可继续领取。每次领取事务去重，不抵VIP额外体验；跨日按奖励完成日期计。正式版需服务端核验及跨设备去重。',
 O01:'壁纸列表原生广告与壁纸卡片等大，只在列表中插入单格：前8个真实内容后1个，以后每6个内容后1个，即8、14、20、26…之后。广告不占内容配额，不参与排序；类型/搜索开启新列表后重新按内容计数，同一轮返回和翻页不重复请求已安排槽位。无填充跳过，不晚到补插。',
 O04:'壁纸首页底部横幅：固定在底部导航上方，与列表原生同时存在，独立开关。单次访问一个实例，切类型、搜索和详情返回不刷新；没有自动轮播刷新，无广告时不留空白。普通用户本地默认开启，会员默认关闭。'
};
const details={
 wallpaper:'新增壁纸模块：全部、静态、视频、3D四类和名称搜索；按创建入口归类。精选、VIP可同时存在。支持预览、三个设置目标、静态或动态选择、选券、成功失败回执、历史再次设置及个人照片生成3D。',
 wallpaperHistory:'本页查看用户已使用过的壁纸，包括个人照片创建并使用的3D壁纸。已经成功使用过3D或视频动态效果：再次设置动态只播放1次插页广告，不再看激励广告；再次设为静态无需任何广告。只使用过静态效果：首次升级3D或视频动态仍需正常解锁2次激励，可用通用券抵扣。已完成的动态解锁资格不重复扣券或观看激励，后续动态复用按插页规则；有效VIP免历史动态再设插页。',
 feedback:'本次结果新增问题反馈：登录后选择问题类型并提交，感谢反馈后符合条件才提示免费重做。每日最多2次；回原模板可更换照片，开始制作免制作前插页，退出会提示失去本次机会。保存广告不免。',
 coupon:'新增两类免广告券：通用券抵正常保存、去水印及壁纸激励；专用券只抵去水印。默认0张，主动选择，优先扣快过期券；显示来源、到期及使用/过期记录；失败按原期限返券。',
 member:'新增周卡/月卡/年卡会员，左右滑动卡片展示各自价格与权益：周卡7×24小时，每期开始默认发7张；月卡和年卡每月周期开始默认发30张；每天默认3张日券，印度当日有效。提前续费从已付款期限末尾接续，新周期开始才发券。VIP内容免额外体验广告；会员广告独立配置。付款确认才有会员行，状态有效、已到期或已退款。',
 invite:'新增两阶段邀请奖励：好友注册，邀请人得去水印券；好友首次实际看广告并高清保存成功，双方各得通用券。券15天有效，每天最多5位新好友计奖，进度直接展示。',
 vip:'新增VIP分类、专享标记和登录识别权益。VIP与精选独立；VIP栏目只含VIP，精选VIP优先，9个常规加最多3个随机穿插。普通账号每日2次额外广告体验额度，模板与壁纸共用；额外两条不能用券。',
 badges:'新增统一四角标记：左上精选、右上近7天新增、左下VIP、右下图片/视频/3D；VIP与精选可同时存在，视频不再显示时长。',
 admin:'后台新增五种创建入口、壁纸上传/3D拆分演示、手机比例预览、草稿继续编辑、取消创建、必填翻译完成才能上架、模板VIP筛选及壁纸VIP/精选筛选、会员订单及用券到期记录、反馈时间顺序和提交时剩余重试次数快照。'
};
function dot(el,title,body){if(!el||el.querySelector(':scope>.review-dot')||el.classList.contains('review-dot'))return;if(getComputedStyle(el).position==='static')el.classList.add('review-anchor');const b=document.createElement('span');b.className='review-dot';b.tabIndex=0;b.setAttribute('role','note');b.setAttribute('aria-label','新增内容说明：'+title);b.dataset.helpTitle='新增 · '+title;b.dataset.help=body;b.dataset.helpStatus='本地原型';b.onclick=e=>{e.preventDefault();e.stopPropagation();window.FIELD_HELP?.show({title:'新增 · '+title,description:body,status:'本地原型'},{x:b.getBoundingClientRect().right,y:b.getBoundingClientRect().bottom});};el.appendChild(b);}
function showFull(id,done){const resume=id==='resume';if(full||(!resume&&!ordinary()))return false;stopTimer();const previousFocus=document.activeElement;full={id,done,start:now()};updateDetailVisibility();saved.lastFull=now();remember();const el=document.createElement('div');el.className='review-fullscreen'+(resume?' review-resume-ad':'');el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',resume?'回前台开屏广告':id+'新增广告');if(resume)el.dataset.adPlacement='resume';el.innerHTML=`<strong>${resume?'开屏广告':id==='B01'?'插页广告':'激励广告'}</strong><small>${resume?'返回桌面再回来':id} · 本地模拟，未接入真实广告</small><button data-review-complete>${resume?'关闭广告并返回原页面':id==='B01'?'关闭广告并返回列表':'模拟完整观看并获得奖励'}</button>${id==='B02'?'<button data-review-cancel>取消观看</button>':''}`;el.dataset.helpTitle=resume?'回前台开屏广告':id;el.dataset.help=rules[id];$('#phone').append(el);if(!resume)dot(el,id,rules[id]);const end=reward=>{if(!full)return;const task=full;full=null;el.remove();saved.lastFull=now();remember();updateDetailVisibility();task.done(reward);if(previousFocus?.isConnected)previousFocus.focus?.({preventScroll:true});};el.querySelector('[data-review-complete]').onclick=()=>end(true);el.querySelector('[data-review-cancel]')?.addEventListener('click',()=>end(false));el.querySelector('[data-review-complete]')?.focus?.();return true;}
function safeResumeSurface(){
 if(document.body.dataset.workspace==='admin'||full||state.modal)return false;
 const screen=state.screen,pureTemplateBrowse=['detail-image','detail-video'].includes(screen)&&detail&&!detail.dirty&&!state.uploaded;
 if(!resumeBrowsingScreens.has(screen)&&!pureTemplateBrowse)return false;
 const input=document.activeElement;if(['INPUT','TEXTAREA','SELECT'].includes(input?.tagName)||input?.isContentEditable)return false;
 if($('#phone')?.querySelector('[role="dialog"],[aria-modal="true"],.wp-v2-choice-mask,.wp-v2-dialog-mask')||document.querySelector('.field-help-popup'))return false;
 const ui=window.NEW_UI,vip=window.VIP_ACCESS?.state;
 return !ui?.preparedRetry&&!ui?.context?.afterLogin&&ui?.wallpaper?.result?.status!=='pending'&&!vip?.flow&&!vip?.pendingLogin&&!Object.values(saved.reward).some(row=>row.pending);
}
function resumeFromBackground(visit,t){
 if(!visit||t-visit.at<RESUME_BACKGROUND_MS||!visit.safe||state.screen!==visit.screen||!safeResumeSurface())return false;
 const audience=ordinary()?'regular':'member';
 if(window.AD_CONFIG?.isEnabled('resume',audience,{scene:state.screen})===false)return false;
 return showFull('resume',()=>{});
}
function beforeGo(k,record){if(full)return true;if(k==='new-wallpaper')window.WALLPAPER_RANKING?.restoreHome();const from=state.screen,t=now();if(['splash','ad-image','ad-video'].includes(from)&&k!==from){saved.lastFull=t;remember();}
 if(detail&&from===detail.screen&&k!==from){if(!detail.paused&&appVisible())detail.visible+=t-detail.at;const d=detail;detail=null;if(['home','search'].includes(k)&&d.source===k&&!d.dirty&&d.visible>=10000&&!session.seen.has(d.id)&&ordinary()){session.seen.add(d.id);session.n++;if(session.n===3){session.n=0;const used=saved.daily[day()]||0;if(enabled('B01',{returnSource:d.source})&&used<2&&(!saved.lastFull||t-saved.lastFull>=120000)){saved.daily[day()]=used+1;remember();return showFull('B01',()=>go(k,record));}}}}
 if(['detail-image','detail-video'].includes(k)&&!['detail-image','detail-video'].includes(from)){const meta=window.VIP_ACCESS?.currentTemplate;detail={screen:k,source:from,id:String(meta?.id||k),at:t,visible:0,dirty:false,paused:!appVisible()};}
 if(visit&&!k.startsWith('new-wallpaper')&&!['ad-image','ad-video','vip-experience','new-unlock-progress'].includes(k))visit=null;
 return false;}
function wallpaperFeed(list,round){if(!enabled('O01'))return;visit??={slots:new Map()};const rows=[...list.querySelectorAll('[data-wallpaper-id]')];for(let n=8;n<=rows.length;n+=6){const key=round.id+':'+n;if(!visit.slots.has(key)){const tile=document.createElement('article');tile.className='review-native-tile';tile.dataset.adSlot='O01';tile.dataset.afterContent=String(n);tile.innerHTML='<div class="review-ad wallpaper-phone">原生广告</div><div class="wallpaper-name">广告</div>';visit.slots.set(key,tile);}rows[n-1].after(visit.slots.get(key));}}
function wallpaperBanner(root){if(!['new-wallpaper','new-wallpaper-search'].includes(state.screen))return;const list=root.querySelector('.wallpaper-ranked-grid');if(!enabled('O04')){root.querySelector('[data-ad-slot="O04"]')?.remove();if(list)list.style.height='';return;}visit??={slots:new Map()};if(!visit.banner){visit.banner=document.createElement('div');visit.banner.className='review-wallpaper-banner';visit.banner.dataset.adSlot='O04';visit.banner.textContent='横幅广告';}if(!root.querySelector('[data-ad-slot="O04"]'))root.append(visit.banner);if(list)list.style.height=state.screen==='new-wallpaper-search'?'571px':'416px';}
function rewardRecord(date=day()){
 const row=saved.reward[date]??={count:0,failedAt:0,pending:false};
 let completed=Number.isSafeInteger(row.count)&&row.count>=0?row.count:0;
 // Recover the grant-before-counter-write crash window from already saved local coupon batches.
 for(const batch of window.NEW_UI?.batches||[]){const cycle=String(batch.cycleId||'');if(cycle==='B02:'+date)completed=Math.max(completed,1);else if(cycle.startsWith('B02:'+date+':')){const sequence=Number(cycle.slice(('B02:'+date+':').length));if(Number.isSafeInteger(sequence)&&sequence>0&&sequence<=5)completed=Math.max(completed,sequence);}}
 row.count=Math.min(5,completed);return row;
}
function rewardEntry(root){
 const body=root.querySelector('.confirmed-body');if(!body)return;
 if(!enabled('B02')||!state.logged){body.querySelector('.review-coupon-entry')?.remove();return;}
 const button=body.querySelector('.review-coupon-entry')||document.createElement('button');button.className='review-coupon-entry';button.dataset.newAd='B02';button.type='button';
 const r=rewardRecord(),remaining=5-r.count;
 const label=`激励广告 · ${remaining?'看1条视频，领1张当日通用券':'今日已领满，明日再来'}<br><small>今日已领 ${r.count}/5 · 还可领取 ${remaining} 次</small><br><small>印度时间 ${day()} 24:00到期</small>`;
 if(button.dataset.rewardLabel!==label){button.dataset.rewardLabel=label;button.innerHTML=label;}
 button.disabled=remaining===0||r.pending;button.dataset.helpTitle='B02 自愿领券';button.dataset.help=rules.B02;
 button.onclick=()=>{
  if(!enabled('B02')||!state.logged)return;
  const current=rewardRecord();if(current.count>=5||current.pending)return;
  if(current.failedAt&&now()-current.failedAt<60000){toast('本次未完成，请在60秒后重试；不扣领取次数');return;}
  const attempt={id:'B02-attempt-'+(++saved.rewardSequence),settled:false};current.pending=true;current.pendingId=attempt.id;remember();
  const finish=ok=>{
   if(attempt.settled)return;attempt.settled=true;current.pending=false;delete current.pendingId;
   if(!ok){current.failedAt=now();remember();render();return;}
   const date=day(),record=rewardRecord(date);
   if(record.count<5){
    const sequence=record.count+1,id='B02:'+date+':'+sequence;
    const granted=window.NEW_UI?.grantAdCoupon(id,expiry(now()));
    if(granted||window.NEW_UI?.batches.some(batch=>batch.cycleId===id)){record.count=sequence;record.failedAt=0;toast('已获得1张当日通用券，今日已领 '+sequence+'/5');}
   }
   remember();render();
  };
  if(!showFull('B02',finish))finish(false);
 };
 if(button.parentElement!==body)body.prepend(button);dot(button,'主动看广告领券',rules.B02);
 if(!rewardDayTimer&&typeof setTimeout==='function')rewardDayTimer=setTimeout(()=>{rewardDayTimer=null;if(state.screen==='new-coupons')rewardEntry($('#screen'));},Math.max(10,expiry(now())-now()+10));
}
const step=(n,path,body)=>`还需${n}步到达新增入口：${path}。${body} 登录、广告完成等条件步骤另计，不因演示直接跳过权益判定。`;
function annotate(){
 const root=$('#screen');if(!root)return;const k=state.screen,wanted=new Set();
 const mark=(el,title,body)=>{if(!el)return;wanted.add(el);dot(el,title,body);};
 const action=name=>root.querySelector('[data-action="'+name+'"]');
 const newFeature=body=>details.coupon+' 普通保存一直免费，不属于新增广告或抵扣；这里介绍新增用券功能，不表示按钮原来需要广告。'+body;
 const oneSheet=['new-unlock-save','new-unlock-watermark','new-unlock-progress','new-wallpaper-unlock'].includes(k);
 if(oneSheet){const target=[...root.querySelectorAll('.wf-text,p,strong')].find(e=>/需要解锁|本次设置需解锁/.test(e.textContent));mark(target,'新增用券抵扣弹层',newFeature('本弹层集中展示所需权益、主动选券和剩余广告条数；VIP额外体验不可用券。'));}
 else{
  for(const tab of root.querySelectorAll('.new-nav button')){const name=tab.getAttribute('aria-label');if(name==='壁纸')mark(tab,'壁纸',details.wallpaper);if(name==='我的')mark(tab,'个人中心新增入口',step(1,'我的 → 会员中心 / 邀请有礼 / 我的券',details.member+' '+details.invite+' '+details.coupon));if(name==='作品')mark(tab,'壁纸记录',step(2,'作品 → 壁纸记录',details.wallpaperHistory));}
  const firstTemplate=root.querySelector('.native-template-badges,.vip-template-card');mark(firstTemplate,'模板累计新增流程','图片模板还需2步到反馈入口：打开模板 → 开始制作 → 制作完成页；视频模板还需4步：打开模板 → 开始制作 → 选择画质保存 → 确认保存 → 保存成功页。登录与广告完成条件另计。'+details.badges+' '+details.feedback+' '+rules.B01);
  mark(root.querySelector('[data-vip-category="VIP"]'),'VIP模板栏目',details.vip);
  if(['detail-image','detail-video'].includes(k))mark(action('开始制作'),'后续新增功能',step(k==='detail-video'?3:1,k==='detail-video'?'开始制作 → 选择画质保存 → 确认保存 → 保存成功页的问题反馈':'开始制作 → 制作完成页的问题反馈',details.feedback+' '+details.vip));
  if(['complete','save-video','work-image'].includes(k))mark(action('高清保存'),'新增用券抵扣',newFeature('高清、超清和去水印共用这一条新增说明。高清需1次、超清需2次正常激励；有资格不重复解锁，会员券和邀请券可主动使用。'));
  if(['save-image','confirm-video'].includes(k))mark(action('去水印')||action('右上角去水印'),'新增用券抵扣',newFeature('本保存预览页只标一个抵扣说明点。去水印可主动用专用券或通用券；高清或超清保存可用通用券，普通保存的确认仍免费。'));
  mark(root.querySelector('.native-feedback-hit,.native-feedback-link'),'问题反馈与免费重试',details.feedback);
  if(['home','profile','profile-in'].includes(k))for(const el of root.querySelectorAll('.new-entry')){const label=el.textContent||'';if(/会员中心/.test(label))mark(el,'会员中心',step(1,'会员中心',details.member));else if(/邀请有礼/.test(label))mark(el,'邀请有礼',step(1,'邀请中心',details.invite));else if(/我的券/.test(label))mark(el,'我的券',step(1,'我的券与领券入口',details.coupon+' '+rules.B02));}
  if(k==='vip-experience')mark(root.querySelector('.vip-intro'),'新增VIP体验激励',details.vip+' 两条额外激励都须实际完成，不能用券。黄色按钮进入黄色激励播放页。');
  if(['new-wallpaper','new-wallpaper-search'].includes(k)){mark(root.querySelector('.wallpaper-ranking-controls'),'壁纸类型与搜索',details.wallpaper);const types=new Set();for(const el of root.querySelectorAll('.wallpaper-card')){const type=el.dataset.wallpaperType;if(types.has(type))continue;types.add(type);mark(el,'壁纸详情 · '+({static:'静态',video:'视频',motion:'3D'}[type]||type),step(1,'当前壁纸预览',details.wallpaper));}mark(root.querySelector('[data-action="上传照片，自定义壁纸 +"]'),'照片生成3D',step(1,'个人照片上传页',details.wallpaper));}
  if(k==='works')mark(root.querySelector('[data-wp-v2-tab="wallpapers"]'),'壁纸记录',details.wallpaperHistory);
  // 整个新增页面只标其标题，不把每个按钮再次当作一个新功能。
  if(k.startsWith('new-')&&k!=='new-wallpaper'){
   const heading=root.querySelector('.wp-v2-header h1,.wp-v2-header strong,.wp-setting-result h2,.confirmed-body h2,.retry-prompt strong')||[...root.querySelectorAll('.wf-text')].find(el=>parseFloat(el.style.top)>=40&&parseFloat(el.style.top)<85&&!/^[‹▂]/.test(el.textContent));
   const body=k==='new-wallpaper-history-detail'?details.wallpaperHistory:/wallpaper/.test(k)?details.wallpaper:/member/.test(k)?details.member:/invite/.test(k)?details.invite:/coupon/.test(k)?details.coupon:details.feedback;
   mark(heading,k==='new-wallpaper-history-detail'?'壁纸记录':'新增页面说明',body);
  }
  const adKinds=new Set();for(const el of root.querySelectorAll('[data-ad-slot],.review-coupon-entry')){const kind=el.dataset.adSlot||'B02';if(adKinds.has(kind))continue;adKinds.add(kind);mark(el,kind,rules[kind]);}
 }
 for(const el of root.querySelectorAll('.review-dot'))if(!wanted.has(el.parentElement))el.remove();
 if(document.body.dataset.workspace==='admin')for(const el of document.querySelectorAll('.admin-menu button,.admin-menu a,#admin-content h2,#admin-content label,#admin-content th')){if(el.closest('.metrics-admin'))continue;const title=el.dataset.helpTitle||el.textContent||'';if(el.matches('#admin-content label')&&el.querySelector('[data-filter="featured"]')){el.querySelector('.review-dot')?.remove();continue;}if(/VIP|精选|壁纸|会员|反馈|草稿|取消创建|重试|生成时间|到期时间|翻译|广告配置/.test(title))dot(el,title.slice(0,24),el.dataset.help||details.admin);}
}
function playbackUI(root){if(playback?.newSlot&&['ad-image','ad-video'].includes(state.screen)&&!root.querySelector('.review-playing-ad')){const el=document.createElement('section');el.className='review-playing-ad';el.innerHTML='<strong>'+ (playback.type==='rewarded'?'激励广告':'插页广告')+'</strong><small>本地广告模拟</small>';root.append(el);}for(const el of root.querySelectorAll('[data-vip-access=watch]')){el.classList.add('review-reward-action');}for(const el of root.querySelectorAll('.wp-v2-mode-primary,.wp-v2-mode-static')){if(/观看|广告/.test(el.textContent)&&!/无需|免广告/.test(el.textContent)){el.classList.add('review-reward-action');}}}
function enhance(){const root=$('#screen');playbackUI(root);wallpaperBanner(root);if(state.screen==='new-coupons')rewardEntry(root);annotate();}
const oldRender=render;render=function(){oldRender();enhance();};
let queued=false;const obs=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;playbackUI($('#screen'));wallpaperBanner($('#screen'));annotate();if(state.screen==='new-coupons')rewardEntry($('#screen'));});});obs.observe($('#screen'),{childList:true,subtree:true});obs.observe($('#modal-host'),{childList:true,subtree:true});const adminHost=document.querySelector('#admin-workspace');if(adminHost)obs.observe(adminHost,{childList:true,subtree:true});
// 选图、编辑、制作和弹窗访问使本次详情失去纯浏览资格。
 document.addEventListener('click',event=>{if(!detail||event.target.closest('.review-dot,.review-fullscreen'))return;const el=event.target.closest('button');if(el&&!/返回/.test(el.dataset.action||el.getAttribute('aria-label')||'')&&!el.closest('.review-guide'))detail.dirty=true;},true);
 const originalOpen=openModal;openModal=function(...args){if(detail)detail.dirty=true;return originalOpen(...args);};
 function updateDetailVisibility(){if(!detail)return;const t=now();if(appVisible()){if(detail.paused){detail.paused=false;detail.at=t;}}else if(!detail.paused){detail.visible+=t-detail.at;detail.paused=true;}}
 document.addEventListener('visibilitychange',()=>{const t=now();if(document.hidden){if(!resumeVisit){background=t;resumeVisit={at:t,screen:state.screen,safe:safeResumeSurface()};}updateDetailVisibility();}else{const opportunity=resumeVisit;resumeVisit=null;if(background&&t-background>=1800000){session={seen:new Set(),n:0};visit=null;detail=null;}background=0;updateDetailVisibility();resumeFromBackground(opportunity,t);}});
 window.addEventListener('ad-config-change',()=>{if(document.body.dataset.workspace==='admin')pendingConfigRefresh=true;else{stopTimer();render();}});
 const workspaceObserver=new MutationObserver(()=>{updateDetailVisibility();if(document.body.dataset.workspace!=='admin'&&pendingConfigRefresh){pendingConfigRefresh=false;if(!['splash','creating','ad-image','ad-video'].includes(state.screen)){stopTimer();render();}}});workspaceObserver.observe(document.body,{attributes:true,attributeFilter:['data-workspace']});
 window.addEventListener('keydown',e=>{if(full&&e.key==='Escape'){e.stopImmediatePropagation();e.preventDefault();const ad=document.querySelector('.review-fullscreen');if(full.id==='B01'||full.id==='resume')ad?.querySelector('[data-review-complete]')?.click();else ad?.querySelector('[data-review-cancel]')?.click();}},true);
 window.AD_REVIEW={beforeGo,wallpaperFeed,setPlayback(type,base){playback={type,base,newSlot:(window.VIP_ACCESS?.state?.flow?.domain==='template'&&window.VIP_ACCESS.state.flow.watching)||/vip-experience|new-wallpaper/.test(base)||(base==='new-unlock-progress'&&window.NEW_UI?.context.kind==='wallpaper')};},enhance,rules,details,get snapshot(){return {daily:saved.daily,reward:saved.reward,counts:saved.counts,session:{n:session.n,seen:[...session.seen]}};}};
 const tools=document.querySelector('.tool-right');if(tools){const button=document.createElement('button');button.className='review-audit-toggle';button.textContent='本版更新说明';button.onclick=()=>{window.FIELD_HELP?.show({title:'本版累计更新与广告审阅标记',description:'红点：右键查看新增详情和后续路径。黄色：相对旧版新增的广告位。原有底部横幅保留，本轮不替换。\n\n'+Object.values(details).join('\n\n')+'\n\n'+Object.entries(rules).map(([id,r])=>id+' '+r).join('\n\n'),status:'本地模拟'},{x:button.getBoundingClientRect().left,y:button.getBoundingClientRect().bottom});};tools.prepend(button);}
 const reset=$('#reset').onclick;$('#reset').onclick=()=>{if(full){document.querySelector('.review-fullscreen')?.remove();full=null;for(const row of Object.values(saved.reward))row.pending=false;remember();}session={seen:new Set(),n:0};visit=null;detail=null;background=0;resumeVisit=null;playback=null;reset();};
 enhance();
})();
