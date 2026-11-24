/* 全部账号的只读券查询；数据来自 COUPON_AUDIT，不写余额、流水或会员权益。 */
(()=>{'use strict';
const KEY='admin-new-coupon-records';
const SOURCES={ad:'广告观看奖励',invite:'邀请奖励',member:'会员赠券',other:'其他来源'};
const TYPES={general:'通用券',watermark:'去水印专用券'};
const KINDS=['发放','使用','过期'];
const emptyFilters=()=>({keyword:'',source:'',type:'',kind:'',start:'',end:''});
let activeTab='accounts',draft=emptyFilters(),applied=emptyFilters(),pages={accounts:1,events:1},pageSize=10,rootRef=null,detail=null,returnFocus=null,ledgerContext=null,summaryState=null;
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const H=(title,body)=>`data-help-title="${E(title)}" data-help="${E(body)}" data-help-status="本地原型"`;
const COUNT_HELP='汇总为该账号当前全部券的累计记录，不随当前来源、操作或时间筛选重算。';
const HELP={
 '用户ID':window.USER_IDENTITY?.help||'系统分配的固定用户ID。',
 '账号类型':'展示快照记录的会员身份，不将只有券的普通用户认定为会员。',
 '可用通用券':'当前未过期、可用于正常高清/超清保存、去水印或壁纸设置的通用券总数；不抵VIP额外体验。',
 '可用去水印券':'当前未过期的去水印专用券数量，只能用于去水印。',
 '累计发放':COUNT_HELP,
 '消耗':'实际成功抵扣的券数量；失败且未完成抵扣的不计消耗。'+COUNT_HELP,
 '过期':'已到期失效且未被消耗的券数，不等同于当前剩余或可用数量。'+COUNT_HELP,
 '来源':'显示券的实际领取来源，如广告观看奖励、邀请奖励或会员赠券。右键具体来源可核对关联记录。',
 '券种':'通用券与去水印专用券用途不同，不能互相转换。',
 '发放数量':'这次领取实际发放的券数量。',
 '剩余 / 可用':'剩余包含已经到期但未使用的张数；可用只含当前未过期张数，不能把到期剩余当成可用余额。',
 '发放时间':'这次领取的实际发放时间，按印度标准时间展示。',
 '到期时间':'该批券的原到期时间。使用不改变到期时间，过期不补新券；未知期限不从使用时间推算。',
 '奖励事务':'关联广告奖励或其他发券业务的事务编号。没有关联编号时显示未记录，不生成模拟生产交易号。',
 '操作时间':'按印度标准时间显示及筛选，记录发放、使用或到期的发生时间。',
 '操作类型':'发放、使用、过期逐笔区分。失败且未完成抵扣的不计为消耗。',
 '数量':'这笔操作的张数；未知数量显示未记录，0表示明确记录为0。',
 '用途':'显示这笔券操作的用途，例如高清保存、超清保存、去水印或壁纸设置。右键具体用途可核对领取与使用的关联。',
 '操作后余额':'按这次领取的完整记录顺序计算剩余数量，不从当前余额倒推。'
};
function number(v){return v===null||v===undefined||v===''||typeof v==='boolean'||!Number.isFinite(Number(v))?'未记录':String(Number(v));}
function timeValue(v){
 if(v===null||v===undefined||v==='')return null;
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 let text=String(v).trim();if(/^\d{13}$/.test(text))return Number(text);
 if(/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/.test(text))text=text.replace(' ','T')+(text.length===10?'T00:00:00':'')+'+05:30';
 const n=Date.parse(text);return Number.isFinite(n)?n:null;
}
const timeFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function time(v){const n=timeValue(v);return n===null?'未记录':timeFormat.format(n);}
function sourceType(row){return SOURCES[row.sourceType]||'未分类来源';}
function traceHelp(){return '这里是编号，用于对应当前记录。发放、使用、过期通过操作类型区分；记录之间保持用户和券来源关联，具体编号格式由开发确定。';}
function sourceCell(row,batch){return `<span ${H('来源',HELP['来源']+' '+traceHelp(row))}>${E(row.source||sourceType(row))}</span>`;}
function numberPlaceholder(){return '这里是编号';}
function purposeCell(row,batch){return `<span ${H('用途',HELP['用途']+' '+traceHelp(row))}>${E(row.purpose||'未记录')}</span><small ${H('编号','中文占位表示这笔券操作的编号；实际关联值保留在数据内，用于查询与关联，不在页面展示生成格式。')}>编号：${numberPlaceholder(row)}</small>`;}
function accountText(account){return `<div class="cr-account-text" ${H('用户ID',window.USER_IDENTITY?.help||'系统分配的唯一用户ID。')}><strong>${E(window.USER_IDENTITY?.id(account)??account.id)}</strong></div>`;}
function memberText(account){return account.member===true?'有效VIP':account.member===false?'普通账号':'未记录';}
function tag(text,help=''){return `<span class="cr-tag" ${help?H(text,help):''}>${E(text)}</span>`;}
function button(label,action,attrs='',primary=false){return `<button type="button" data-cr="${action}" class="${primary?'an-primary':''}" ${attrs}>${E(label)}</button>`;}
function readSnapshot(){try{const value=window.COUPON_AUDIT?.snapshot();if(!value||!Array.isArray(value.accounts)||!Array.isArray(value.batches)||!Array.isArray(value.events))throw new Error('invalid snapshot');const events=value.events.filter(e=>e.kind!=='返还').map(e=>{if(e.kind!=='使用')return {...e};const cancelled=value.events.filter(r=>r.kind==='返还'&&r.accountId===e.accountId&&r.batchId===e.batchId&&r.relatedEventId===e.transactionId).reduce((n,r)=>n+r.count,0);return {...e,count:Math.max(0,e.count-cancelled),balanceAfter:e.balanceAfter===null?null:e.balanceAfter+cancelled};}).filter(e=>e.count>0);return {...value,events,ready:true};}catch{return {accounts:[],batches:[],events:[],ready:false};}}
function matchesAccount(account,keyword){return !keyword||[window.USER_IDENTITY?.id(account)??account.id].some(v=>String(v||'').toLocaleLowerCase().includes(keyword));}
function select(snapshot,filters){
 const f={...emptyFilters(),...filters},keyword=f.keyword.trim().toLocaleLowerCase(),accountMap=new Map(snapshot.accounts.map(a=>[String(a.id),a]));
 const start=f.start?timeValue(f.start):null,end=f.end?timeValue(f.end):null,endInclusive=end===null?null:end+(f.end.length<=16?59999:999);
 const eventMatches=e=>{const at=timeValue(e.at),account=accountMap.get(String(e.accountId))||{id:e.accountId};return matchesAccount(account,keyword)&&(!f.source||e.sourceType===f.source)&&(!f.type||e.type===f.type)&&(!f.kind||e.kind===f.kind)&&(start===null||at!==null&&at>=start)&&(endInclusive===null||at!==null&&at<=endInclusive);};
 const events=snapshot.events.filter(eventMatches).slice().sort((a,b)=>(timeValue(b.at)??-Infinity)-(timeValue(a.at)??-Infinity)||String(b.id).localeCompare(String(a.id)));
 const activityFilter=Boolean(f.source||f.type||f.kind||f.start||f.end),related=new Set(events.map(e=>String(e.accountId)));
 if(!f.kind&&!f.start&&!f.end)for(const b of snapshot.batches)if((!f.source||b.sourceType===f.source)&&(!f.type||b.type===f.type))related.add(String(b.accountId));
 const accounts=snapshot.accounts.filter(a=>matchesAccount(a,keyword)&&(!activityFilter||related.has(String(a.id))));
 return {accounts,events};
}
function field(label,body,help){return `<label class="cr-field"><span ${H(label,help)}>${E(label)}</span>${body}</label>`;}
function options(key,label,values){return `<select data-cr-filter="${key}" aria-label="${E(label)}"><option value="">全部${E(label)}</option>${values.map(([value,text])=>`<option value="${E(value)}" ${draft[key]===value?'selected':''}>${E(text)}</option>`).join('')}</select>`;}
function filtersHTML(snapshot){return `<form class="cr-filters" data-cr-form>${ledgerContext?'':field('搜索用户ID',`<input data-cr-filter="keyword" list="cr-account-options" aria-label="搜索用户券账号" value="${E(draft.keyword)}" placeholder="输入用户ID"><datalist id="cr-account-options">${snapshot.accounts.map(a=>`<option value="${E(window.USER_IDENTITY?.id(a)??a.id)}">${E(window.USER_IDENTITY?.id(a)??a.id)}</option>`).join('')}</datalist>`,'按系统用户ID查找全部用户，与其他条件同时生效。')}${field('券来源',options('source','来源',Object.entries(SOURCES)),'广告观看奖励、邀请奖励、会员赠券和其他来源分别筛选。')}${field('券种',options('type','券种',Object.entries(TYPES)),HELP['券种'])}${field('操作类型',options('kind','操作类型',KINDS.map(x=>[x,x])),HELP['操作类型'])}${field('操作时间（起）',`<input type="datetime-local" data-cr-filter="start" aria-label="券操作开始时间" value="${E(draft.start)}">`,HELP['操作时间'])}${field('操作时间（止）',`<input type="datetime-local" data-cr-filter="end" aria-label="券操作结束时间" value="${E(draft.end)}">`,HELP['操作时间'])}<div class="cr-filter-actions"><button type="submit" class="an-primary">查询</button>${button('重置','reset')}</div></form>`;}
function table(headers,rows,kind=''){return `<div class="cr-table-wrap"><table class="cr-table ${kind}" aria-label="${kind==='cr-account-table'?'用户券汇总':kind==='cr-batch-table'?'券来源明细':'券流水'}"><thead><tr>${headers.map(label=>`<th ${H(label,HELP[label]||'查看对应记录；当前页面只读。')}>${E(label)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(value=>`<td>${value}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="cr-empty">暂无符合条件的记录</td></tr>`}</tbody></table></div>`;}
function accountTable(accounts){return table(['用户ID','账号类型','可用通用券','可用去水印券','累计发放','消耗','过期','操作'],accounts.map(a=>[accountText(a),tag(memberText(a)),number(a.availableGeneral),number(a.availableWatermark),number(a.issuedCount),number(a.usedCount),number(a.expiredCount),button('查看详情','account',`data-cr-account="${E(a.id)}"`)]),'cr-account-table');}
function eventTable(events,snapshot,showAccount=true,showDetails=true){const headers=[...(showAccount?['用户ID']:[]),'来源','券种','操作类型','数量','操作时间','用途','操作后余额',...(showDetails?['操作']:[])];return table(headers,events.map(e=>{
 const account=snapshot.accounts.find(a=>String(a.id)===String(e.accountId))||{id:e.accountId,label:'未标记'};
 const batch=snapshot.batches.find(b=>String(b.id)===String(e.batchId)&&String(b.accountId)===String(e.accountId));
 return [...(showAccount?[accountText(account)]:[]),sourceCell(e,batch),E(TYPES[e.type]||e.type||'未记录'),tag(e.kind),number(e.count),`<span class="cr-time">${E(time(e.at))}</span>`,purposeCell(e,batch),number(e.balanceAfter),...(showDetails?[batch?button('查看详情','batch',`data-cr-account="${E(e.accountId)}" data-cr-batch="${E(e.batchId)}"`):'<span class="cr-muted">暂无详情</span>']:[])];
 }),'cr-event-table');}
function pageHTML(total){const page=pages[activeTab],max=Math.max(1,Math.ceil(total/pageSize));return `<div class="cr-pagination"><span>共 ${total} ${activeTab==='accounts'?'个账号':'笔流水'}</span><label>每页 <select data-cr-size aria-label="每页记录数">${[10,20,50].map(n=>`<option ${pageSize===n?'selected':''}>${n}</option>`).join('')}</select> 条</label>${button('上一页','previous',page<=1?'disabled':'')}<span>${page} / ${max}</span>${button('下一页','next',page>=max?'disabled':'')}</div>`;}
function render(root){
 rootRef=root;root.classList.add('admin-new');root.classList.remove('admin-wallpaper-creation','wallpaper-editor','ad-config','member-orders','member-config');root.oninput=null;root.onchange=null;root.ondragover=null;root.ondrop=null;
 const data=readSnapshot(),account=ledgerContext?data.accounts.find(a=>String(a.id)===ledgerContext.accountId):null;
 const scoped=ledgerContext?{...data,accounts:account?[account]:[],batches:data.batches.filter(b=>String(b.accountId)===ledgerContext.accountId),events:data.events.filter(e=>String(e.accountId)===ledgerContext.accountId)}:data;
 const selected=select(scoped,applied),records=selected[activeTab];pages[activeTab]=Math.min(pages[activeTab],Math.max(1,Math.ceil(records.length/pageSize)));const offset=(pages[activeTab]-1)*pageSize,visible=records.slice(offset,offset+pageSize);
 root.innerHTML=`<section class="coupon-records"><div class="cr-heading"><div><h1 ${H(ledgerContext?'用户券流水':'用户券记录',ledgerContext?'仅查看当前用户的发放、使用和过期记录；筛选不切换账号。':'可查询普通账号与会员的券汇总；操作时间按印度标准时间显示。')}>${ledgerContext?'用户券流水':'用户券记录'}</h1></div><div class="cr-heading-actions">${ledgerContext?button('返回用户券详情','back-summary'):''}${button('刷新记录','refresh')}</div></div>${ledgerContext?`<div class="cr-detail-account">${account?accountText(account):'<strong>该账号暂无券记录</strong>'}${account?tag(memberText(account)):''}</div>`:''}${filtersHTML(data)}<div class="cr-status ${data.ready?'':'is-warning'}" role="status" aria-live="polite">${data.ready?'':'券记录数据暂不可用，请稍后刷新。'}</div><section id="cr-panel" aria-label="${ledgerContext?'当前用户券流水':'用户券汇总'}">${ledgerContext?eventTable(visible,data,false):accountTable(visible)}${pageHTML(records.length)}</section></section>`;
 root.onclick=handleClick;root.onchange=event=>{if(event.target.matches('[data-cr-size]')){pageSize=Number(event.target.value);pages={accounts:1,events:1};render(root);}else if(event.target.matches('[data-cr-filter]'))draft[event.target.dataset.crFilter]=event.target.value;else if(event.target.matches('[data-cr-detail-kind]')){detail.kind=event.target.value;paintDetail();}};
 root.oninput=event=>{if(event.target.matches('[data-cr-filter]'))draft[event.target.dataset.crFilter]=event.target.value;};
 root.querySelector('[data-cr-form]').onsubmit=event=>{event.preventDefault();query();};markMenu();return true;
}
function status(message,warning=false){const host=rootRef?.querySelector('.cr-status');if(host){host.textContent=message;host.classList.toggle('is-warning',warning);}}
function query(){const root=rootRef;for(const input of root.querySelectorAll('[data-cr-filter]'))draft[input.dataset.crFilter]=input.value;if(draft.start&&draft.end&&timeValue(draft.start)>timeValue(draft.end)){status('开始时间不能晚于结束时间。',true);return;}applied={...draft};pages={accounts:1,events:1};render(root);if(readSnapshot().ready)status('已按组合条件查询。');}
function closeDetail(){rootRef?.querySelector('.cr-modal-mask')?.remove();detail=null;returnFocus?.isConnected&&returnFocus.focus();returnFocus=null;}
function accountStats(a){return `<div class="cr-detail-stats">${[['可用通用券',a.availableGeneral],['可用去水印券',a.availableWatermark],['累计发放',a.issuedCount],['消耗',a.usedCount],['过期',a.expiredCount]].map(([label,value])=>`<div ${H(label,HELP[label])}><span>${label}</span><strong>${number(value)}</strong></div>`).join('')}</div>`;}
function batchTable(batches){return table(['来源','编号','券种','发放数量','消耗','过期','剩余 / 可用','发放时间','到期时间','操作'],batches.map(b=>[`${sourceCell(b,b)}`,`<span ${H('编号','这里是编号，用于对应这次领取；实际关联值保留在数据内，不展示生成格式。')}>这里是编号</span>`,E(TYPES[b.type]||b.type||'未记录'),number(b.issuedCount),number(b.usedCount),number(b.expiredCount),`${number(b.remaining)} / ${number(b.available)}`,`<span class="cr-time">${E(time(b.grantedAt))}</span>`,`<span class="cr-time">${E(time(b.expiry))}</span>`,button('查看使用记录','batch',`data-cr-account="${E(b.accountId)}" data-cr-batch="${E(b.id)}"`)]),'cr-batch-table');}
function paintDetail(){
 const root=rootRef,data=readSnapshot(),account=data.accounts.find(a=>String(a.id)===String(detail?.accountId));if(!root||!account){closeDetail();status('未找到对应账号的券记录。',true);return;}
 root.querySelector('.cr-modal-mask')?.remove();const batches=data.batches.filter(b=>String(b.accountId)===String(account.id));const batch=detail.batchId?batches.find(b=>String(b.id)===String(detail.batchId)):null;
 const mask=document.createElement('div');mask.className='cr-modal-mask';const title=batch?'券来源与使用记录':'用户券详情';
 let body;
 if(batch){const events=data.events.filter(e=>String(e.accountId)===String(account.id)&&String(e.batchId)===String(batch.id)&&(!detail.kind||e.kind===detail.kind)).sort((a,b)=>(timeValue(b.at)??-Infinity)-(timeValue(a.at)??-Infinity)||String(b.id).localeCompare(String(a.id)));
 body=`<div class="cr-detail-account">${accountText(account)}${tag(memberText(account))}</div><dl class="cr-batch-meta"><div><dt>编号</dt><dd ${H('编号','这里是编号，用于对应这次领取的券；实际关联值保留在数据内，不展示生成格式。')}>这里是编号</dd></div><div><dt>来源</dt><dd>${sourceCell(batch,batch)}</dd></div><div><dt>券种</dt><dd>${E(TYPES[batch.type]||'未记录')}</dd></div><div><dt>发放时间</dt><dd>${E(time(batch.grantedAt))}</dd></div><div><dt>到期时间</dt><dd>${E(time(batch.expiry))}</dd></div><div><dt>剩余 / 可用</dt><dd>${number(batch.remaining)} / ${number(batch.available)}</dd></div></dl><div class="cr-detail-list-heading"><h3 ${H('使用记录','显示这次领取的全部发放、使用和到期记录，不受列表查询条件限制。')}>这次领取的使用记录</h3><label>操作 <select data-cr-detail-kind aria-label="这次领取的操作筛选"><option value="">全部</option>${KINDS.map(k=>`<option ${detail.kind===k?'selected':''}>${k}</option>`).join('')}</select></label></div>${eventTable(events,data,false,false)}<div class="cr-detail-actions">${button('返回用户券详情','back-account')}</div>`;
 }else body=`<div class="cr-detail-account">${accountText(account)}${tag(memberText(account))}</div>${accountStats(account)}<div class="cr-detail-list-heading"><h3>券来源明细</h3><span>${batches.length} 次领取</span></div>${batchTable(batches)}<div class="cr-detail-actions">${button('查看此用户全部流水','account-events')}</div>`;
 mask.innerHTML=`<section class="cr-dialog coupon-records" role="dialog" aria-modal="true" aria-labelledby="cr-dialog-title" tabindex="-1"><header><h2 id="cr-dialog-title">${title}</h2>${button('×','close','aria-label="关闭用户券详情"')}</header>${body}</section>`;
 mask.addEventListener('click',event=>{if(event.target===mask)closeDetail();});mask.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeDetail();return;}if(event.key==='Tab'){const controls=[...mask.querySelectorAll('button,select,[tabindex="0"]')].filter(el=>!el.disabled);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
 root.querySelector('.coupon-records').append(mask);mask.querySelector('[data-cr="close"]').focus();
}
function openAccount(root,value){rootRef=root;const data=readSnapshot(),needle=String(value?.id||value?.account||value||''),account=data.accounts.find(a=>String(a.id)===needle||String(window.USER_IDENTITY?.id(a)??a.id)===needle);draft={...emptyFilters(),keyword:account?String(window.USER_IDENTITY?.id(account)??account.id):needle};applied={...draft};pages={accounts:1,events:1};activeTab='accounts';ledgerContext=null;summaryState=null;detail=null;returnFocus=null;render(root);if(!account){status('该账号暂无券记录。',true);return false;}returnFocus=document.activeElement;detail={accountId:account.id,batchId:'',kind:''};paintDetail();return true;}
function handleClick(event){
 const root=rootRef;
 const target=event.target.closest('[data-cr]');if(!target||!root.contains(target))return;const action=target.dataset.cr;
 if(action==='close'){closeDetail();return;}if(action==='reset'){draft=emptyFilters();applied=emptyFilters();pages={accounts:1,events:1};render(root);return;}if(action==='refresh'){render(root);if(readSnapshot().ready)status('已刷新券记录。');return;}if(action==='previous'||action==='next'){pages[activeTab]+=action==='next'?1:-1;render(root);return;}
 if(action==='account'||action==='batch'){if(!detail)returnFocus=target;detail={accountId:target.dataset.crAccount,batchId:action==='batch'?target.dataset.crBatch:'',kind:''};paintDetail();return;}
 if(action==='back-account'){detail.batchId='';detail.kind='';paintDetail();return;}
 if(action==='back-summary'){const previous=summaryState;ledgerContext=null;activeTab='accounts';draft=previous?.draft||emptyFilters();applied=previous?.applied||emptyFilters();pages.accounts=previous?.page||1;pageSize=previous?.pageSize||10;summaryState=null;render(root);if(previous?.detail){detail={...previous.detail};paintDetail();}requestAnimationFrame(()=>{root.closest('.admin-main')?.scrollTo(0,previous?.scroll||0);root.closest('#admin-workspace')?.scrollTo(0,previous?.outerScroll||0);});return;}
 if(action==='account-events'){
  if(!detail)return;
  if(!ledgerContext)summaryState={draft:{...draft},applied:{...applied},page:pages.accounts,pageSize,detail:{...detail},scroll:root.closest('.admin-main')?.scrollTop||0,outerScroll:root.closest('#admin-workspace')?.scrollTop||0};
  ledgerContext={accountId:String(detail.accountId)};closeDetail();activeTab='events';draft=emptyFilters();applied=emptyFilters();pages.events=1;render(root);root.closest('.admin-main')?.scrollTo({top:0});root.closest('#admin-workspace')?.scrollTo({top:0});
 }
}
const NEW_HELP='新增全部用户券记录：普通账号和会员均可查询。一级页仅展示用户券汇总；从用户详情进入该用户专属券流水二级页，不提供全部用户流水页签。可按来源（含广告观看奖励）、券种、操作及印度时间范围筛选，返回恢复原查询；详情可查看每次领取的来源、到期和使用用途；编号字段使用中文占位介绍，内部关联值不在默认界面或右键说明中展示。只读查询，不提供人工发券或退款。';
function markMenu(){const entry=document.querySelector(`.admin-menu [data-admin-go="${KEY}"]`);if(!entry||entry.querySelector('.cr-new-dot'))return;entry.classList.add('cr-menu-entry');const dot=document.createElement('span');dot.className='cr-new-dot';dot.tabIndex=0;dot.setAttribute('role','note');dot.setAttribute('aria-label','新增用户券记录说明');dot.dataset.helpTitle='新增 · 用户券记录';dot.dataset.help=NEW_HELP;dot.dataset.helpStatus='本地原型';const show=event=>{event.preventDefault();event.stopPropagation();window.FIELD_HELP?.show({title:'新增 · 用户券记录',description:NEW_HELP,status:'本地原型'},{x:dot.getBoundingClientRect().right,y:dot.getBoundingClientRect().bottom});};dot.addEventListener('click',show);dot.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')show(event);});entry.append(dot);}
let menuQueued=false;function scheduleMenu(){if(menuQueued)return;menuQueued=true;queueMicrotask(()=>{menuQueued=false;markMenu();});}
if(typeof MutationObserver!=='undefined'&&document.body)new MutationObserver(scheduleMenu).observe(document.body,{childList:true,subtree:true});
window.COUPON_RECORDS={render,openAccount,select,timeValue,time,number};scheduleMenu();
})();
