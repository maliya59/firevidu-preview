/* 模板和壁纸各三个事件。此文件不发送网络请求，供本地演示与口径验收共用。 */
((root)=>{'use strict';
const DAY=86400000,NAMES=['template_impression','template_click','template_save_success'],WALLPAPER_NAMES=['wallpaper_impression','wallpaper_click','wallpaper_set_success'];
const ALL_NAMES=[...NAMES,...WALLPAPER_NAMES];
const clone=x=>JSON.parse(JSON.stringify(x));
const dayKey=time=>new Date(Number(time)+330*60000).toISOString().slice(0,10);
const dailyBoundary=time=>Math.floor((Number(time)+330*60000)/DAY)*DAY-330*60000;
const formatRate=(n,d)=>d?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(n/d*100)+'%':'—';
function createTracker({kind='template',now=Date.now,read=()=>[],write=()=>{},actor='anonymous',makeId=()=>root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)}={}){
 const names=kind==='wallpaper'?WALLPAPER_NAMES:NAMES,idField=kind==='wallpaper'?'wallpaper_id':'template_id',nameField=kind==='wallpaper'?'wallpaper_name':'template_name';
 let events=[];try{events=read().filter(e=>names.includes(e.event_name)&&e.environment==='local_demo');}catch{}
 const rounds=new Map(),saved=new Set(events.filter(e=>e.event_name===names[2]).map(e=>e.creation_id));let flow=null,creation=null;
 const persist=()=>{try{write(clone(events));}catch{};};
 const append=(name,data)=>{const event={...clone(data),event_id:data.event_id||makeId(),event_name:name,occurred_at:new Date(now()).toISOString(),actor_id:actor,environment:'local_demo'};events.push(event);persist();return event;};
 function beginRound(key,reuse=true){let round=rounds.get(key);if(!reuse||!round||now()-round.started>=DAY){round={id:makeId(),key,started:now(),impressions:new Map(),visibleSince:new Map()};rounds.set(key,round);}return round;}
 function metaFields(meta,round){return {content_kind:kind,[idField]:String(meta.id),[nameField]:String(meta.title||meta.name||''),style_id:meta.style_id||null,style_name:meta.style_id?meta.style_name||'未命名风格':'未分类',output_type:kind==='wallpaper'?meta.type:meta.type==='video'?'video':'image',vip:meta.vip===true,source:meta.source,position:meta.position,list_round_id:round.id};}
 function impression(meta,round){if(!meta?.id||!round)return null;if(now()-round.started>=DAY)round=beginRound(round.key,false);let event=round.impressions.get(String(meta.id));if(!event){event=append(names[0],{...metaFields(meta,round),impression_id:makeId()});round.impressions.set(String(meta.id),event);}return event;}
 function visibility(meta,round,ratio,foreground){if(!round)return;if(now()-round.started>=DAY)round=beginRound(round.key,true);if(round.impressions.has(String(meta.id)))return;if(!foreground||ratio<.5){round.visibleSince.delete(String(meta.id));return;}const id=String(meta.id);if(!round.visibleSince.has(id))round.visibleSince.set(id,now());if(now()-round.visibleSince.get(id)>=1000)impression(meta,round);}
 function click(meta,round){const exposed=impression(meta,round);if(!exposed)return null;const data={...exposed,flow_id:makeId()};const id=makeId();data.event_id=id;data.click_event_id=id;const event=append(names[1],data);flow=clone(event);creation=null;return clone(flow);}
 function startTemplate(meta){if(!flow||flow[idField]!==String(meta?.id)){flow=null;creation=null;}}
 function beginCreation(templateId){if(!flow||flow[idField]!==String(templateId))return null;creation={id:makeId(),flow:clone(flow)};return creation.id;}
 function saveSuccess(outcome){if(outcome!=='success'||!creation||saved.has(creation.id))return false;const data={...creation.flow,creation_id:creation.id};delete data.event_id;delete data.event_name;delete data.occurred_at;append(names[2],data);saved.add(creation.id);return true;}
 return {beginRound,visibility,click,startTemplate,beginCreation,saveSuccess,clearFlow(){flow=null;creation=null;},get events(){return clone(events);},get flow(){return flow&&clone(flow);},get creation(){return creation&&clone(creation);}};
}
function report(input,filters={},at=Date.now()){
 const events=[...new Map(input.filter(e=>ALL_NAMES.includes(e.event_name)).map(raw=>{const kind=raw.content_kind||'template',e=kind==='wallpaper'?{...raw,template_id:raw.wallpaper_id,template_name:raw.wallpaper_name}:raw;return [e.event_id,{...e,content_kind:kind}];})).values()].sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));
 const groups=new Map(),exposures=new Map(),clicks=new Map(),rounds=new Set(),creations=new Set();let invalid=0;
 const keyword=String(filters.keyword||'').trim().toLocaleLowerCase();
 const matches=e=>(!filters.kind||e.content_kind===filters.kind)&&(!keyword||String(e.template_id).toLocaleLowerCase().includes(keyword)||String(e.template_name||'').toLocaleLowerCase().includes(keyword))&&(!filters.start||dayKey(Date.parse(e.occurred_at))>=filters.start)&&(!filters.end||dayKey(Date.parse(e.occurred_at))<=filters.end)&&(!filters.output||e.output_type===filters.output)&&(!filters.vip||String(e.vip)===filters.vip)&&(!filters.source||e.source===filters.source)&&(!filters.minPosition||e.position>=filters.minPosition)&&(!filters.maxPosition||e.position<=filters.maxPosition);
 const same=(a,b)=>['content_kind','actor_id','template_id','style_id','output_type','vip','source','position','list_round_id','impression_id'].every(k=>(a[k]??null)===(b[k]??null));
 for(const e of events){const time=Date.parse(e.occurred_at);if(!e.event_id||!e.actor_id||!e.template_id||!Number.isFinite(time)||time>at){invalid++;continue;}
  if(e.event_name===(e.content_kind==='wallpaper'?WALLPAPER_NAMES[0]:NAMES[0])){const key=e.content_kind+'|'+e.list_round_id+'|'+e.template_id;if(!e.list_round_id||!e.impression_id){invalid++;continue;}if(rounds.has(key))continue;rounds.add(key);if(!matches(e))continue;const template=e.content_kind+':'+e.template_id;if(!groups.has(template))groups.set(template,{id:String(e.template_id),kind:e.content_kind,output:e.output_type,name:e.template_name||(e.content_kind==='wallpaper'?'壁纸':'模板'),exposed:new Set(),clicked:new Set(),saved:new Set(),pending:false});const group=groups.get(template);group.exposed.add(e.actor_id);group.pending ||= at-time<DAY;exposures.set(e.impression_id,{event:e,time,group});
  }else if(e.event_name===(e.content_kind==='wallpaper'?WALLPAPER_NAMES[1]:NAMES[1])){const origin=exposures.get(e.impression_id);if(!origin)continue;if(!same(e,origin.event)||!e.flow_id||e.click_event_id!==e.event_id){invalid++;continue;}if(time<origin.time||time>origin.time+DAY)continue;origin.group.clicked.add(e.actor_id);clicks.set(e.event_id,{event:e,time,origin});
  }else{const click=clicks.get(e.click_event_id);if(!click)continue;if(!same(e,click.event)||e.flow_id!==click.event.flow_id||!e.creation_id){invalid++;continue;}if(creations.has(e.creation_id))continue;creations.add(e.creation_id);if(time<=click.time||time>click.origin.time+DAY)continue;click.origin.group.saved.add(e.actor_id);}
 }
 return {invalid,rows:[...groups.values()].map(g=>({id:g.id,kind:g.kind,output:g.output,name:g.name,E:g.exposed.size,C:g.clicked.size,S:g.saved.size,ctr:g.clicked.size/(g.exposed.size||1),clickSave:g.clicked.size?g.saved.size/g.clicked.size:null,pending:g.pending}))};
}
const api={DAY,NAMES,WALLPAPER_NAMES,createTracker,report,dayKey,dailyBoundary,formatRate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TEMPLATE_METRICS_CORE=api;
})(typeof window==='undefined'?globalThis:window);
