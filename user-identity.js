/* 同一演示用户在App和各后台模块共用用户ID；正式ID由服务端分配。 */
(()=>{'use strict';
const samples={'demo-google-account':'100001','demo-user-ad01':'100002'};
for(let n=1;n<=9;n++)samples['user-demo'+String(n).padStart(2,'0')]=String(100200+n);
for(let n=1;n<=9;n++)samples['demo-member'+String(n).padStart(2,'0')]=String(100100+n);
function id(value){if(value&&typeof value==='object'&&value.userId)return String(value.userId);const key=String(typeof value==='object'?value?.account??value?.id??'':value??'');return samples[key]||key;}
window.USER_IDENTITY={id,currentId:()=>samples['demo-google-account'],help:'系统为每个用户分配唯一且固定的用户ID；昵称和Google名称变化不会改变ID。App、会员、订单、券和反馈以同一ID关联。原型中的数字仅为示例，正式生成规则由开发确定。'};
})();
