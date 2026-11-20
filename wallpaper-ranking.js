/* 壁纸分批排序。纯函数只读取已明确的上架时间；浏览轮次与页面渲染分离。 */
(()=>{'use strict';
const DAY=86400000,BATCH_SIZE=12;
const E=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const mode=value=>({static:'static','静态':'static',motion:'motion','3d':'motion','3D':'motion','体感':'motion',video:'video','视频':'video'}[value]||null);
const modeName=value=>value==='motion'?'3D':value==='video'?'视频':'静态';
const localURL=value=>typeof value==='string'&&/^(?:\/?(?:uploads|assets)\/|data:image\/|blob:)/.test(value)?value:'';
function publicationTime(value){
 // Missing timestamps stay unknown. createdAt/updatedAt are deliberately unused.
 return typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
}
function uniqueById(items){
 const rows=new Map();
 for(const item of Array.isArray(items)?items:[])if(item&&item.id!==null&&item.id!==undefined&&String(item.id)!=='')rows.set(String(item.id),item);
 return [...rows.values()];
}
function scopeCandidates(items,scope={}){
 return uniqueById(items).filter(item=>{
  if(item.appVisible===false||item.visible===false||item.state!=='已上架')return false;
  if(scope.column==='featured'&&!item.featured)return false;
  if(scope.category&&item.category!==scope.category&&!(Array.isArray(item.categories)&&item.categories.includes(scope.category)))return false;
  if(scope.search&&!String(item.title||item.name||'').toLocaleLowerCase().includes(String(scope.search).trim().toLocaleLowerCase()))return false;
  return !scope.type||scope.type==='all'||mode(item.type)===mode(scope.type);
 });
}
function shuffled(items,rng=Math.random){
 const result=items.slice();
 for(let i=result.length-1;i>0;i--){const value=Number(rng()),unit=Number.isFinite(value)?Math.max(0,Math.min(1-Number.EPSILON,value)):0,j=Math.floor(unit*(i+1));[result[i],result[j]]=[result[j],result[i]];}
 return result;
}
function descendingId(first,second){
 const a=String(first.id),b=String(second.id);
 if(/^\d+$/.test(a)&&/^\d+$/.test(b)){const x=BigInt(a),y=BigInt(b);if(x!==y)return x>y?-1:1;}
 return a===b?0:a>b?-1:1;
}
function regularOrder(first,second){
 const featured=Number(Boolean(second.featured))-Number(Boolean(first.featured));if(featured)return featured;
 const a=publicationTime(first.publishedAt),b=publicationTime(second.publishedAt);
 if(a!==b)return a===null?1:b===null?-1:b-a;
 return descendingId(first,second);
}
function nextBatch(items,{scope={},batchIndex=0,seen=[],now=Date.now(),rng=Math.random}={}){
 const used=new Set([...seen].map(String)),pool=scopeCandidates(items,scope).filter(item=>!used.has(String(item.id)));
 if(!pool.length)return {items:[],ids:[],strategy:scope.column==='featured'||batchIndex>=2?'regular':'opening'};
 const opening=scope.column!=='featured'&&batchIndex<2;
 if(opening){
  const chosen=[],ids=new Set(),take=(candidates,count)=>{for(const item of shuffled(candidates.filter(row=>!ids.has(String(row.id))),rng).slice(0,count)){chosen.push(item);ids.add(String(item.id));}};
  take(pool.filter(item=>{const at=publicationTime(item.publishedAt);return at!==null&&at<=now&&at>=now-7*DAY;}),4);
  take(pool.filter(item=>item.featured),5);
  take(pool.filter(item=>!item.featured),3);
  // Any missing quota is filled within this scope, featured first.
  take(pool.filter(item=>item.featured),BATCH_SIZE-chosen.length);
  take(pool.filter(item=>!item.featured),BATCH_SIZE-chosen.length);
  const result=[...shuffled(chosen.filter(item=>item.featured),rng),...shuffled(chosen.filter(item=>!item.featured),rng)];
  return {items:result,ids:result.map(item=>String(item.id)),strategy:'opening'};
 }
 const regular=pool.slice().sort(regularOrder).slice(0,9),regularIds=new Set(regular.map(item=>String(item.id)));
 const random=shuffled(pool.filter(item=>!regularIds.has(String(item.id))),rng).slice(0,3),result=[];
 for(let i=0;i<regular.length;i++){result.push(regular[i]);if((i+1)%3===0&&random.length)result.push(random.shift());}
 result.push(...random);
 return {items:result,ids:result.map(item=>String(item.id)),strategy:'regular'};
}

// Local review placeholders have no publication timestamp and are never new releases.
const placeholders=Array.from({length:22},(_,index)=>['static','motion','video'][index%3]).map((type,index)=>({id:'official-'+index,type,title:'壁纸名称',state:'已上架',appVisible:true,placeholder:true,publishedAt:null,vip:index===0,featured:index===0,category:''}));
function normalizeResource(item,{placeholder=false}={}){
 const type=mode(item?.type);if(!type||item?.id===undefined||item?.id===null)return null;
 const id=String(item.id),url=localURL(item.url),posterUrl=localURL(item.posterUrl),previewUrl=localURL(item.previewUrl)||(type==='video'?posterUrl:url);
 const isPlaceholder=placeholder&&item.placeholder===true;
 return {...item,id,type,title:String(item.title||item.name||modeName(type)+'壁纸'),url,posterUrl,previewUrl,placeholder:isPlaceholder,
  appVisible:item.appVisible!==false&&item.visible!==false&&(isPlaceholder||Boolean(url)),publishedAt:publicationTime(item.publishedAt),category:String(item.category||'').trim(),
  vip:window.VIP_FLAGS?.isVip?.('wallpaper',id,Boolean(item.vip))??Boolean(item.vip),featured:window.VIP_FLAGS?.isFeatured?.('wallpaper',id,Boolean(item.featured))??Boolean(item.featured)};
}
function mergeCatalog(remote=[],seeds=[]){
 // Authoritative API rows overwrite matching seeds even when off shelf: never resurrect them.
 return uniqueById([...placeholders,...seeds,...remote]).map(item=>normalizeResource(item,{placeholder:placeholders.includes(item)})).filter(Boolean);
}

let remoteRows=[],loaded=false,loading=null,loadError='',activeView=null,round=null;
let selection={type:'all',search:''},searchMode=false,homeSnapshot=null,sourceScreen='new-wallpaper';
const SEARCH_SCREEN='new-wallpaper-search';
if(window.NEW_SCREENS&&!window.NEW_SCREENS[SEARCH_SCREEN])window.NEW_SCREENS[SEARCH_SCREEN]={...window.NEW_SCREENS['new-wallpaper'],title:'壁纸搜索'};
let roundSequence=0;
const currentCatalog=()=>mergeCatalog(remoteRows,Array.isArray(window.WALLPAPER_SEEDS)?window.WALLPAPER_SEEDS:[]);
const selectionKey=scope=>JSON.stringify([scope.type,scope.search]);
function startRound(){round={id:++roundSequence,key:selectionKey(selection),scope:{...selection},now:Date.now(),batchIndex:0,seen:new Set(),visible:[],scrollTop:0};}
function appendBatch(){
 if(!round||round.key!==selectionKey(selection))startRound();
 const batch=nextBatch(currentCatalog(),{scope:round.scope,batchIndex:round.batchIndex,seen:round.seen,now:round.now});
 if(!batch.items.length)return false;
 round.batchIndex++;for(const id of batch.ids){round.seen.add(id);round.visible.push(id);}return true;
}
async function refreshCatalog(){
 if(loading)return loading;
 loading=(async()=>{try{const response=await fetch('/api/wallpapers',{cache:'no-store'});if(!response.ok)throw Error('壁纸列表暂未更新');const data=await response.json();if(!Array.isArray(data.items))throw Error('壁纸列表暂未更新');remoteRows=data.items;loadError='';}catch{loadError='壁纸列表暂未更新';}finally{loaded=true;loading=null;}return currentCatalog();})();return loading;
}
function help(element,title,description){element.dataset.helpTitle=title;element.dataset.help=description;element.dataset.helpStatus='已确认';return element;}
function cardFor(resource){
 const card=document.createElement('button');card.type='button';card.className='wallpaper-card';card.dataset.wallpaperId=resource.id;card.dataset.wallpaperType=resource.type;card.dataset.featured=String(resource.featured);card.dataset.vipContent=String(resource.vip);card.setAttribute('aria-label','打开'+resource.title);
 const image=resource.type==='video'?(resource.posterUrl?`<img src="${E(resource.posterUrl)}" alt="" loading="lazy">`:resource.url?`<video src="${E(resource.url)}" preload="metadata" muted playsinline aria-hidden="true"></video>`:''):(resource.previewUrl?`<img src="${E(resource.previewUrl)}" alt="" loading="lazy">`:'');
 card.innerHTML=`<div class="wallpaper-phone">${image||`<span>${modeName(resource.type)}壁纸</span>`}</div><div class="wallpaper-name">${E(resource.title)}</div>`;
 window.RESOURCE_BADGES?.render(card.querySelector('.wallpaper-phone'),resource);card.setAttribute('aria-description',window.RESOURCE_BADGES?.descriptors(resource).map(badge=>badge.label).join('，')||'');
 help(card,resource.vip?'VIP专享壁纸':'壁纸详情','预览当前'+modeName(resource.type)+'壁纸。精选只影响推荐排序，VIP控制使用门槛；设置费用仍按对应模式和历史资格执行。'+(resource.placeholder?'这张卡片是原有本地示例占位，发布时间未记录，不进入近7天名额。':''));
 card.onclick=()=>{sourceScreen=typeof state!=='undefined'&&state.screen===SEARCH_SCREEN?SEARCH_SCREEN:'new-wallpaper';const latest=scopeCandidates(currentCatalog(),selection).find(item=>item.id===resource.id);if(!latest)return;window.TEMPLATE_METRICS?.open(latest,card);window.WALLPAPER_V2?.selectResource(latest);if(window.NEW_UI?.context){window.NEW_UI.context.wallpaperMode=latest.type;window.NEW_UI.context.wallpaperAsset=latest.id;}if(typeof go==='function')go(latest.type==='motion'?'new-wallpaper-motion':latest.type==='video'?'new-wallpaper-video':'new-wallpaper-static');};
 return card;
}
function draw(view){
 if(activeView!==view||!view.list.isConnected)return;
 const catalog=currentCatalog();
 const search=view.controls.querySelector('[data-wallpaper-search]');if(search.value!==selection.search)search.value=selection.search;
 for(const button of view.controls.querySelectorAll('[data-wallpaper-type]'))button.setAttribute('aria-selected',String(button.dataset.wallpaperType===selection.type));
 if(!loaded||view.refreshing){view.list.innerHTML='<p class="wallpaper-ranking-empty" role="status">正在读取壁纸…</p>';return;}
 if(!round||round.key!==selectionKey(selection))startRound();
 if(!round.batchIndex)appendBatch();
 const eligible=scopeCandidates(catalog,selection),byId=new Map(eligible.map(item=>[item.id,item])),position=round.scrollTop;
 view.list.innerHTML='';for(const id of round.visible){const resource=byId.get(id);if(resource)view.list.appendChild(cardFor(resource));}
 if(!view.list.children.length){const empty=document.createElement('p');empty.className='wallpaper-ranking-empty';empty.textContent=selection.search?'未找到相关壁纸':'暂无壁纸';view.list.appendChild(empty);}
 window.AD_REVIEW?.wallpaperFeed(view.list,round);
 const hasMore=eligible.some(item=>!round.seen.has(item.id));
 if(hasMore){const more=document.createElement('button');more.type='button';more.className='wallpaper-ranking-more';more.dataset.wallpaperMore='';more.textContent='加载更多';more.onclick=()=>{if(appendBatch())draw(view);};view.list.appendChild(more);}
 if(loadError){const retry=document.createElement('button');retry.type='button';retry.className='wallpaper-ranking-retry';retry.textContent=loadError+'，重试';retry.onclick=()=>refreshCatalog().then(()=>draw(view));view.list.appendChild(retry);}
 view.list.scrollTop=position;window.TEMPLATE_METRICS?.onListRender(state.screen);
}
function mount(root,list,options={}){
 root.querySelector('.wallpaper-ranking-controls')?.remove();list.dataset.wallpaperRanked='true';list.classList.add('wallpaper-ranked-grid');
 const controls=document.createElement('section');controls.className='wallpaper-ranking-controls';controls.setAttribute('aria-label','壁纸筛选');
 controls.innerHTML='<form class="wallpaper-ranking-search" role="search"><input type="search" aria-label="搜索壁纸名称" placeholder="搜索壁纸名称" data-wallpaper-search><button type="submit">搜索</button></form><div class="wallpaper-ranking-types" role="tablist" aria-label="壁纸类型">'+[['all','全部'],['static','静态壁纸'],['video','视频壁纸'],['motion','3D壁纸']].map(([key,label])=>`<button type="button" role="tab" data-wallpaper-type="${key}">${label}</button>`).join('')+'</div>';
 if(options.searchPage)controls.querySelector('.wallpaper-ranking-types')?.remove();root.appendChild(controls);const view={root,list,controls,refreshing:true};activeView=view;
 function change(next){if(Object.entries(next).every(([key,value])=>selection[key]===value))return;selection={...selection,...next};startRound();draw(view);}
 for(const button of controls.querySelectorAll('[data-wallpaper-type]'))button.onclick=()=>change({type:button.dataset.wallpaperType});
 const search=controls.querySelector('[data-wallpaper-search]');const submit=()=>{if(options.searchPage){change({search:search.value.trim()});return;}homeSnapshot={selection:{...selection},round};searchMode=true;selection={...selection,search:search.value.trim()};startRound();go(SEARCH_SCREEN);};controls.querySelector('form').onsubmit=event=>{event.preventDefault();submit();};search.onsearch=()=>{if(options.searchPage)change({search:search.value.trim()});};
 help(controls,'壁纸类型与名称搜索','按创建入口的静态、视频、3D类型和名称查找App可见内容。点击搜索进入独立结果页，返回恢复首页列表；结果页不显示类型标签；提交新搜索开始新一轮，非全部类型范围在页标题注明。精选和VIP仅为独立标记，不增加栏目。下架或草稿不进入列表；缺少明确发布时间的旧内容不算近7天。');
 list.addEventListener('scroll',()=>{if(activeView!==view||!round)return;round.scrollTop=list.scrollTop;if(list.scrollTop+list.clientHeight>=list.scrollHeight-100&&appendBatch())draw(view);},{passive:true});
 // Check current shelf state before reattaching cached cards after a return.
 draw(view);refreshCatalog().then(()=>{view.refreshing=false;draw(view);});
}
window.addEventListener('vip-flags-change',()=>{if(activeView?.list.isConnected)draw(activeView);});
function restoreHome(){if(!searchMode)return;selection=homeSnapshot?.selection||{type:'all',search:''};round=homeSnapshot?.round||null;homeSnapshot=null;searchMode=false;sourceScreen='new-wallpaper';}
function renderSearch(key,root){if(key!==SEARCH_SCREEN)return false;root.innerHTML='<header class="wallpaper-search-header"><button type="button" aria-label="返回壁纸首页">‹</button><strong>壁纸搜索</strong></header>';root.className='wireframe wallpaper-search-page';root.querySelector('header strong').textContent=selection.type==='all'?'壁纸搜索':modeName(selection.type)+'壁纸搜索';document.querySelector('#phone').dataset.height=812;const list=document.createElement('div');list.className='wallpaper-grid';list.setAttribute('aria-label','壁纸搜索结果');root.append(list);root.querySelector('header button').onclick=()=>{restoreHome();if(typeof back==='function')back();else go('new-wallpaper',false);};mount(root,list,{searchPage:true});return true;}
window.WALLPAPER_RANKING={renderSearch,restoreHome,get sourceScreen(){return sourceScreen;},publicationTime,uniqueById,scopeCandidates,shuffled,regularOrder,nextBatch,mergeCatalog,mount,refresh:refreshCatalog,
 reset(){round=null;selection={type:'all',search:''};searchMode=false;homeSnapshot=null;sourceScreen='new-wallpaper';},
 get catalog(){return currentCatalog();},get selection(){return {...selection};},get round(){return round?{...round,scope:{...round.scope},seen:[...round.seen],visible:[...round.visible]}:null;}};
})();
