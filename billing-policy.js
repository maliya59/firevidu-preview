/* 订阅说明：原型只展示流程，不提交真实付款或退款。 */
(()=>{'use strict';
const SOURCES={reference:'https://www.reelitai.net/membership-agreement',terms:'https://www.reelitai.net/terms',refund:'https://support.google.com/googleplay/answer/2479637?hl=zh-Hans',manage:'https://support.google.com/googleplay/answer/7018481?hl=zh-Hans'};
const H=(title,meaning)=>`data-help-title="${title}" data-help="${meaning}" data-help-status="已确认"`;
const pages={
 'new-billing-policy':{title:'订阅说明',sections:[
  ['付款与套餐','月付、年付价格及收费周期以购买确认页为准。通过Google Play购买时，可用支付方式、税费与账单由平台结账页显示。'],
  ['自动续订与取消','除购买页另有说明，订阅到期后自动续订。请在平台显示的截止时间前取消；未另行注明时，建议至少提前24小时操作。取消后仍可使用至已付费周期结束。卸载App或注销账号不会自动取消订阅。'],
 ]},
 'new-service-terms':{title:'服务条款',sections:[
  ['会员订阅与数字权益','本说明适用于FireVidu会员订阅。价格、周期、赠券及续订条件会在确认购买前展示；每月赠券与每日赠券按各自有效期使用。'],
  ['付款与续订','Google Play购买遵循该渠道的付款与取消规则。取消未来续订后，可使用到已付周期结束。'],
  ['权益交付与账号','请使用购买对应的Google账号恢复和查询权益。付款确认后安排本单期限，提前续费的权益在对应周期开始时生效；付款待确认、失败或取消不增加权益。'],
 ]}
};
function open(kind='policy'){go(kind==='terms'?'new-service-terms':'new-billing-policy');}
function render(key,root){
 const page=pages[key];if(!page){root.classList.remove('billing-policy');return false;}
 root.classList.remove('wireframe','vip-access');root.classList.add('billing-policy');root.onclick=null;root.oninput=null;root.onchange=null;
 document.querySelector('#phone').dataset.height='812';
 root.innerHTML=`<section class="billing-policy-screen"><div class="billing-policy-status"><span>9:41</span><span aria-hidden="true">▂▄▆ ▰</span></div><header><button type="button" data-billing="back" aria-label="返回">‹</button><h1 ${H(page.title,'查看套餐付款、自动续订与取消方式。')}>${page.title}</h1></header><main>${page.sections.map(([title,copy])=>`<section><h2>${title}</h2><p>${copy}</p></section>`).join('')}${key==='new-service-terms'?'<button type="button" class="billing-policy-text-link" data-billing="policy">订阅说明 ›</button>':''}<div class="billing-policy-actions"><a href="${SOURCES.manage}" target="_blank" rel="noopener noreferrer" ${H('管理Google Play订阅','打开Google Play官方管理说明。不会自动取消订阅或修改付款状态。')}>管理订阅</a></div></main><div class="billing-policy-home" aria-hidden="true"></div></section>`;
 root.onclick=event=>{const action=event.target.closest('[data-billing]')?.dataset.billing;if(action==='back')back();else if(action==='policy')open();};
 status('本地展示订阅说明。');return true;
}
function enhance(key,root){
 if(!['new-member','new-member-active','new-member-sync'].includes(key))return;
 const body=root.querySelector('.confirmed-body')||(key==='new-member-sync'?root:null);if(!body||body.querySelector('.billing-policy-entry'))return;
 const entry=document.createElement('div');entry.className='billing-policy-entry';
 if(body===root)entry.classList.add('billing-policy-entry-standalone');
 entry.innerHTML=`<button type="button" data-billing="policy" ${H('订阅说明','查看支付渠道、自动续订与取消方式。')}>订阅说明</button><a href="${SOURCES.manage}" target="_blank" rel="noopener noreferrer" ${H('管理订阅','在Google Play官方说明中了解如何管理订阅；本地不会自动取消。')}>管理订阅</a>`;
 entry.querySelector('button').onclick=event=>{event.stopPropagation();open();};body.appendChild(entry);
}
for(const [key,page] of Object.entries(pages))titles[key]=page.title;
window.BILLING_POLICY={open,render,enhance,sources:SOURCES};
})();
