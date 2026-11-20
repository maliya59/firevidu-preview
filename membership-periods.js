/* 本地原型的会员周期计算；正式版由服务端核验付款并保存本单期限。 */
(()=>{'use strict';
const IST=330*60000,plans={month:1,year:12};
const states={paid:'支付成功',succeeded:'支付成功',verified:'支付成功','核验成功':'支付成功',refunded:'已退款',revoked:'已退款','已撤销':'已退款',cancelled:'已取消',canceled:'已取消',failed:'支付失败'};
const validTime=t=>Number.isFinite(t)&&t>0;
function orderState(p){const s=p?.verificationStatus??p?.status;if(s===undefined||s===null||s==='')return null;if(s==='pending'||s==='待处理')return '支付确认中';return states[s]||s;}
function confirmed(p,now=Date.now()){return Boolean(p&&typeof p.id==='string'&&p.id.trim()&&plans[p.plan]&&validTime(p.paidAt)&&p.paidAt<=now&&validTime(p.expiresAt)&&p.expiresAt>(p.startsAt??p.paidAt)&&p.verified!==false&&(!orderState(p)||['支付成功','已退款'].includes(orderState(p))));}
function revoked(p){return Boolean(p?.revoked||p?.refunded||p?.revokedAt||p?.refundedAt||orderState(p)==='已退款');}
function history(m){const map=new Map();for(const p of [...(Array.isArray(m?.payments)?m.payments:[]),m?.payment])if(p&&typeof p.id==='string'&&p.id.trim()&&plans[p.plan]){const previous=map.get(p.id);if(!previous||!revoked(previous)||revoked(p))map.set(p.id,p);}return [...map.values()];}
function start(p){return validTime(p?.startsAt)?p.startsAt:p?.paidAt;}
function addMonths(at,months,anchorDay){const d=new Date(at+IST),day=anchorDay||d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.getTime()-IST;}
function schedule(payments,receipt){
 if(!receipt||receipt.verified!==true||!receipt.id||!plans[receipt.plan]||!validTime(receipt.paidAt)||receipt.paidAt>Date.now()||!['支付成功',null].includes(orderState(receipt)))throw Error('付款尚未确认，不能安排会员周期');
 const existing=payments.find(p=>p.id===receipt.id);if(existing&&confirmed(existing))return {payment:existing,duplicate:true};
 const previous=payments.filter(p=>confirmed(p)&&!revoked(p)&&p.expiresAt>receipt.paidAt).sort((a,b)=>b.expiresAt-a.expiresAt)[0];
 const startsAt=previous?previous.expiresAt:receipt.paidAt,anchorDay=previous?(previous.anchorDay||new Date(start(previous)+IST).getUTCDate()):new Date(startsAt+IST).getUTCDate();
 return {duplicate:false,payment:{...receipt,startsAt,expiresAt:addMonths(startsAt,plans[receipt.plan],anchorDay),anchorDay}};
}
function summary(m,now=Date.now()){
 const payments=history(m).filter(p=>confirmed(p,now)),usable=payments.filter(p=>!revoked(p)).sort((a,b)=>start(a)-start(b)||a.paidAt-b.paidAt||a.id.localeCompare(b.id));
 const current=usable.find(p=>start(p)<=now&&p.expiresAt>now)||null;
 let expiry=current?.expiresAt||0;if(current)for(const p of usable)if(start(p)<=expiry&&p.expiresAt>expiry)expiry=p.expiresAt;
 const latest=[...payments].sort((a,b)=>b.paidAt-a.paidAt||b.id.localeCompare(a.id))[0]||null;
 const lastStarted=[...payments].filter(p=>start(p)<=now).sort((a,b)=>start(b)-start(a)||b.paidAt-a.paidAt)[0]||null;
 return {payments,current,expiry,latest,displayPayment:current||lastStarted||latest,queued:usable.filter(p=>start(p)>now),status:current?'有效':lastStarted?(revoked(lastStarted)?'已退款':'已到期'):null};
}
function monthlyCycle(payment,now=Date.now()){
 if(!confirmed(payment,now)||revoked(payment)||start(payment)>now||payment.expiresAt<=now)return null;
 const anchor=start(payment),a=new Date(anchor+IST),n=new Date(now+IST);let index=payment.plan==='year'?Math.max(0,(n.getUTCFullYear()-a.getUTCFullYear())*12+n.getUTCMonth()-a.getUTCMonth()):0;
 while(index>0&&addMonths(anchor,index,payment.anchorDay)>now)index--;
 const at=addMonths(anchor,index,payment.anchorDay),expiry=Math.min(addMonths(anchor,index+1,payment.anchorDay),payment.expiresAt);
 return at<=now&&expiry>now?{at,expiry,index,cycleId:payment.id+':'+index}:null;
}
const help='未到期续费从全部已付款权益的最后到期日接续；已到期重新开通从本次付款确认生效时开始。月付和年付按顺序生效，本期套餐不提前切换。每笔订单保存独立期限，旧订单不因续费改变。新周期开始才发对应月券，日券同一用户同一印度业务日只发一次。短月取月末并保留原日期锚点；重复核验或恢复购买不重复延长、不重复发券。';
window.MEMBERSHIP_PERIODS={help,confirmed,revoked,history,start,addMonths,schedule,summary,monthlyCycle};
})();
