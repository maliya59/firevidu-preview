/* 会员配置：只展示价格、赠券数量和保存；支付参数与权益版本保留在底层。 */
(()=>{'use strict';
const KEY='firevidu-membership-config-v1';
const DEFAULTS=window.MEMBER_BENEFITS.normalize({timezone:'Asia/Kolkata',resetAt:'00:00',plans:{}});
const clone=v=>JSON.parse(JSON.stringify(v));
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const H=(title,description)=>`data-help-title="${E(title)}" data-help="${E(description)}" data-help-status="已确认"`;
function normalize(value){return window.MEMBER_BENEFITS.normalize(value||{});}
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
 root.innerHTML=`<section data-mc-view="${s.view}"><div class="mc-heading"><h1>会员价格配置</h1></div><form class="mc-settings" aria-label="会员价格设置" novalidate><div class="mc-plan-grid">${['week','month','year'].map(plan=>{const p=d.plans[plan],name={week:'周卡',month:'月卡',year:'年卡'}[plan];return `<section class="mc-plan-section"><h2>${name}</h2>${field(name+'价格',p.price,`plans.${plan}.price`,'正式价格以Google Play结账页为准；暂未定价保留xx。',{unit:' / '+{week:'7天',month:'月',year:'年'}[plan]})}${field(name+'单次发放券数量',p.initialCount,`plans.${plan}.initialCount`,'本单周期开始时发放一次。提前续费不提前发基础券；年卡开通首批与首月券是同一批。',{number:true,unit:'张通用券'})}${plan==='year'?field('年卡每月发放券数量',p.monthlyCount,'plans.year.monthlyCount','从第二个会员月起，按本单开通日逐月发放，共后续11批；不是自然月1日。',{number:true,unit:'张通用券'}):'<p class="mc-not-applicable">每月发放：不适用，按本单周期单次发放</p>'}${field(name+'每日发放券数量',p.dailyCount,`plans.${plan}.dailyCount`,'生效日先发当天日券，之后印度时间00:00发，当天有效。周卡共7次，同用户同日不重复发；最后不足一天不新增第8批。',{number:true,unit:'张通用券'})}${field(name+'提前续费一次性奖励',p.renewalBonus,`plans.${plan}.renewalBonus`,'会员未到期时购买此套餐，付款核验成功后立即额外发放，到新购套餐结束时过期。0为不奖励。同订单只发一次，退款回收未用奖励。',{number:true,unit:'张通用券'})}<p class="mc-plan-summary">${plan==='week'?`7天共 ${p.initialCount+p.dailyCount*7} 张（单次 ${p.initialCount} + 每日 ${p.dailyCount} × 7次）`:plan==='month'?`开通 ${p.initialCount} 张，每日 ${p.dailyCount} 张`:`首月 ${p.initialCount} 张，后续每月 ${p.monthlyCount} 张，每日 ${p.dailyCount} 张`}</p></section>`;}).join('')}</div><p class="mc-config-note">保存后同步App套餐卡片及新订单参数，已付款订单保留购买时权益。基础券在新周期开始时发，提前续费额外奖励立即发。</p><div class="mc-status" role="status" aria-live="polite"></div><div class="mc-footer"><button type="submit" class="an-primary" data-mc="save" ${H('保存会员配置','同步本地App展示及新订单权益，不改变已有订单快照，不发起真实付款。')}>保存</button></div></form></section>`;
 root.oninput=e=>{
  const key=e.target.dataset.mcField;if(!key)return;
  const path=key.split('.');let current=d;
  while(path.length>1)current=current[path.shift()];
  current[path[0]]=!key.endsWith('.price')?e.target.value===''?'':Number(e.target.value):e.target.value;
 };
 root.querySelector('form').onsubmit=e=>{e.preventDefault();save(s);};
 root.onclick=e=>{
  if(!e.target.closest('[data-mc=orders]'))return;
  const next=()=>API.onNavigate?.('admin-new-member-orders');if(!guardExit(next))next();
 };
}
function save(s){
 for(const plan of ['week','month','year'])for(const key of ['initialCount','monthlyCount','dailyCount','renewalBonus'])if(!Number.isSafeInteger(s.draft.plans[plan][key])||s.draft.plans[plan][key]<0){note(s,'赠券数量请填写0或以上的整数。');return;}
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
