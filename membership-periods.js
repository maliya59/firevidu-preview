/* 本地原型的会员周期计算；正式版由服务端核验付款并保存本单期限。 */
(()=>{'use strict';
const IST=330*60000,WEEK=7*86400000,plans={week:7,month:1,year:12};
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
 const startsAt=previous?previous.expiresAt:receipt.paidAt,anchorDay=previous&&previous.plan!=='week'&&receipt.plan!=='week'?(previous.anchorDay||new Date(start(previous)+IST).getUTCDate()):new Date(startsAt+IST).getUTCDate();
 return {duplicate:false,payment:{...receipt,startsAt,expiresAt:receipt.plan==='week'?startsAt+WEEK:addMonths(startsAt,plans[receipt.plan],anchorDay),anchorDay}};
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
 if(payment.plan==='week')return {at:start(payment),expiry:payment.expiresAt,index:0,cycleId:payment.id+':0'};
 const anchor=start(payment),a=new Date(anchor+IST),n=new Date(now+IST);let index=payment.plan==='year'?Math.max(0,(n.getUTCFullYear()-a.getUTCFullYear())*12+n.getUTCMonth()-a.getUTCMonth()):0;
 while(index>0&&addMonths(anchor,index,payment.anchorDay)>now)index--;
 const at=addMonths(anchor,index,payment.anchorDay),expiry=Math.min(addMonths(anchor,index+1,payment.anchorDay),payment.expiresAt);
 return at<=now&&expiry>now?{at,expiry,index,cycleId:payment.id+':'+index}:null;
}
const help='三套餐独立配置：周卡单次7张、每日2张，共7次日券合计21张，生效日先得9张；月卡单次30张、每日3张；年卡首月30张，之后每月开通日30张、每日4张。日券当天有效且同日只发一批，周卡不发第8批。提前续费从已付款的最后到期日接续，新周期开始发基础券；立即额外奖励分别示例2、5、30张，到新购套餐结束时过期。已有订单保留原参数，新单使用已保存配置。恢复或重复回调不重复发。退款回收对应未用奖励，已消耗部分留账不倒扣无关券。实际支付及混合套餐续费以Google Play核验和平台支持为准。';
window.MEMBERSHIP_PERIODS={help,confirmed,revoked,history,start,addMonths,schedule,summary,monthlyCycle};
})();
