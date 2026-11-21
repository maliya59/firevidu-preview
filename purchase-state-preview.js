/* 购买状态的右键原型图，只读展示，不改变支付、会员或券。 */
(()=>{'use strict';
const states={unpaid:{label:'待付款',asset:'unpaid'},confirming:{label:'支付确认中',asset:'confirming'},paid:{label:'支付成功',asset:'paid'},cancelled:{label:'支付取消 / 失败',asset:'cancelled'}};
const labels={'待付款':'unpaid','支付确认中':'confirming','支付成功':'paid','支付取消 / 失败':'cancelled'};
let panel=null,previousFocus=null;
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function purchase(){const ui=window.NEW_UI,ctx=ui?.context||{},p=ctx.memberPurchase||ctx.lastMemberPurchase,plan=p?.plan||ctx.memberPlan||ui?.member?.plan||'month',rules=p?.entitlements||window.MEMBER_CONFIG?.getPublished()||{};return {plan,rules};}
async function loadImage(image,asset){const token={};image._request=token;const {plan,rules}=purchase();try{let svg=await (await fetch('assets/purchase-states/'+asset+'.svg?v=20261121-week')).text();const label={week:'周卡会员',month:'月卡会员',year:'年卡会员'}[plan]||'月卡会员',unit={week:'7天',month:'月',year:'年'}[plan]||'月';svg=svg.replaceAll('月付会员',label).replaceAll('xx / 月',xml((rules.plans?.[plan]?.price||'xx')+' / '+unit));if(image._request===token)image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}catch{if(image._request===token)image.src='assets/purchase-states/'+asset+'.svg';}}

function close(){if(!panel)return;panel.remove();panel=null;document.body.classList.remove('purchase-preview-open');if(previousFocus?.isConnected)previousFocus.focus?.({preventScroll:true});previousFocus=null;}
function show(key){const state=states[key];if(!state)return;close();window.FIELD_HELP?.close();previousFocus=document.activeElement;panel=document.createElement('aside');panel.className='purchase-state-preview';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',state.label+'状态原型图');panel.tabIndex=-1;
 const header=document.createElement('header'),title=document.createElement('strong'),dismiss=document.createElement('button');title.textContent=state.label+' · 原型图';dismiss.type='button';dismiss.textContent='×';dismiss.setAttribute('aria-label','关闭购买状态原型图');dismiss.onclick=close;header.append(title,dismiss);panel.append(header);
 const image=document.createElement('img');loadImage(image,state.asset);image.alt=(key==='cancelled'?'支付已取消':state.label)+'原型图';
 if(key==='cancelled'){const tabs=document.createElement('div');tabs.className='purchase-preview-variants';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','取消和失败原型');for(const [variant,label]of [['cancelled','支付取消'],['failed','支付失败']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(variant==='cancelled'));button.onclick=()=>{loadImage(image,variant);image.alt=(variant==='failed'?'支付失败':'支付已取消')+'原型图';for(const item of tabs.children)item.setAttribute('aria-pressed',String(item===button));};tabs.append(button);}panel.append(tabs);}
 panel.append(image);document.querySelector('#stage').append(panel);document.body.classList.add('purchase-preview-open');panel.focus({preventScroll:true});
}
function keyAt(event,root){const label=(event.target.closest('[data-source-text]')?.dataset.sourceText||event.target.textContent||'').trim();if(labels[label])return labels[label];const r=root.getBoundingClientRect();if(!r.width||!r.height)return null;const x=(event.clientX-r.left)*375/r.width,y=(event.clientY-r.top)*812/r.height;if(x<16||x>359)return null;return Object.keys(states).find((key,i)=>y>=116+i*128&&y<=226+i*128)||null;}
document.addEventListener('contextmenu',event=>{const root=event.target.closest('#screen');if(!root||window.__DEMO__?.state?.screen!=='new-member-sync'||window.__DEMO__?.state?.modal)return;const key=keyAt(event,root);if(!key)return;event.preventDefault();event.stopImmediatePropagation();show(key);},true);
document.addEventListener('pointerdown',event=>{if(panel&&event.button!==2&&!event.target.closest('.purchase-state-preview'))close();},true);
document.addEventListener('keydown',event=>{if(panel&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}},true);
const root=document.querySelector('#screen');if(root)new MutationObserver(()=>{if(panel)close();}).observe(root,{childList:true});
window.PURCHASE_STATE_PREVIEW={show,close};
})();
