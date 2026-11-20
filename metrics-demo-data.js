/* 仅用于原型展示的示例人数；不写入埋点记录，不代表真实用户。 */
(root=>{'use strict';
const DAY=86400000;
const templates=[['1','皇家婚礼','image',1580,.16,.42],['2','洒红节缤纷狂欢','image',1320,.13,.35],['3','克里希纳节祝福','image',1060,.19,.48],['4','紫色花语幻境','image',880,.11,.31],['5','浪漫红心相框','image',650,.14,.38],['6','欢乐儿童节','image',520,.09,.29],['12','你和我','video',1240,.22,.46],['9','男性职业证件照','image',180,0,0]];
const wallpapers=[['demo-wallpaper-01','海岸晨光','static',1460,.17,.4],['demo-wallpaper-02','山间云海','motion',1250,.21,.36],['demo-wallpaper-03','流动极光','video',1120,.2,.33],['demo-wallpaper-04','落日海岸','static',910,.15,.44],['demo-wallpaper-05','远山薄雾','motion',780,.18,.39],['demo-wallpaper-06','星河流光','video',630,.13,.3],['demo-wallpaper-07','晴空海浪','static',410,.12,.41],['demo-wallpaper-08','静谧山谷','motion',230,.1,.28],['demo-wallpaper-09','深夜微光','video',90,0,0]];
function report(kind,filters={},now=Date.now(),catalog=[]){
 const boundary=Math.floor((now+330*60000)/DAY)*DAY-330*60000,word=String(filters.keyword||'').trim().toLowerCase(),names=new Map(catalog.map(x=>[String(x.id),x]));
 const rows=(kind==='wallpaper'?wallpapers:templates).map(([id,title,output,base,clickRate,successRate],index)=>{
  const item=names.get(id),name=item?.title||item?.name||title;
  const totals={E:0,C:0,S:0};let included=false;
  for(let offset=1;offset<=7;offset++){
   const date=new Date(boundary-offset*DAY+330*60000).toISOString().slice(0,10);
   if(filters.start&&date<filters.start||filters.end&&date>filters.end)continue;included=true;
   const E=Math.round(base*(.68+((offset+index)%5)*.08)),C=Math.floor(E*clickRate),S=Math.floor(C*successRate);totals.E+=E;totals.C+=C;totals.S+=S;
  }
  const cover=kind==='wallpaper'?'assets/metrics-demo-'+output+'.svg':item?.cover||(['1','2','3','4'].includes(id)?'assets/admin-template-'+id+'.png':'');
  return {id,name,output,kind,...totals,ctr:totals.C/(totals.E||1),clickSave:totals.C?totals.S/totals.C:null,cover,example:true,included};
 }).filter(row=>row.included&&(!word||row.name.toLowerCase().includes(word)||row.id.toLowerCase().includes(word))&&(!filters.output||row.output===filters.output));
 return {invalid:0,rows};
}
const api={report};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.METRICS_DEMO_DATA=api;
})(typeof window==='undefined'?globalThis:window);
