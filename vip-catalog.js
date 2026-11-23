/* VIP 分类与资源角标；沿用已有示例素材，内容权限由 VIP_ACCESS 统一处理。 */
(()=>{'use strict';
const E=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const help=(element,title,description)=>{element.dataset.helpTitle=title;element.dataset.help=description;element.dataset.helpStatus='已确认';return element;};
const templateSamples=[
 {id:'1',type:'image',title:'模板名称模板名称',vip:true,action:{home:'图片模板 · 人物',search:'搜索结果 · 图片模板一'},crop:{x:15,y:184,w:165,h:265}},
 {id:'2',type:'image',title:'模板名称模板名称模板…',vip:false,action:{home:'图片模板 · 头像',search:'搜索结果 · 图片模板二'},crop:{x:195,y:184,w:165,h:265}},
 {id:'12',type:'video',title:'模板名称模板名称',vip:true,action:{home:'视频模板 · KING',search:'搜索结果 · 视频模板'},crop:{x:15,y:459,w:165,h:266}}
];
const wallpaperModes=['static','motion','video','static','motion','video'];
const states=new WeakMap(),wallpaperOriginalOrder=new WeakMap();let selectedCategory='全部',svgSequence=0,vipRound=null,vipRoundSequence=0;
const layerData=screen=>(window.UI_DATA?.layers?.[screen]||[]).filter(layer=>layer.visible);
const flags=()=>window.VIP_FLAGS;
function isVipTemplate(id){const sample=templateSamples.find(item=>item.id===String(id));return flags()?.isVip?.('template',String(id),Boolean(sample?.vip))??Boolean(sample?.vip);}
function isVipWallpaper(id){return flags()?.isVip?.('wallpaper',String(id),String(id)==='official-0')??String(id)==='official-0';}
function isFeatured(kind,id){return Boolean(flags()?.isFeatured?.(kind,String(id),false));}
function templateMeta(item){const stored=window.ADMIN_UI?.getTemplate?.(item.id);return {...item,...stored,id:item.id,type:item.type,title:stored?.title||item.title,vip:stored?stored.vip:isVipTemplate(item.id),featured:stored?stored.featured:isFeatured('template',item.id),state:stored?.state||item.state||'已上架',appVisible:stored?stored.appVisible:item.appVisible!==false,publishedAt:window.WALLPAPER_RANKING?.publicationTime(stored?stored.publishedAt:item.publishedAt)??null};}
function rankVipBatch(items,options={}){return window.WALLPAPER_RANKING.nextBatch(items.filter(item=>item.vip===true).map(item=>({...item,state:item.state||'已上架',appVisible:item.appVisible!==false})),{...options,scope:{},batchIndex:2});}
function beginVipRound(){vipRound={id:++vipRoundSequence,seen:new Set(),visible:[],scrollTop:0,now:Date.now()};}
function appendVipBatch(){if(!vipRound)beginVipRound();const batch=rankVipBatch(templateSamples.map(templateMeta),{seen:vipRound.seen,now:vipRound.now});for(const id of batch.ids){vipRound.seen.add(id);vipRound.visible.push(id);}return batch.items.length>0;}
function openTemplate(item,button){const meta=templateMeta(item);window.TEMPLATE_METRICS?.open(meta,button);if(window.VIP_ACCESS?.openTemplate)window.VIP_ACCESS.openTemplate(meta);else if(typeof start==='function')start(meta.type,meta);}
function node(root,id){return root.querySelector('[id="'+id+'"]');}
function rememberVisibility(state,element,group='hidden'){const map=state[group];if(!element||map.has(element))return;map.set(element,element.style.visibility);element.style.visibility='hidden';}
function restoreVisibility(state,group='hidden'){for(const [element,value]of state[group])if(element.isConnected)element.style.visibility=value;state[group].clear();}
function artworkBox(screen,item,button){
 const left=screen==='home'?item.crop.x:parseFloat(button?.style.left),top=screen==='home'?item.crop.y:parseFloat(button?.style.top);
 const boxes=layerData(screen).filter(layer=>['group','rectangle'].includes(layer.type)&&layer.w===item.crop.w&&layer.h>=200&&layer.h<=item.crop.h);
 const nearest=boxes.sort((a,b)=>(Math.abs(a.x-left)+Math.abs(a.y-top))-(Math.abs(b.x-left)+Math.abs(b.y-top)))[0];
 return nearest?{x:nearest.x,y:nearest.y,w:nearest.w,h:nearest.h}:{x:Number.isFinite(left)?left:item.crop.x,y:Number.isFinite(top)?top:item.crop.y,w:item.crop.w,h:220};
}
function stripBakedBadges(screen,root,box,{prefix='',state=null}={}){
 const inside=layer=>layer.x>=box.x&&layer.y>=box.y&&layer.x+layer.w<=box.x+box.w+.5&&layer.y+layer.h<=box.y+box.h+.5;
 const overlaps=layer=>layer.x<box.x+box.w&&layer.y<box.y+box.h&&layer.x+layer.w>box.x&&layer.y+layer.h>box.y;
 const labels=layerData(screen).filter(layer=>layer.type==='text'&&inside(layer)&&(/^(?:精选|NEW|\d+:\d+(?::\d+)?)$/.test(String(layer.text).trim())));
 const targets=new Set(labels);
 // The source has a second badge row with its text deleted but its star and
 // background still present. These exact small groups are artwork decorations,
 // not photograph layers; label matching cannot discover them.
 const unlabeled={home:['l426AD989EFA74CEFB4AADAADB8D44E34'],search:['lA2D4C277731F4A97BA3BD97CCD0BB350']};
 for(const id of unlabeled[screen]||[]){const group=layerData(screen).find(layer=>layer.id===id);if(group&&overlaps(group))targets.add(group);}
 for(const label of labels)for(const group of layerData(screen).filter(layer=>layer.type==='group'&&overlaps(layer)&&layer.w<=100&&layer.h<=40&&layer.x<=label.x&&layer.y<=label.y&&layer.x+layer.w>=label.x+label.w-.5&&layer.y+layer.h>=label.y+label.h-.5))targets.add(group);
 const hide=element=>{if(state)rememberVisibility(state,element,'badgeHidden');else element.style.visibility='hidden';};
 for(const target of targets){const element=node(root,prefix+target.id);if(!element)continue;hide(element);
  // SVG descendants may override inherited visibility. Hide the small badge's
  // actual descendants too, including its star path, without touching the cover.
  for(const decoration of element.querySelectorAll('*'))hide(decoration);
 }
}
function sourceCard(item){
 const prefix='vip-card-'+(++svgSequence)+'-';
 const source=window.UI_DATA.svg.home.replace(/id="([^"]+)"/g,(_,id)=>'id="'+prefix+id+'"').replace(/url\(#([^)]*)\)/g,(_,id)=>'url(#'+prefix+id+')').replace(/(href|xlink:href)="#([^"]+)"/g,(_,attribute,id)=>attribute+'="#'+prefix+id+'"');
 const host=document.createElement('div');host.className='vip-template-visual';host.innerHTML=source;
 const svg=host.querySelector('svg'),box=item.crop;
 svg.setAttribute('viewBox',`${box.x} ${box.y} ${box.w} ${box.h}`);svg.setAttribute('width',box.w);svg.setAttribute('height',box.h);svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
 stripBakedBadges('home',host,artworkBox('home',item),{prefix});
 return host;
}
function nativeFeedBottom(root){
 const nativeNav=parseFloat(root.querySelector('.new-nav')?.style.top);
 const banner=layerData('home').filter(layer=>layer.type==='group'&&layer.w>=300&&layer.w<=345&&layer.h>=40&&layer.h<=75&&layer.y>600).map(layer=>layer.y);
 return Math.min(Number.isFinite(nativeNav)?nativeNav:815,...banner);
}
function drawVipTemplates(root,state){
 restoreVisibility(state);root.querySelector('.vip-template-grid')?.remove();
 if(selectedCategory!=='VIP')return;
 const top=184,bottom=nativeFeedBottom(root);
 for(const layer of layerData('home')){
  if(layer.y>=top-1&&layer.y<bottom&&layer.h<=bottom-top+1)rememberVisibility(state,node(root,layer.id));
 }
 for(const hotspot of root.querySelectorAll('.hotspot')){
  const y=parseFloat(hotspot.style.top);if(y>=top-1&&y<bottom)rememberVisibility(state,hotspot);
 }
 for(const overlay of root.querySelectorAll('.native-template-badges'))rememberVisibility(state,overlay);
 const list=document.createElement('section');list.className='vip-template-grid';list.style.cssText=`top:${top}px;height:${Math.max(0,bottom-top-8)}px`;
 list.setAttribute('aria-label','VIP模板列表');
 if(!vipRound)beginVipRound();if(!vipRound.visible.length)appendVipBatch();
 const candidates=templateSamples.map(templateMeta).filter(item=>item.vip===true&&item.state==='已上架'&&item.appVisible!==false&&item.visible!==false),byId=new Map(candidates.map(item=>[String(item.id),item]));
 const templates=vipRound.visible.map(id=>byId.get(id)).filter(Boolean);
 if(!templates.length){const empty=document.createElement('p');empty.className='vip-template-empty';empty.textContent='暂无VIP模板';list.append(empty);}
 for(const item of templates){
  const card=document.createElement('button');card.type='button';card.className='vip-template-card';card.dataset.vipTemplateId=item.id;card.setAttribute('aria-label','打开VIP'+(item.type==='video'?'视频':'图片')+'模板');
  help(card,'VIP专享模板','此模板已标记为VIP专享，点击进入详情。普通用户需先登录并完成本次额外的两次激励广告体验；这些广告不能用券抵扣。');
  card.appendChild(sourceCard(item));const badges=document.createElement('div');badges.className='vip-template-badge-host';badges.style.height=artworkBox('home',item).h+'px';window.RESOURCE_BADGES?.render(badges,item);card.appendChild(badges);
  card.setAttribute('aria-description',window.RESOURCE_BADGES?.descriptors(item).map(badge=>badge.label).join('，')||'');
  card.onclick=()=>openTemplate(item,card);list.appendChild(card);
 }
 if(candidates.some(item=>!vipRound.seen.has(String(item.id)))){const more=document.createElement('button');more.type='button';more.className='vip-template-more';more.dataset.vipTemplateMore='';more.textContent='加载更多';more.onclick=()=>{if(appendVipBatch())drawVipTemplates(root,state);};list.appendChild(more);}
 list.addEventListener('scroll',()=>{vipRound.scrollTop=list.scrollTop;if(list.scrollTop+list.clientHeight>=list.scrollHeight-100&&appendVipBatch())drawVipTemplates(root,state);},{passive:true});
 root.appendChild(list);list.scrollTop=vipRound.scrollTop;
}
function categoryNames(){
 const names=layerData('home').filter(layer=>layer.type==='text'&&layer.y===146).sort((a,b)=>a.x-b.x).map(layer=>layer.text.trim()).filter(Boolean);
 const unique=[...new Set([...names,'社交表达','创意风格'])];const index=Math.max(0,unique.indexOf('全部')+1);unique.splice(index,0,'VIP');return unique;
}
function selectCategory(name){if(!categoryNames().includes(name))return false;if(name==='VIP'&&selectedCategory!=='VIP')beginVipRound();if(selectedCategory!==name){selectedCategory=name;window.TEMPLATE_METRICS?.newRound();}return true;}
function installCategories(root,state){
 for(const layer of layerData('home'))if(layer.y>=120&&layer.y+layer.h<=177&&layer.h<=55)rememberVisibility(state,node(root,layer.id),'categoryHidden');
 const names=categoryNames();if(!names.includes(selectedCategory))selectedCategory='全部';
 for(const hotspot of root.querySelectorAll('.hotspot'))if(names.includes(hotspot.dataset.action))hotspot.remove();
 const strip=document.createElement('div');strip.className='vip-category-strip';strip.setAttribute('role','tablist');strip.setAttribute('aria-label','模板分类');
 for(const name of names){
  const button=document.createElement('button');button.type='button';button.className='vip-category-tab'+(name==='VIP'?' vip-category-entry':'');button.dataset.vipCategory=name;button.setAttribute('role','tab');button.setAttribute('aria-selected',String(name===selectedCategory));
  button.textContent=name;
  help(button,name==='VIP'?'VIP模板分类':name+'分类',name==='VIP'?'显示后台标记为VIP专享的模板。普通用户可通过额外观看两次激励广告体验，原保存与去水印广告规则继续执行。':'切换此模板分类，保留原界面的分类入口。');
  button.onclick=()=>{
   if(name==='VIP'&&selectedCategory!=='VIP')beginVipRound();
   const categoryChanged=selectedCategory!==name;selectedCategory=name;if(categoryChanged)window.TEMPLATE_METRICS?.newRound();for(const other of strip.querySelectorAll('[data-vip-category]'))other.setAttribute('aria-selected',String(other.dataset.vipCategory===name));
   drawVipTemplates(root,state);window.TEMPLATE_METRICS?.onListRender('home');
  };
  strip.appendChild(button);
 }
 root.appendChild(strip);state.strip=strip;
 drawVipTemplates(root,state);
}
function installTemplateActions(screen,root,state){
 for(const overlay of root.querySelectorAll('.native-template-badges'))overlay.remove();
 for(const item of templateSamples){const action=item.action[screen];if(!action)continue;const button=[...root.querySelectorAll('.hotspot')].find(element=>element.dataset.action===action);if(!button)continue;
  const meta=templateMeta(item),box=artworkBox(screen,item,button);stripBakedBadges(screen,root,box,{state});
  const overlay=document.createElement('div');overlay.className='native-template-badges';overlay.dataset.templateId=item.id;overlay.style.cssText=`left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`;
  window.RESOURCE_BADGES?.render(overlay,meta);root.appendChild(overlay);
  button.dataset.templateId=item.id;button.dataset.vipContent=String(meta.vip);button.dataset.featured=String(meta.featured);button.dataset.resourceNew=String(window.RESOURCE_BADGES?.isNew(meta.publishedAt)===true);button.onclick=event=>{event.stopPropagation();openTemplate(item,button);};
  button.setAttribute('aria-description',window.RESOURCE_BADGES?.descriptors(meta).map(badge=>badge.label).join('，')||'');
  help(button,meta.vip?'VIP专享模板':'模板详情',meta.vip?'进入此VIP模板详情。VIP直接使用，普通用户制作前需登录并额外完成两次激励广告；保存等广告仍按原规则执行。':'进入此普通模板详情，按原制作与保存流程使用。');
 }
}
function wallpaperMeta(card){
 let id=card.dataset.wallpaperId;
 if(!id){const match=card.getAttribute('aria-label')?.match(/壁纸(\d+)$/);if(!match)return null;id='official-'+(Number(match[1])-1);}
 const index=Number(id.replace('official-',''));if(!Number.isInteger(index)||!wallpaperModes[index])return null;
 return {id,type:wallpaperModes[index],vip:isVipWallpaper(id),featured:isFeatured('wallpaper',id),title:card.querySelector('.wallpaper-name')?.textContent||'壁纸名称'};
}
function sortWallpapers(grid){
 const cards=[...grid.querySelectorAll('.wallpaper-card')];
 for(const [index,card]of cards.entries())if(!wallpaperOriginalOrder.has(card))wallpaperOriginalOrder.set(card,index);
 const sorted=cards.slice().sort((a,b)=>{
  const first=wallpaperMeta(a),second=wallpaperMeta(b);
  return Number(Boolean(second?.featured))-Number(Boolean(first?.featured))||wallpaperOriginalOrder.get(a)-wallpaperOriginalOrder.get(b);
 });
 // 移动前比较节点顺序，MutationObserver 的后续回调不再重复移动。
 if(sorted.some((card,index)=>card!==cards[index]))for(const card of sorted)grid.appendChild(card);
}
function annotateWallpapers(grid){
 for(const card of grid.querySelectorAll('.wallpaper-card')){
  const meta=wallpaperMeta(card);if(!meta)continue;card.dataset.wallpaperId=meta.id;card.dataset.vipContent=String(meta.vip);card.dataset.featured=String(meta.featured);
  const phone=card.querySelector('.wallpaper-phone');if(!phone)continue;
  phone.querySelector('small')?.remove();card.querySelector('.vip-wallpaper-flags')?.remove();window.RESOURCE_BADGES?.render(phone,meta);
 }
 sortWallpapers(grid);
}
function installWallpapers(root,state){
 const grid=root.querySelector('.wallpaper-grid');if(!grid)return;
 // The ranking module owns both order and resource metadata for this grid.
 if(grid.dataset.wallpaperRanked==='true')return;
 annotateWallpapers(grid);
 const listener=event=>{
  const card=event.target.closest('.wallpaper-card');if(!card||!grid.contains(card))return;const meta=wallpaperMeta(card);if(!meta)return;
  event.preventDefault();event.stopImmediatePropagation();window.VIP_ACCESS?.selectWallpaper?.(meta);
  if(window.NEW_UI?.context){window.NEW_UI.context.wallpaperMode=meta.type;window.NEW_UI.context.wallpaperAsset=meta.id;}
  if(typeof go==='function')go(meta.type==='motion'?'new-wallpaper-motion':meta.type==='video'?'new-wallpaper-video':'new-wallpaper-static');
 };
 grid.addEventListener('click',listener,true);state.grid=grid;state.listener=listener;
 state.observer=new MutationObserver(()=>annotateWallpapers(grid));state.observer.observe(grid,{childList:true});
}
function clean(root){
 const previous=states.get(root);if(!previous)return;
 previous.observer?.disconnect();if(previous.grid&&previous.listener)previous.grid.removeEventListener('click',previous.listener,true);
 restoreVisibility(previous);restoreVisibility(previous,'categoryHidden');restoreVisibility(previous,'badgeHidden');previous.strip?.remove();root.querySelector('.vip-template-grid')?.remove();for(const overlay of root.querySelectorAll('.native-template-badges'))overlay.remove();states.delete(root);
}
function enhance(screen,root){
 if(!root)return;clean(root);const current={screen,hidden:new Map(),categoryHidden:new Map(),badgeHidden:new Map()};states.set(root,current);
 if(screen==='home'){installTemplateActions(screen,root,current);installCategories(root,current);}
 else if(screen==='search')installTemplateActions(screen,root,current);
 else if(screen==='new-wallpaper')installWallpapers(root,current);
}
function refreshVisibleCatalog(){
 const root=document.querySelector('#screen'),current=root&&states.get(root);if(!current)return;
 if(current.screen==='home'){installTemplateActions('home',root,current);drawVipTemplates(root,current);}
 else if(current.screen==='search')installTemplateActions('search',root,current);
 else if(current.screen==='new-wallpaper'&&current.grid?.isConnected)annotateWallpapers(current.grid);
}
window.addEventListener('vip-flags-change',refreshVisibleCatalog);
window.addEventListener('template-catalog-change',refreshVisibleCatalog);
window.VIP_CATALOG={selectCategory,enhance,isVipTemplate,isVipWallpaper,rankVipBatch,get vipRound(){return vipRound?{...vipRound,seen:[...vipRound.seen],visible:[...vipRound.visible]}:null;},get selectedCategory(){return selectedCategory;},get templates(){return templateSamples.map(templateMeta);}};
})();
