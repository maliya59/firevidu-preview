/* 邀请界面与后台查询共用同一份演示关系。正式下载链接和安装归因待接入。 */
(()=>{'use strict';const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),H=(t,d)=>`data-help-title="${E(t)}" data-help="${E(d)}" data-help-status="已确认"`,ID=window.USER_IDENTITY.currentId(),key='firevidu-invite-v2',core=window.INVITE_CORE.create({currentId:ID,read:()=>JSON.parse(localStorage.getItem(key)||'null'),write:value=>localStorage.setItem(key,JSON.stringify(value))});let bindingSource='手动输入',message='';
const logged=()=>Boolean(window.__DEMO__?.state.logged),date=t=>t?new Date(t).toLocaleString('zh-CN',{timeZone:'Asia/Kolkata',hour12:false}):'—',code=()=>core.code(ID),bound=()=>core.state.bindings.find(b=>b.userId===ID),goPage=k=>go(k),button=(t,a,primary=false)=>`<button type="button" class="confirmed-button ${primary?'primary-gray':''}" data-invite="${a}"${a==='close-sheet'?' data-escape-dismiss':''}>${t}</button>`;
const rules='完成绑定和首次广告高清保存、奖励全部发放后，满7天的好友记录可在邀请历史查看。好友登录并绑定邀请码后，邀请人得1张去水印券；首次实际看广告完成高清保存后，双方各得1张通用券。普通免费保存、用券保存和券加广告不计。奖励发放后15天有效，同一好友每阶段一次。每位邀请人每个印度自然日最多5位新好友获得计奖资格；已绑定不可更换，不可自邀或循环邀请。';
const link=()=>`https://maliya59.github.io/firevidu-preview/?invite=${encodeURIComponent(code())}`;
const shareText=()=>`来FireVidu制作你的同款！\nGoogle Play下载：下载链接\n邀请链接：${link()}\n我的邀请码：${code()}\n下载后打开“我的 → 邀请有礼 → 填写邀请码”，登录并绑定。首次看广告完成高清保存，我们各得1张通用券。`;
function shell(root,title,html){root.classList.remove('wireframe');root.classList.add('invite-screen');document.querySelector('#phone').dataset.height='812';root.innerHTML=`<section class="invite-phone"><div class="invite-status">9:41 <span>▂▄▆ ▰</span></div><header><button aria-label="返回" data-invite="back">‹</button><h1>${title}</h1></header><main class="invite-body">${html}</main><div class="invite-home"></div></section>`;root.onclick=e=>action(e,root);return root.querySelector('main');}
function login(next){if(logged()){next();return;}window.NEW_UI.context.afterLogin=next;openModal('login');}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('已复制');}catch{toast('复制失败，请长按复制内容');}}
titles['new-invite-records']='邀请记录';
let recordTab='recent';
const noticeKey='firevidu-invite-reward-notices-v1';
let seenNotices=new Set();
try{
 const saved=JSON.parse(localStorage.getItem(noticeKey)||'[]');
 if(Array.isArray(saved))seenNotices=new Set(saved);
 // Persist example dates so that the history threshold is stable on refresh.
 if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(core.state));
}catch{}
function rewardRows(binding){
 if(!binding.eligible)return [];
 const prefix='invite:'+binding.userId;
 const entries=[];
 if(binding.registrationRewardAt)entries.push({id:prefix+':registration:'+ID,userId:binding.userId,label:'去水印券',at:binding.registrationRewardAt});
 if(binding.rewardAt)entries.push({id:prefix+':save:'+ID,userId:binding.userId,label:'通用券',at:binding.rewardAt});
 return entries;
}
function syncRewardWallet(){
 for(const reward of core.state.rewards||[]){
  if(reward.userId!==ID||reward.expiry<=Date.now())continue;
  window.NEW_UI?.grantInviteReward(reward.id,reward.type,reward.count,reward.expiry,reward.at);
 }
}
function notifyRewards(){
 const state=window.__DEMO__?.state;
 if(!logged()||state.modal||!['home','profile-in','new-invite'].includes(state.screen)
    ||document.body.dataset.workspace==='admin'||document.querySelector('.invite-reward-notice'))return;
 syncRewardWallet();
 const {recent,history}=core.invitationRecords();
 const recentRewards=recent.flatMap(rewardRows).filter(row=>!seenNotices.has(row.id));
 const historyRewards=history.flatMap(rewardRows).filter(row=>!seenNotices.has(row.id));
 const rewards=[...recentRewards,...historyRewards];
 if(!rewards.length)return;
 const mask=document.createElement('div');
 mask.className='invite-reward-notice';
 mask.innerHTML='<section role="status" aria-label="邀请奖励已发放">'
  +'<h2>邀请奖励已发放</h2><ul>'+rewards.map(row=>'<li>已成功邀请 '+E(row.userId)+'，获得 1 张'+row.label+'。</li>').join('')+'</ul>'
  +'<button type="button" class="confirmed-button primary-gray" data-notice="records">查看邀请记录</button>'
  +'<button type="button" class="confirmed-button" data-notice="dismiss" data-escape-dismiss>知道了</button></section>';
 mask.onclick=event=>{
  event.stopPropagation();
  const action=event.target.closest('[data-notice]')?.dataset.notice;
  if(!action)return;
  for(const reward of rewards)seenNotices.add(reward.id);
  try{localStorage.setItem(noticeKey,JSON.stringify([...seenNotices]));}catch{}
  mask.remove();
  if(action==='records'){recordTab=recentRewards.length?'recent':'history';goPage('new-invite-records');}
 };
 document.querySelector('#screen').append(mask);
}
function friendCard(binding){
 const rewards=rewardRows(binding);
 const saved=binding.firstSaveAt?'首次广告高清保存已完成':'等待好友首次看广告完成高清保存';
 return '<article class="invite-friend-card" data-invited-user="'+E(binding.userId)+'"><strong>用户 ID '+E(binding.userId)+'</strong>'
  +'<p>绑定于 '+date(binding.boundAt)+' · '+E(binding.source)+'</p>'
  +(binding.eligible?'<ul class="invite-reward-list">'+rewards.map(row=>'<li>'+row.label+' × 1 <strong>已发放</strong><small>'+date(row.at)+'</small></li>').join('')
   +(!binding.registrationRewardAt?'<li>绑定奖励发放中</li>':'')
   +(!binding.rewardAt?'<li>通用券 '+(binding.firstSaveAt?'发放中':'待完成')+'</li>':'')+'</ul><p>'+saved+'</p>':'<p>本次绑定未获得计奖资格。</p>')
  +(binding.completedAt?'<p>完成于 '+date(binding.completedAt)+'</p>':'')
  +(binding.eligible&&!binding.firstSaveAt?button('复制提醒给好友','remind'):'')+'</article>';
}
function showRecords(root){
 const {recent,history}=core.invitationRecords();
 const body=shell(root,'邀请记录','<div class="invite-record-tabs" role="group" aria-label="邀请记录类别">'
  +'<button type="button" data-record-tab="recent" aria-pressed="'+(recordTab==='recent')+'">近期邀请</button>'
  +'<button type="button" data-record-tab="history" aria-pressed="'+(recordTab==='history')+'">邀请历史</button></div>'
  +'<input type="search" class="invite-record-search" aria-label="搜索受邀用户 ID" placeholder="搜索受邀用户 ID">'
  +'<div class="invite-record-list"></div>');
 const search=body.querySelector('input');
 const list=body.querySelector('.invite-record-list');
 const records=recordTab==='history'?history:recent;
 const draw=()=>{
  const query=search.value.trim();
  const matching=records.filter(row=>String(row.userId).includes(query));
  list.innerHTML=matching.map(friendCard).join('')||'<p class="invite-muted">'+(query?'没有匹配的邀请记录':'暂无邀请记录')+'</p>';
 };
 body.querySelector('.invite-record-tabs').onclick=event=>{
  const tab=event.target.closest('[data-record-tab]')?.dataset.recordTab;
  if(!tab||tab===recordTab)return;
  recordTab=tab;
  showRecords(root);
  root.querySelector('[data-record-tab="'+tab+'"]').focus({preventScroll:true});
 };
 search.oninput=draw;
 draw();
}
function progress(){
 const {recent}=core.invitationRecords();
 return '<div class="invite-heading-row"><h2>我邀请的好友</h2></div>'
  +recent.map(friendCard).join('')
  +(recent.length?'':'<p class="invite-muted">暂无近期邀请。</p>');
}
function render(k,root){if(!['new-invite','new-invite-share-new','new-invite-records','new-invite-bind','new-invite-detected'].includes(k))return false;
if(k==='new-invite-detected'){bindingSource='自动识别';if(!bound()&&!core.state.pending)core.pending('FV100102');return render('new-invite-bind',root);}
if(k==='new-invite-share-new'){shell(root,'分享邀请',`<h2>和好友一起领券</h2><p class="invite-muted">分享内容包含下载地址、邀请语、邀请链接和邀请码。</p><textarea readonly aria-label="邀请分享内容" class="invite-share-copy">${E(shareText())}</textarea><p class="invite-muted" ${H('链接接入','这是可分享的原型邀请链接，能够演示识别和绑定。正式Google Play下载地址及安装归因尚未配置，不能保证下载安装后自动识别。')}>“下载链接”为Google Play下载地址占位。</p>${button('复制全部邀请内容','copy-share',true)}<div class="invite-channels">${['WhatsApp','Instagram','更多'].map(t=>button(t,'channel')).join('')}</div><div class="invite-banner">提醒好友：没有自动识别时，去“我的 → 邀请有礼 → 填写邀请码”。</div>`);return true;}
if(k==='new-invite-bind'){const b=bound(),pending=core.state.pending||'';shell(root,'填写邀请码',b?`<h2>已绑定邀请人</h2><div class="invite-code-box"><strong>用户ID：${b.inviterId}</strong><p>邀请码 ${b.code}</p><small>${date(b.boundAt)} · ${b.source}</small></div><p>${!b.eligible?'绑定成功，本次邀请奖励名额已满，不参与计奖。':b.firstSaveAt?'首次广告高清保存已完成。':'再完成首次看广告高清保存，你和好友各得1张通用券。'}</p><p class="invite-muted">绑定后不能更换邀请人。</p>${button('去制作','make',true)}`:`<h2>${pending?'已识别到好友邀请码':'输入好友的邀请码'}</h2><p class="invite-muted">${logged()?'确认后绑定邀请人，完成任务领取奖励。':'无需登录也能继续浏览；参与邀请奖励需要先登录，邀请码会为你保留。'}</p><label class="invite-code-label">好友邀请码<input aria-label="好友邀请码" maxlength="12" value="${E(pending)}" placeholder="如 FV100102"></label><p class="invite-form-error" role="alert">${E(message)}</p>${button(logged()?'确认绑定':'Google 登录后绑定','bind',true)}${button('暂不参与，继续浏览','browse')}<p class="invite-muted">仅新用户可参与绑定奖励；只能绑定一次，不能填写自己的邀请码。未识别时可手动输入。</p>`);return true;}
if(k==='new-invite-records'){if(logged())showRecords(root);else shell(root,'邀请记录',`<p>登录后查看邀请记录和奖励。</p>${button('Google 登录','login',true)}`);return true;}
const b=bound(),pending=core.state.pending;shell(root,'邀请有礼',`<h2>邀请好友，分两步领券</h2><div class="invite-reward-row"><article><strong>好友绑定邀请码</strong><p>你得1张去水印券</p></article><article><strong>好友首次广告高清保存</strong><p>双方各得1张通用券</p></article></div><section class="invite-code-box" ${H('我的邀请码','固定关联用户ID，昵称变化不改变。复制邀请码或分享邀请内容；好友手动输入和链接识别都绑定同一邀请人。')}><span>我的邀请码</span><strong>${logged()?code():'登录后显示'}</strong>${button(logged()?'复制邀请码':'Google 登录查看','copy-code')}</section>${button('立即邀请','share',true)}${button('邀请记录','records')}<div class="invite-binding-entry"><strong>${b?'我的邀请人：'+b.inviterId:pending?'已识别到邀请码 '+E(pending):'收到好友的邀请码？'}</strong><p>${b?'已绑定，不可更换':pending?'登录确认后即可绑定，未登录也可继续浏览。':'没有自动识别？在这里手动填写。'}</p>${button(b?'查看绑定和任务':pending?'确认邀请码':'填写邀请码','enter')}</div>${logged()?progress():'<p class="invite-muted">登录后查看我邀请的好友及奖励进度。</p>'}<p class="invite-muted">奖励15天有效 · 每日最多5位新好友计奖</p>${button('活动规则','rules')}`);return true;}
function action(e,root){const a=e.target.closest('[data-invite]')?.dataset.invite;if(!a)return;if(a==='back'){back();return;}if(a==='records'){recordTab='recent';goPage('new-invite-records');return;}if(a==='login'){login(()=>goPage('new-invite-records'));return;}if(a==='copy-code'){if(!logged())login(()=>goPage('new-invite'));else copy(code());return;}if(a==='share'){login(()=>goPage('new-invite-share-new'));return;}if(a==='copy-share'){copy(shareText());return;}if(a==='channel'){const node=document.createElement('div');node.className='invite-sheet-mask';node.innerHTML=`<section class="invite-sheet" role="dialog" aria-label="分享预览"><h2>发送给好友的内容</h2><p>${E(shareText()).replace(/\n/g,'<br>')}</p><small>原型只展示分享内容，未发送消息。</small>${button('关闭','close-sheet')}</section>`;root.append(node);return;}if(a==='close-sheet'){e.target.closest('.invite-sheet-mask').remove();return;}if(a==='enter'){message='';bindingSource=core.state.pending?'自动识别':'手动输入';goPage('new-invite-bind');return;}if(a==='bind'){const value=root.querySelector('input').value;if(value.trim().toUpperCase()!==core.state.pending)bindingSource='手动输入';core.pending(value);login(()=>{const result=core.bind({code:value,logged:true,source:bindingSource});message=result.ok?'':result.error;goPage('new-invite-bind');if(result.ok)toast(result.duplicate?'已绑定，无需重复操作':'绑定成功，去完成首次广告高清保存');});return;}if(a==='browse'){goPage('home');return;}if(a==='make'){goPage('home');return;}if(a==='remind'){copy(`打开FireVidu → 我的 → 邀请有礼，登录并填写邀请码 ${code()}。已绑定后，首次看广告完成高清保存，我们各得1张通用券。`);return;}if(a==='rules'){const node=document.createElement('div');node.className='invite-sheet-mask';node.innerHTML=`<section class="invite-sheet" role="dialog" aria-label="邀请规则"><h2>活动规则</h2><p>${rules}</p>${button('关闭','close-sheet')}</section>`;root.append(node);}}
function admin(root){root.classList.add('admin-new');const all=core.state.bindings,ids=[ID,...new Set(all.flatMap(b=>[b.userId,b.inviterId]))].filter((v,i,a)=>a.indexOf(v)===i);root.innerHTML=`<section class="invite-admin"><h1>邀请关系查询</h1><p class="invite-muted">示例关系与App共用；显示绑定到的邀请人用户ID。</p><form><label>用户ID或邀请人ID<input aria-label="邀请用户查询" placeholder="输入用户ID或邀请人ID"></label><button class="admin-btn blue">查询</button><button type="button" class="admin-btn" data-invite-admin-reset>重置</button></form><div class="invite-admin-result"></div></section>`;const draw=word=>{root.querySelector('.invite-admin-result').innerHTML=`<table><thead><tr><th>用户ID</th><th>邀请码</th><th>邀请人数</th><th>已完成任务人数</th><th>绑定的邀请人ID</th><th>绑定来源 / 时间</th><th>操作</th></tr></thead><tbody>${ids.filter(id=>!word||id.includes(word)||all.find(b=>b.userId===id)?.inviterId.includes(word)).map(id=>{const parent=all.find(b=>b.userId===id),children=all.filter(b=>b.inviterId===id);return `<tr><td>${id}</td><td>${core.code(id)}</td><td>${children.length}</td><td>${children.filter(b=>b.firstSaveAt).length}</td><td>${parent?.inviterId||'未绑定'}</td><td>${parent?parent.source+' / '+date(parent.boundAt):'—'}</td><td>${children.length?`<button class="metrics-detail-link" data-invite-user="${id}">查看好友</button>`:'—'}</td></tr>`;}).join('')||'<tr><td colspan="7">暂无记录</td></tr>'}</tbody></table>`;for(const b of root.querySelectorAll('[data-invite-user]'))b.onclick=()=>adminDetail(root,b.dataset.inviteUser);};draw('');root.querySelector('form').onsubmit=e=>{e.preventDefault();draw(root.querySelector('input').value.trim());};root.querySelector('[data-invite-admin-reset]').onclick=()=>{root.querySelector('input').value='';draw('');};return true;}
function adminDetail(root,id){const mask=document.createElement('div');mask.className='metrics-detail-mask';const rows=core.state.bindings.filter(b=>b.inviterId===id);mask.innerHTML=`<section class="metrics-detail-dialog" role="dialog" aria-label="邀请好友明细"><header><h2>用户 ${id} 邀请的好友</h2><button aria-label="关闭好友明细">×</button></header><table><thead><tr><th>好友用户ID</th><th>邀请码</th><th>绑定时间</th><th>绑定奖励</th><th>首次广告高清保存</th><th>双方奖励</th></tr></thead><tbody>${rows.map(b=>`<tr><td>${b.userId}</td><td>${b.code}</td><td>${date(b.boundAt)}</td><td>${b.registrationRewardAt?'已到账':'发放中'}</td><td>${b.firstSaveAt?'已完成':'待完成'}</td><td>${b.rewardAt?'已到账':'待完成'}</td></tr>`).join('')||'<tr><td colspan="6">暂无邀请好友</td></tr>'}</tbody></table></section>`;root.append(mask);mask.querySelector('button').onclick=()=>mask.remove();mask.onclick=e=>{if(e.target===mask)mask.remove();};}
let saveEligibility={};
function noteSaveUnlock(method,quality){quality=quality||window.__DEMO__?.state.quality||'hd';if(method)saveEligibility[quality]=method;}
function resetSaveEligibility(){saveEligibility={};}
function recordSuccessfulSave(quality){recordSave({quality,method:saveEligibility[quality]});}
function recordSave(details){const b=core.completeSave({logged:logged(),...details});if(!b)return;if(window.NEW_UI.grantInviteReward('invite:'+b.userId+':save:'+ID,'general',1,b.rewardAt+15*86400000,b.rewardAt))toast('邀请任务完成，1张通用券已到账');}
for(const [key,title]of [['new-invite-bind','填写邀请码'],['new-invite-detected','邀请链接已识别']]){titles[key]=title;const b=document.createElement('button');b.textContent=title;b.dataset.key=key;b.onclick=()=>goPage(key);document.querySelector('#screen-list').append(b);}
try{const incoming=new URL(location.href).searchParams.get('invite');if(incoming){core.pending(incoming);Promise.resolve().then(()=>goPage('new-invite-detected'));}}catch{}
window.INVITE_UI={render,admin,notifyRewards,recordSave,noteSaveUnlock,resetSaveEligibility,recordSuccessfulSave,core,clearPage(){document.querySelector('#screen')?.classList.remove('invite-screen');}};
})();
