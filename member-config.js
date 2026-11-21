/* 会员配置：只展示价格、赠券数量和保存；支付参数与权益版本保留在底层。 */
(()=>{'use strict';
const KEY='firevidu-membership-config-v1';
const DEFAULTS={weeklyCount:7,monthlyCount:30,firstCount:30,dailyCount:3,giftMonths:1,monthMonths:1,annualCycle:'monthly-anniversary',dailyExpiry:'当日过期',timezone:'Asia/Kolkata',resetAt:'00:00',modelLimit:'不限次数',plans:{week:{price:'xx',productId:'',planId:''},month:{price:'xx',productId:'',planId:''},year:{price:'xx',productId:'',planId:''}}};
const clone=v=>JSON.parse(JSON.stringify(v));
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const H=(title,description)=>`data-help-title="${E(title)}" data-help="${E(description)}" data-help-status="已确认"`;
function normalize(value){
 const d={...clone(DEFAULTS),...(value||{})};
 d.plans={};
 for(const plan of ['week','month','year'])d.plans[plan]={...DEFAULTS.plans[plan],...value?.plans?.[plan],price:String(value?.plans?.[plan]?.price??'xx')};
 d.weeklyCount=Number.isSafeInteger(value?.weeklyCount)&&value.weeklyCount>=0?value.weeklyCount:DEFAULTS.weeklyCount;
 d.monthlyCount=Number.isSafeInteger(value?.monthlyCount)&&value.monthlyCount>=0?value.monthlyCount:DEFAULTS.monthlyCount;
 if(!Number.isSafeInteger(d.dailyCount)||d.dailyCount<0)d.dailyCount=DEFAULTS.dailyCount;
 return {...d,firstCount:d.monthlyCount,giftMonths:1,monthMonths:1,annualCycle:'monthly-anniversary',timezone:'Asia/Kolkata',resetAt:'00:00',dailyExpiry:'当日过期',modelLimit:'不限次数'};
}
let store={draft:clone(DEFAULTS),published:clone(DEFAULTS),revision:1,history:[]},active=null,prompt=null;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved)store={...store,...saved,draft:normalize(saved.draft),published:normalize(saved.published),history:Array.isArray(saved.history)?saved.history:[]};}catch{}
const snapshot=v=>JSON.stringify(v);
const alive=s=>s&&s.root.isConnected&&s.root.querySelector('[data-mc-view]')?.dataset.mcView===s.view;
const dirty=()=>alive(active)&&snapshot(active.draft)!==active.baseline;
function note(s,message){const el=s.root.querySelector('.mc-status');if(el)el.textContent=message;}
function field(label,value,path,description,{number=false,unit=''}={}){
 return `<label class="mc-field" ${H(label,description)}><span>${E(label)}</span><div class="mc-input-row"><input aria-label="${E(label)}" data-mc-field="${path}" value="${E(value)}" ${number?'type="number" min="0" step="1"':'type="text" inputmode="decimal"'} ${H(label,description)}>${unit?`<small>${E(unit)}</small>`:''}</div></label>`;
}
function render(root){
 root.classList.add('admin-new','member-config');root.classList.remove('member-orders','admin-wallpaper-creation','wallpaper-editor','ad-config');
 root.onclick=null;root.onchange=null;root.oninput=null;root.ondrop=null;root.ondragover=null;
 active={root,view:'member-'+Date.now(),draft:clone(store.draft),baseline:snapshot(store.draft)};draw(active);return true;
}
function draw(s){
 const d=s.draft,root=s.root;
 root.innerHTML=`<section data-mc-view="${s.view}"><div class="mc-heading"><h1>会员价格配置</h1></div><form class="mc-settings" aria-label="会员价格设置" novalidate><div class="mc-simple-grid">${field('周卡价格',d.plans.week.price,'plans.week.price','有效期为7×24小时，每7天自动续订。未到期续费从全部已付款权益的到期日接续，新周期开始才发每期赠券。价格未确定保留xx。',{unit:'/ 7天'})}${field('月付会员价格',d.plans.month.price,'plans.month.price','首次或到期后开通从付款生效时开始；未到期续费从原到期日接续一个月。未确定价格时保留xx；正式支付金额以支付平台核验为准。',{unit:'/ 月'})}${field('年付会员价格',d.plans.year.price,'plans.year.price','首次或到期后开通从付款生效时开始；未到期续费从原到期日接续一年。未确定价格时保留xx；正式支付金额以支付平台核验为准。',{unit:'/ 年'})}${field('周卡每期赠券数量',d.weeklyCount,'weeklyCount','默认7张通用券。每个7天周期开始时发一次，到该周期结束时过期。提前续费不提前发券。',{number:true,unit:'张通用券'})}${field('每月赠券数量',d.monthlyCount,'monthlyCount','默认30张通用券。每个会员月周期开始时发一次；提前续费对应的周期开始前不发券。每批到对应会员月周期结束时到期；恢复购买、刷新及重复核验不重复发。',{number:true,unit:'张通用券'})}${field('每日赠券数量',d.dailyCount,'dailyCount','有效会员每天自动发放的通用券数量，默认3张。印度时间Asia/Kolkata每天00:00更新，当天过期；周卡、月卡、年卡相同。',{number:true,unit:'张通用券'})}</div><div class="mc-status" role="status" aria-live="polite"></div><div class="mc-footer"><button type="submit" class="an-primary" data-mc="save" ${H('保存会员配置','保存到本地演示后，之后付款的会员周期使用新配置。已有付款周期保留当时的赠券记录；不发起真实付款。')}>保存</button></div></form></section>`;
 root.oninput=e=>{
  const key=e.target.dataset.mcField;if(!key)return;
  const path=key.split('.');let current=d;
  while(path.length>1)current=current[path.shift()];
  current[path[0]]=['weeklyCount','monthlyCount','dailyCount'].includes(key)?e.target.value===''?'':Number(e.target.value):e.target.value;
 };
 root.querySelector('form').onsubmit=e=>{e.preventDefault();save(s);};
 root.onclick=e=>{
  if(!e.target.closest('[data-mc=orders]'))return;
  const next=()=>API.onNavigate?.('admin-new-member-orders');if(!guardExit(next))next();
 };
}
function save(s){
 for(const key of ['weeklyCount','monthlyCount','dailyCount'])if(!Number.isSafeInteger(s.draft[key])||s.draft[key]<0){note(s,'赠券数量请填写0或以上的整数。');return;}
 for(const plan of ['week','month','year']){
  const price=s.draft.plans[plan].price.trim();
  if(price!=='xx'&&(!/^\d+(\.\d+)?$/.test(price)||!Number.isFinite(Number(price))||Number(price)<=0)){note(s,'价格请填写大于0的数字，暂未定价保留xx。');return;}
  s.draft.plans[plan].price=price;
 }
 const next=normalize(s.draft),previous=clone(store);
 // 对外展示采用App固定文案；旧字段不再用于配置，也不删除用户原有数据。
 store.draft=clone(next);store.history.push({revision:store.revision,config:clone(store.published)});store.published=clone(next);store.revision++;
 try{localStorage.setItem(KEY,JSON.stringify(store));}catch{store=previous;note(s,'浏览器暂时无法保存，请保留当前内容后重试。');return;}
 s.draft=clone(next);s.baseline=snapshot(s.draft);draw(s);note(s,'已保存');
}
function guardExit(next){
 if(!alive(active))return false;if(prompt)return true;if(!dirty())return false;
 const s=active,node=document.createElement('div');node.className='mc-exit-mask';
 node.innerHTML=`<section class="mc-dialog" role="dialog" aria-modal="true" aria-label="未保存的会员配置"><h2>会员配置尚未保存</h2><p>退出将放弃本次修改。</p><div class="mc-dialog-actions"><button type="button" data-mc-exit="cancel" ${H('继续编辑','关闭提示，保留当前尚未保存的输入。')}>继续编辑</button><button type="button" data-mc-exit="discard" class="an-primary" ${H('放弃修改并退出','放弃本次未保存的修改，恢复为上次保存内容后离开。')}>放弃修改并退出</button></div></section>`;
 s.root.append(node);prompt=node;
 node.onclick=e=>{e.stopPropagation();if(e.target===node||e.target.closest('[data-mc-exit=cancel]')){node.remove();prompt=null;}else if(e.target.closest('[data-mc-exit=discard]')){node.remove();prompt=null;s.draft=clone(store.draft);s.baseline=snapshot(s.draft);draw(s);next();}};
 node.querySelector('[data-mc-exit=cancel]').focus();return true;
}
function handleEscape(){if(!prompt)return false;prompt.remove();prompt=null;return true;}
window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
const API={render,guardExit,handleEscape,onNavigate:null,getPublished(){return {...clone(store.published),version:'demo-v'+store.revision};}};window.MEMBER_CONFIG=API;
})();
