/* 邀请关系原型。每位好友只能绑定一次，两阶段奖励分别发放。 */
((root)=>{
'use strict';
const DAY=86400000;
const clone=value=>JSON.parse(JSON.stringify(value));
const indiaDay=time=>new Date(time+330*60000).toISOString().slice(0,10);

function create({now=Date.now,read=()=>null,write=()=>{},currentId='100001'}={}){
 const at=now();
 const accountIds=[currentId,'100102','100201','100202','100203'];
 const users=accountIds.map(id=>({id,code:'FV'+id}));
 let store={version:1,pending:null,bindings:[
  {userId:'100201',inviterId:currentId,code:'FV'+currentId,boundAt:at-2*DAY,source:'自动识别',registrationRewardAt:at-2*DAY,firstSaveAt:null,rewardAt:null,eligible:true,example:true},
  {userId:'100202',inviterId:currentId,code:'FV'+currentId,boundAt:at-DAY,source:'手动输入',registrationRewardAt:at-DAY,firstSaveAt:at-3600000,rewardAt:at-3599000,eligible:true,example:true},
  {userId:'100203',inviterId:currentId,code:'FV'+currentId,boundAt:at-1800000,source:'自动识别',registrationRewardAt:null,firstSaveAt:null,rewardAt:null,eligible:true,example:true}
 ]};
 try{const saved=read();if(saved?.version===1)store=saved;}catch{}
 function commit(next){write(clone(next));store=next;}
 function pending(code){
  const next=clone(store);
  next.pending=String(code||'').trim().toUpperCase();
  commit(next);
 }
 function grant(next,{userId,id,type,at}){
  next.rewards??=[];
  next.rewards.push({id,userId,type,count:1,at,expiry:at+15*DAY});
 }
 function bind({code,logged,userId=currentId,source='手动输入',eligible=true,allowOverLimit=false}){
  code=String(code||'').trim().toUpperCase();
  if(!logged)return {ok:false,error:'请先登录，邀请码会为你保留。'};
  const existing=store.bindings.find(binding=>binding.userId===userId);
  if(existing)return existing.code===code
   ?{ok:true,duplicate:true,binding:clone(existing)}
   :{ok:false,error:'你已绑定邀请人，不能更换邀请码。'};
  if(!/^FV\d{6}$/.test(code))return {ok:false,error:'请输入正确的邀请码，例如 FV100102。'};
  const inviter=users.find(user=>user.code===code);
  if(!inviter)return {ok:false,error:'没有找到这个邀请码，请向好友确认。'};
  if(inviter.id===userId)return {ok:false,error:'不能填写自己的邀请码。'};
  if(!eligible)return {ok:false,error:'本活动绑定奖励仅面向新用户，你仍可以邀请好友。'};
  let ancestor=inviter.id;
  const visited=new Set();
  while(ancestor&&!visited.has(ancestor)){
   if(ancestor===userId)return {ok:false,error:'不能建立相互或循环邀请关系。'};
   visited.add(ancestor);
   ancestor=store.bindings.find(binding=>binding.userId===ancestor)?.inviterId;
  }

  const at=now();
  const today=indiaDay(at);
  const hasQuota=store.bindings.filter(binding=>binding.inviterId===inviter.id&&binding.eligible&&indiaDay(binding.boundAt)===today).length<5;
  if(!hasQuota&&!allowOverLimit)return {ok:false,requiresConfirmation:true};

  const binding={userId,inviterId:inviter.id,code,boundAt:at,source,registrationRewardAt:hasQuota?at:null,firstSaveAt:null,rewardAt:null,eligible:hasQuota,example:false};
  const next=clone(store);
  next.bindings.push(binding);
  if(hasQuota)grant(next,{id:'invite:'+userId+':registration:'+inviter.id,userId:inviter.id,type:'watermark',at});
  next.pending=null;
  try{commit(next);}catch{return {ok:false,error:'暂时无法绑定，请保留邀请码后重试。'};}
  return {ok:true,binding:clone(binding)};
 }
 function completeSave({logged,userId=currentId,quality,method}){
  if(!logged||quality!=='hd'||method!=='ad')return null;
  const next=clone(store);
  const binding=next.bindings.find(item=>item.userId===userId);
  if(!binding||binding.firstSaveAt)return null;

  const at=now();
  binding.firstSaveAt=at;
  binding.rewardAt=at;
  const recipients=binding.eligible?[binding.userId,binding.inviterId]:[binding.userId];
  for(const recipient of recipients){
   grant(next,{id:'invite:'+binding.userId+':save:'+recipient,userId:recipient,type:'general',at});
  }
  commit(next);
  return clone(binding);
 }
 function receipt(userId,stage){
  const next=clone(store);
  const binding=next.bindings.find(item=>item.userId===userId);
  if(!binding?.eligible)return false;
  const field=stage==='registration'?'registrationRewardAt':'rewardAt';
  if(binding[field]||stage!=='registration'&&!binding.firstSaveAt)return false;
  binding[field]=now();
  commit(next);
  return true;
 }
 function invitationRecords(userId=currentId){
  const records={recent:[],history:[]};
  const cutoff=now()-30*DAY;
  for(const binding of store.bindings.filter(item=>item.inviterId===userId)){
   const completedAt=binding.firstSaveAt??null;
   const list=completedAt&&completedAt<=cutoff?records.history:records.recent;
   list.push({...binding,completedAt});
  }
  records.recent.sort((a,b)=>b.boundAt-a.boundAt);
  records.history.sort((a,b)=>b.completedAt-a.completedAt);
  return clone(records);
 }
 return {bind,pending,completeSave,receipt,invitationRecords,get state(){return clone(store);},get users(){return clone(users);},code:id=>'FV'+id};
}
const api={create};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.INVITE_CORE=api;
})(typeof window==='undefined'?globalThis:window);
