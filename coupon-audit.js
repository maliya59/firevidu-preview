/* 只读券账：按用户、原始批次关联发放、抵扣、返还及到期。不会发券或修改 App 余额。 */
(()=>{'use strict';
const number=v=>Number.isFinite(v)?v:null;
const count=v=>Number.isInteger(v)&&v>=0?v:null;
const type=v=>v==='general'||v==='通用券'?'general':'watermark';
const debit=row=>row.kind!=='回收'&&(['−','-'].includes(row.sign)||row.kind==='使用');
const refund=row=>row.kind==='返还';
const sourceType=(source,cycle)=>String(cycle||'').startsWith('B02:')||/广告.*奖励/.test(source)?'ad':/会员|续费/.test(source)?'member':/邀请|好友/.test(source)?'invite':'other';
const sum=(rows,key)=>rows.reduce((n,row)=>n+(Number(row[key])||0),0);
// 原型自带的两条固定示例：发放量及15天期限由初始化代码明确定义。
// 仅补齐这两条已知演示记录，不推算用户的其他领取记录。
const seedExamples={'demo-general':{count:2,source:'邀请奖励（本地示例）'},'demo-watermark':{count:1,source:'好友注册奖励（本地示例）'}};
function build(input,now=Date.now()){
 const batches=[],events=[],accounts=[];
 for(const data of input){
  const account={...data.account},rows=data.ledger||[],spends=rows.filter(debit),refunds=rows.filter(refund);
  for(const stored of data.batches||[]){
   const seed=data.account.id==='demo-google-account'?seedExamples[stored.id]:null;
   const raw=seed&&stored.source===seed.source?{...stored,issuedCount:count(stored.issuedCount)??seed.count,grantedAt:number(stored.grantedAt)??(number(stored.expiry)===null?null:stored.expiry-15*86400000)}:stored;
   const batchId=String(raw.id),remaining=count(raw.count)??0,expiry=number(raw.expiry),source=raw.source||'来源未记录';
   const grants=rows.filter(row=>row.sign==='+'&&!refund(row)&&(row.batchId===batchId||(raw.cycleId&&row.cycleId===raw.cycleId)||(!row.batchId&&!row.cycleId&&number(raw.grantedAt)!==null&&row.at===raw.grantedAt&&row.purpose===source)));
   const issued=count(raw.issuedCount)??(grants.length===1?count(grants[0].n):null);
   const parts=[];let incomplete=false;
   for(const row of spends){
    const pieces=Array.isArray(row.batches)?row.batches:row.batchId?[{id:row.batchId,count:row.n}]:[];
    for(const part of pieces.filter(part=>String(part.id)===batchId)){
     let returned=count(part.returnedCount);
     if(returned===null){if(!row.returned)returned=0;else if(pieces.length===1)returned=Math.min(part.count,row.returned);else if(row.returned===row.n)returned=part.count;else incomplete=true;}
     parts.push({row,part,returned});
    }
   }
   const gross=parts.reduce((n,p)=>n+(count(p.part.count)??0),0),explicitReturns=refunds.filter(row=>row.batchId===batchId);
   const returned=incomplete?null:Math.max(parts.reduce((n,p)=>n+(p.returned||0),0),sum(explicitReturns,'n'));
   const batch={id:batchId,accountId:account.id,type:type(raw.type),source,sourceType:sourceType(source,raw.cycleId),issuedCount:issued,usedCount:incomplete?null:Math.max(0,gross-(returned||0)),returnedCount:returned,expiredCount:expiry!==null&&expiry<=now?remaining:0,remaining,available:expiry!==null&&expiry>now?remaining:0,grantedAt:number(raw.grantedAt)??number(grants[0]?.at),expiry,transactionId:raw.cycleId||'',historyIncomplete:incomplete||issued===null};
   batches.push(batch);
   const add=(kind,n,at,id,purpose,relatedEventId='',transactionId=batch.transactionId)=>events.push({id,accountId:account.id,batchId,type:batch.type,source,sourceType:batch.sourceType,kind,count:n,at:number(at),expiry,purpose,transactionId,relatedEventId,balanceAfter:null});
   if(issued!==null)add('发放',issued,batch.grantedAt,grants[0]?.id||'issue-'+batchId,source);
   for(const {row,part,returned:n} of parts){
    const id=(row.id||'legacy-use-'+rows.indexOf(row))+':'+batchId;
    add('使用',part.count,row.at,id,row.purpose||'用途未记录','',row.id||'');
    if(n&&!explicitReturns.some(ret=>ret.relatedEventId===row.id))add('返还',n,null,'legacy-return-'+id,'历史返还：返还时间未记录',row.id||'');
   }
   for(const row of rows.filter(row=>row.kind==='回收'&&row.batchId===batchId))add('回收',row.n,row.at,row.id,row.purpose||'退款回收');
   for(const row of explicitReturns)add('返还',row.n,row.at,row.id,row.purpose||'失败返还',row.relatedEventId||'',row.relatedEventId||'');
   if(batch.expiredCount){
    const lateReturns=explicitReturns.filter(row=>number(row.at)!==null&&row.at>=expiry),late=sum(lateReturns,'n'),initial=Math.max(0,batch.expiredCount-late);
    if(initial)add('过期',initial,expiry,'expire-'+batchId,'剩余券到期失效');
    for(const row of lateReturns)add('过期',row.n,row.at,'expire-'+row.id,'原券已到期，返还后仍不可用',row.id);
   }
   const history=events.filter(event=>event.accountId===account.id&&event.batchId===batchId).sort((a,b)=>(a.at??Infinity)-(b.at??Infinity)||({'发放':0,'使用':1,'返还':2,'过期':3}[a.kind]-{'发放':0,'使用':1,'返还':2,'过期':3}[b.kind]));
   if(issued!==null&&!history.some(event=>event.at===null)&&!incomplete){let balance=0;for(const event of history){balance+=['发放','返还'].includes(event.kind)?event.count:-event.count;event.balanceAfter=balance;}}
  }
  // 无法可靠分摊的旧返还只保留整笔，不猜测它属于哪张券。
  for(const row of spends){const pieces=Array.isArray(row.batches)?row.batches:row.batchId?[{id:row.batchId,count:row.n}]:[],base={accountId:account.id,batchId:'',type:type(row.type),source:row.source||'来源未记录',sourceType:sourceType(row.source||''),expiry:null,transactionId:row.id||'',relatedEventId:row.id||'',balanceAfter:null};if(!pieces.length)events.push({...base,id:'unlinked-'+(row.id||rows.indexOf(row)),kind:'使用',count:row.n,at:number(row.at),purpose:(row.purpose||'用途未记录')+'（原批次未记录）'});if(row.returned&&(!pieces.length||(pieces.length>1&&row.returned!==row.n&&pieces.some(part=>count(part.returnedCount)===null)))&&!refunds.some(ret=>ret.relatedEventId===row.id))events.push({...base,id:'unallocated-'+(row.id||rows.indexOf(row)),sourceType:'other',kind:'返还',count:row.returned,at:null,purpose:'历史返还：批次分摊和返还时间未记录'});}
  const own=batches.filter(batch=>batch.accountId===account.id),knownIssued=own.every(batch=>batch.issuedCount!==null);
  accounts.push({...account,availableGeneral:sum(own.filter(b=>b.type==='general'),'available'),availableWatermark:sum(own.filter(b=>b.type==='watermark'),'available'),issuedCount:knownIssued?sum(own,'issuedCount'):null,usedCount:spends.reduce((n,row)=>n+Math.max(0,(count(row.n)??0)-(count(row.returned)??0)),0),returnedCount:sum(spends,'returned'),expiredCount:sum(own,'expiredCount'),historyIncomplete:own.some(batch=>batch.historyIncomplete)||spends.some(row=>!row.batchId&&!row.batches?.length)});
 }
 return {accounts,batches,events:events.sort((a,b)=>(b.at??-Infinity)-(a.at??-Infinity)||a.id.localeCompare(b.id))};
}
const at=value=>Date.parse(value+'+05:30');
function sampleData(){
 const data=[];
 const make=(id,name,member)=>{const item={account:{id,name,label:'本地示例',member},batches:[],ledger:[]};data.push(item);return item;};
 const issue=(data,id,n,source,time,expiry,cycle='',couponType='general')=>{const b={id,type:couponType,source,count:n,issuedCount:n,grantedAt:at(time),expiry:at(expiry),cycleId:cycle};data.batches.push(b);data.ledger.push({id:'issue-'+id,batchId:id,type:couponType==='general'?'通用券':'去水印专用券',n,source,purpose:source,kind:'发放',sign:'+',at:b.grantedAt});return b;};
 const use=(data,b,id,n,purpose,time,returned=0)=>{b.count-=n-returned;const row={id,type:b.type==='general'?'通用券':'去水印专用券',n,purpose,source:b.source,kind:'使用',sign:'−',at:at(time),returned,batches:[{id:b.id,count:n,expiry:b.expiry,returnedCount:returned}]};data.ledger.push(row);return row;};
 const ordinary=make('demo-user-ad01','普通用户 · 广告领券示例',false);
 const a=issue(ordinary,'DEMO-AD-001',1,'广告观看奖励','2026-11-19T09:00','2026-11-20T00:00','DEMO-B02-001');
 issue(ordinary,'DEMO-AD-002',1,'广告观看奖励','2026-11-19T09:20','2026-11-20T00:00','DEMO-B02-002');
 use(ordinary,a,'DEMO-USE-001',1,'高清保存','2026-11-19T09:05');
 // 会员样例的使用用途、数量和原期限与会员详情中已有的样例一致。
 const m1=make('demo-member01','月付到期重开并接续年付示例',true);issue(m1,'DEMO-MONTH-OLD-001',30,'会员每月赠券','2026-10-10T09:00','2026-11-10T09:00','DEMO-ORDER-012:0');issue(m1,'DEMO-DAILY-OLD-001',3,'会员每日权益','2026-10-10T09:00','2026-10-11T00:00');issue(m1,'DEMO-MONTH-001',30,'会员每月赠券','2026-11-17T09:00','2026-12-17T09:00');
 const daily=issue(m1,'DEMO-DAILY-001',3,'会员每日权益','2026-11-17T09:00','2026-11-18T00:00');use(m1,daily,'DEMO-USE-002',1,'高清保存','2026-11-17T10:12');
 const water=issue(m1,'DEMO-WATERMARK-001',1,'好友注册奖励','2026-11-17T09:10','2026-12-02T09:10','','watermark');use(m1,water,'DEMO-USE-003',1,'去水印','2026-11-17T10:15');
 const m2=make('demo-member02','会员用券示例',true),month=issue(m2,'DEMO-MONTH-002',30,'会员每月赠券','2026-11-16T09:20','2026-12-16T09:20');use(m2,month,'DEMO-USE-004',2,'超清保存','2026-11-17T09:40');
 const r=issue(m2,'DEMO-DAILY-002',3,'会员每日权益','2026-11-17T00:00','2026-11-18T00:00'),used=use(m2,r,'DEMO-USE-005',1,'高清保存','2026-11-17T10:05',1);m2.ledger.push({id:'DEMO-RETURN-001',batchId:r.id,type:'通用券',n:1,source:r.source,purpose:'保存失败返还',kind:'返还',sign:'+',relatedEventId:used.id,at:at('2026-11-17T10:06')});
 const m6=make('demo-member06','会员接续示例',true),m6month=issue(m6,'DEMO-MONTH-006',30,'会员每月赠券','2026-11-16T10:00','2026-12-16T10:00');use(m6,m6month,'DEMO-USE-006',2,'设置视频壁纸','2026-11-17T11:03');issue(m6,'DEMO-DAILY-006',3,'会员每日权益','2026-11-17T00:00','2026-11-18T00:00');
 const m7=make('demo-member07','周卡接续月卡示例',true);issue(m7,'DEMO-WEEK-OLD-007',7,'7天会员赠券','2026-11-01T09:00','2026-11-08T09:00','DEMO-ORDER-016:0');issue(m7,'DEMO-DAILY-OLD-007',3,'会员每日权益','2026-11-01T09:00','2026-11-02T00:00');issue(m7,'DEMO-WEEK-007',7,'7天会员赠券','2026-11-17T09:00','2026-11-24T09:00','DEMO-ORDER-014:0');issue(m7,'DEMO-DAILY-007',3,'会员每日权益','2026-11-17T09:00','2026-11-18T00:00');
 return data;
}
function snapshot(){const live=window.NEW_UI?.couponAudit;return build([...(live?[live]:[]),...sampleData()]);}
window.COUPON_AUDIT={snapshot,build};
})();
