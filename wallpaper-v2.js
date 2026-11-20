/* 壁纸 V2：照片直出 3D 预览，以及按成功设置模式保存的本机使用记录。 */
(()=>{'use strict';
const STORAGE='firevidu-wallpaper-v2',DB='firevidu-wallpaper-photos-v2';
const CUSTOM='new-wallpaper-custom',RESULT='new-wallpaper-custom-result',DETAIL='new-wallpaper-history-detail';
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const H=(title,description)=>`data-help-title="${E(title)}" data-help="${E(description)}" data-help-status="已确认"`;
const modeName=mode=>mode==='video'?'视频':mode==='motion'?'3D':'静态';
const normalizeMode=mode=>['motion','3d','3D'].includes(mode)?'motion':mode==='video'?'video':'static';
const TARGETS=[['home','设为桌面壁纸'],['lock','设为锁屏'],['both','同时设为壁纸和锁屏']];
const clone=value=>JSON.parse(JSON.stringify(value));
const demoState=()=>window.__DEMO__?.state||{};
const context=()=>window.NEW_UI?.context||{};
const navigate=(key,record=true)=>{if(typeof go==='function')go(key,record);};
const redraw=()=>{if(typeof render==='function')render();};
const notify=message=>{if(typeof toast==='function')toast(message);};
const timeLabel=value=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Kolkata',hour12:false});
const isMember=()=>window.VIP_ACCESS?.isMember?.()===true;
const sourceAllowed=value=>typeof value==='string'&&/^(?:\/?(?:uploads|assets)\/|data:image\/|blob:)/.test(value)?value:'';
let store={version:2,records:{},photos:{},draft:null};
try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved&&typeof saved==='object')store={...store,...saved,records:saved.records||{},photos:saved.photos||{}};}catch{}
let selected=null,historySource=null,worksTab='creations',photoBusy=false,generating=false,generationToken=0,modeChoice=null;
const objectURLs=new Map();let dbPromise;
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(store));return true;}catch{return false;}}
function database(){
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('photos');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 return dbPromise;
}
async function putPhoto(id,blob){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(blob,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('照片保存未完成'));});}
async function photoSource(id){
 if(objectURLs.has(id))return objectURLs.get(id);
 const db=await database(),blob=await new Promise((resolve,reject)=>{const req=db.transaction('photos','readonly').objectStore('photos').get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 if(!blob)return '';const url=URL.createObjectURL(blob);objectURLs.set(id,url);return url;
}
async function previewBlob(file){
 const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw new Error('照片无法读取');const scale=Math.min(1,1440/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('照片无法保存')),'image/jpeg',.91));}finally{URL.revokeObjectURL(url);}
}
function resourceKnown(id){return store.photos[id]||store.records[id]||{};}
function resourceCurrent(){
 const meta=window.VIP_ACCESS?.getWallpaper?.()||{},c=context();
 let id=String(c.wallpaperAsset||meta.id||'');
 if(!id||id==='official')id='official-'+(demoState().screen==='new-wallpaper-video'?2:demoState().screen==='new-wallpaper-motion'?1:0);
 const known=resourceKnown(id),same=selected?.id===id?selected:{};
 const type=normalizeMode(known.type||same.type||(meta.id===id?meta.type:null)||c.wallpaperMode);
 const vip=window.VIP_FLAGS?.isVip?.('wallpaper',id,Boolean(same.vip??known.vip??meta.vip))??Boolean(same.vip??known.vip??meta.vip);
 const publishedAt=same.publishedAt??known.publishedAt??meta.publishedAt;
 return {id,type,featured:window.VIP_FLAGS?.isFeatured?.('wallpaper',id,Boolean(same.featured??known.featured??meta.featured))??Boolean(same.featured??known.featured??meta.featured),publishedAt:typeof publishedAt==='number'&&Number.isFinite(publishedAt)&&publishedAt>0?publishedAt:null,mediaType:normalizeMode(same.mediaType||known.mediaType||type),title:String(same.title||known.title||meta.title||modeName(type)+'壁纸'),vip,custom:Boolean(known.custom||same.custom),photoId:known.photoId||same.photoId||'',previewUrl:sourceAllowed(same.previewUrl||known.previewUrl||''),url:sourceAllowed(same.url||known.url||''),posterUrl:sourceAllowed(same.posterUrl||known.posterUrl||'')};
}
function selectResource(meta){
 const id=String(meta.id),known=resourceKnown(id);
 selected={...known,...meta,id,type:normalizeMode(meta.type||known.type),mediaType:normalizeMode(meta.mediaType||meta.type||known.mediaType||known.type),custom:Boolean(meta.custom||known.custom)};
 context().wallpaperAsset=id;context().wallpaperMode=selected.type;
 window.VIP_ACCESS?.selectWallpaper?.(selected);window.TEMPLATE_METRICS?.wallpaperSelect(selected);return clone(selected);
}
function records(){return Object.values(store.records).filter(row=>row&&row.id&&(row.static||row.dynamic)).sort((a,b)=>Number(b.lastAt)-Number(a.lastAt));}
function canReuse(asset,mode){
 const id=String(asset||context().wallpaperAsset||resourceCurrent().id),row=store.records[id];
 if(!row)return false;
 return normalizeMode(mode)==='static'?Boolean(row.static||row.dynamic):Boolean(row.dynamic&&row.type===normalizeMode(mode));
}
function beforePrepare(mode,proceed){
 const resource=resourceCurrent();if(historySource!==resource.id||!canReuse(resource.id,mode))return false;
 const origin=demoState().screen,run=()=>{selectResource(resource);context().wallpaperMode=normalizeMode(mode);proceed();};
 if(normalizeMode(mode)!=='static'&&!isMember()&&(typeof adAllowed!=='function'||adAllowed('壁纸记录动态再次设置插页广告'))&&typeof playAd==='function')playAd(run,origin,'interstitial');
 else run();
 return true;
}
function recordSuccess(asset,mode,confirmedResource){
 const resource=confirmedResource||resourceCurrent(),id=String(asset||resource.id),old=store.records[id]||{};
 if(id!==resource.id)return false;
 const actualMode=normalizeMode(mode),now=Date.now();
 store.records[id]={...old,...resource,id,static:true,dynamic:Boolean(old.dynamic||actualMode!=='static'),firstAt:old.firstAt||now,lastAt:now,lastMode:actualMode,staticAt:actualMode==='static'?now:old.staticAt||0,dynamicAt:actualMode!=='static'?now:old.dynamicAt||0};
 const saved=save();window.dispatchEvent(new CustomEvent('wallpaper-records-change',{detail:{id,mode:actualMode}}));
 if(!saved)notify('设置已完成，使用记录未能保存，请检查本机存储');return saved;
}
async function fillVisual(element,resource,{parallax=false,staticImage=false}={}){
 if(!element)return;
 element.dataset.wallpaperResource=resource.id;
 const initial=resource.previewUrl||resource.url||'',src=initial||(resource.photoId?await photoSource(resource.photoId).catch(()=> ''):'');
 if(!element.isConnected||element.dataset.wallpaperResource!==resource.id)return;
 const recordCard=element.classList.contains('wp-v2-record-visual'),badge=recordCard&&!window.RESOURCE_BADGES?`<small class="wp-v2-record-type">${E(resource.type==='static'?'图片':modeName(resource.type))}</small>`:'',decorate=()=>{if(recordCard)window.RESOURCE_BADGES?.render(element,resource);};
 element.classList.remove('wp-v2-parallax');element.onpointermove=null;element.onpointerleave=null;
 if(normalizeMode(resource.mediaType||resource.type)==='video'&&resource.url){
  element.innerHTML=`<video class="wp-v2-back" src="${E(resource.url)}" ${resource.posterUrl?`poster="${E(resource.posterUrl)}"`:''} ${staticImage?'':'autoplay loop'} muted playsinline preload="auto" aria-label="${E(resource.title)}${staticImage?'静态画面':''}"></video>${badge}`;decorate();
  return;
 }
 if(!src){element.innerHTML=`<span class="wp-v2-placeholder">${E(modeName(resource.type))}壁纸</span>${badge}`;decorate();return;}
 element.innerHTML=`<img class="wp-v2-back" src="${E(src)}" alt="${E(resource.title)}">${parallax&&!staticImage?`<img class="wp-v2-front" src="${E(src)}" alt="" aria-hidden="true">`:''}${badge}`;decorate();
 element.classList.toggle('wp-v2-parallax',parallax&&!staticImage);
 if(parallax&&!staticImage){element.onpointermove=event=>{const b=element.getBoundingClientRect(),x=(event.clientX-b.left)/b.width-.5,y=(event.clientY-b.top)/b.height-.5;element.style.setProperty('--wp-x',(x*13)+'px');element.style.setProperty('--wp-y',(y*13)+'px');};element.onpointerleave=()=>{element.style.setProperty('--wp-x','0px');element.style.setProperty('--wp-y','0px');};}
}
function shell(root,title,{backTo='new-wallpaper'}={}){
 root.classList.remove('wireframe');root.classList.add('wp-v2-screen');root.innerHTML=`<div class="wp-v2-status"><span>9:41</span><span aria-hidden="true">▂▄▆ ▰</span></div><header class="wp-v2-header"><button type="button" aria-label="返回" ${H('返回','返回上一个壁纸页面，不改变已成功设置的历史记录。')}>‹</button><strong>${E(title)}</strong></header><section class="wp-v2-body"></section><div class="wp-v2-homebar" aria-hidden="true"></div>`;
 document.querySelector('#phone').dataset.height=812;
 root.querySelector('.wp-v2-header button').onclick=()=>{generationToken++;generating=false;if(backTo==='new-wallpaper-search'&&typeof back==='function')back();else navigate(backTo,false);};return root.querySelector('.wp-v2-body');
}
function dialog(root,title,message){
 root.querySelector('.wp-v2-dialog-mask')?.remove();const mask=document.createElement('div');mask.className='wp-v2-dialog-mask';mask.innerHTML=`<section role="dialog" aria-modal="true" aria-label="${E(title)}"><strong>${E(title)}</strong><p>${E(message)}</p><button type="button">知道了</button></section>`;mask.querySelector('button').onclick=()=>mask.remove();mask.onclick=event=>{if(event.target===mask)mask.remove();};root.appendChild(mask);
}
function renderCustom(root){
 const draft=store.draft&&store.photos[store.draft],body=shell(root,'照片生成3D壁纸');
 body.innerHTML=`<button type="button" class="wp-v2-upload ${draft?'has-photo':''}" data-wp-v2="upload" ${H('上传照片','选择本机照片作为3D壁纸输入，之后直接生成效果预览。不会增加装饰素材或元素选择步骤。')}><span>${draft?'照片预览':'＋'}</span>${draft?'':'<strong>上传你的照片</strong>'}</button><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="上传自己的照片" class="wp-v2-file"><p class="wp-v2-filename">${draft?E(draft.fileName):'JPG、PNG、WebP'}</p>${draft?'<button type="button" class="wp-v2-text-button" data-wp-v2="replace">更换照片</button>':''}<button type="button" class="wp-v2-primary" data-wp-v2="generate" ${photoBusy||generating||!draft?'disabled':''} ${H('生成3D壁纸','点击后进入生成流程。普通用户在生成时展示一次插页，会员按独立广告配置；生成后直接进入3D效果预览。正式拆分图层算法待接入，本地预览仅演示分层视差。')}>${photoBusy?'正在读取照片…':generating?'正在生成…':'生成3D壁纸'}</button>`;
 const input=body.querySelector('input'),pick=()=>input.click();body.querySelector('[data-wp-v2=upload]').onclick=pick;body.querySelector('[data-wp-v2=replace]')?.addEventListener('click',pick);
 if(draft)fillVisual(body.querySelector('.wp-v2-upload'),draft);
 input.onchange=async()=>{const file=input.files?.[0];if(!file)return;photoBusy=true;renderCustom(root);try{if(file.type&&!file.type.startsWith('image/'))throw new Error('请选择照片文件');const blob=await previewBlob(file),id='custom-'+(crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));await putPhoto(id,blob);const photo={id,type:'motion',title:'我的3D壁纸',fileName:file.name,custom:true,photoId:id,generated:false,createdAt:Date.now(),vip:false};store.photos[id]=photo;store.draft=id;if(!save())throw new Error('本机存储空间不足，请清理后重试');selected=photo;photoBusy=false;if(demoState().screen===CUSTOM)renderCustom(root);}catch(error){photoBusy=false;if(demoState().screen===CUSTOM){renderCustom(root);dialog(root,'照片上传失败',error.message||'照片暂时无法读取，请更换照片后重试。');}}};
 body.querySelector('[data-wp-v2=generate]').onclick=()=>{if(generating||photoBusy||!draft)return;const token=++generationToken;generating=true;renderCustom(root);const finish=()=>{if(token!==generationToken||store.draft!==draft.id){generating=false;return;}draft.generated=true;draft.generatedAt=Date.now();save();generating=false;selectResource(draft);navigate(RESULT,false);};if(typeof adAllowed==='function'&&adAllowed('照片生成3D插页广告')&&typeof playAd==='function')playAd(finish,CUSTOM,'interstitial');else finish();};
}
function closeModeChoice(restoreFocus=true){
 const current=modeChoice;if(!current)return;modeChoice=null;
 document.removeEventListener('keydown',current.onKey,true);current.mask.remove();
 if(restoreFocus&&current.previous?.isConnected)current.previous.focus({preventScroll:true});
}
function modeOffer(resource,mode){
 const pending=Boolean(window.NEW_UI?.wallpaper?.pending?.[resource.id+':'+mode]);
 const reused=historySource===resource.id&&canReuse(resource.id,mode);
 const title=mode==='static'?'设为静态壁纸':mode==='motion'?'保留3D效果':'保留视频动态效果';
 if(pending)return {title,note:'继续本次设置',help:'本次设置资格已经取得，继续设置不重复观看广告或扣券。'};
 if(reused)return {title,note:'',help:mode==='static'?'这张壁纸已有成功设置记录，从记录再设静态不看任何广告。':'这个动态效果已设置成功过，从记录再设不看激励广告；普通用户展示一次插页，VIP不展示。'};
 return {title,note:mode==='static'?'观看1次视频解锁':'观看2次视频解锁',help:mode==='static'?'首次设为静态壁纸需要1次正常激励视频，可主动选择1张通用券抵扣。':'首次设置当前动态效果需要2次正常激励视频，可主动选择通用券逐次抵扣；VIP内容额外体验规则单独判断。'};
}
function chooseMode(root,resource=resourceCurrent()){
 closeModeChoice(false);
 if(resource.type==='static'){selectResource(resource);window.NEW_UI?.wallpaper?.prepare('static');return;}
 const target=TARGETS.find(([key])=>key===context().wallpaperTarget)||TARGETS[2];context().wallpaperTarget=target[0];
 const primary=modeOffer(resource,resource.type),staticOffer=modeOffer(resource,'static');
 const mask=document.createElement('div');mask.className='wp-v2-choice-mask';mask.innerHTML=`<section class="wp-v2-choice" role="dialog" aria-modal="true" aria-labelledby="wp-v2-mode-title"><header><strong id="wp-v2-mode-title">${E(target[1])}</strong><button type="button" aria-label="关闭设置方式">×</button></header><button type="button" class="wp-v2-mode-primary" data-wp-v2-mode="${E(resource.type)}" ${H(primary.title,primary.help)}><strong>${E(primary.title)}</strong>${primary.note?`<span>${E(primary.note)}</span>`:''}</button><button type="button" class="wp-v2-mode-static" data-wp-v2-mode="static" ${H(staticOffer.title,staticOffer.help)}>${E(staticOffer.title)}${staticOffer.note?' · '+E(staticOffer.note):''}</button></section>`;
 const previous=document.activeElement,buttons=[...mask.querySelectorAll('button')];
 const onKey=event=>{if(document.querySelector('.field-help-popup'))return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeModeChoice();}else if(event.key==='Tab'){event.preventDefault();const index=buttons.indexOf(document.activeElement);buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}};
 modeChoice={mask,previous,onKey};
 mask.onclick=event=>{if(event.target===mask)closeModeChoice();};mask.querySelector('[aria-label="关闭设置方式"]').onclick=()=>closeModeChoice();
 for(const button of mask.querySelectorAll('[data-wp-v2-mode]'))button.onclick=()=>{const mode=button.dataset.wpV2Mode;closeModeChoice(false);selectResource(resource);window.NEW_UI?.wallpaper?.prepare(mode);};
 root.appendChild(mask);document.addEventListener('keydown',onKey,true);mask.querySelector('.wp-v2-mode-primary').focus({preventScroll:true});
}
function renderPreview(root,resource,{history=false}={}){
 const body=shell(root,history?'壁纸记录':resource.custom?'3D效果预览':modeName(resource.type)+'壁纸',{backTo:history?'works':resource.custom?CUSTOM:(window.WALLPAPER_RANKING?.sourceScreen||'new-wallpaper')});
 body.classList.add('wp-v2-preview-body');
 body.innerHTML=`<div class="wp-v2-effect" ${H('壁纸效果预览',resource.custom?'使用你上传的照片演示分层视差；正式客户端由算法拆分照片图层，本地不会伪造已完成真实3D拆分。':'预览当前壁纸。记录内可选择静态或原动态效果，广告规则按这张壁纸实际成功设置过的模式判断。')}></div>${history?`<h2 class="wp-v2-resource-title">${E(resource.title)}</h2><p class="wp-v2-history-time">上次使用：${E(modeName(store.records[resource.id].lastMode||resource.type))} · ${E(timeLabel(store.records[resource.id].lastAt))}</p>`:''}<div class="wp-v2-target-actions" role="group" aria-label="选择壁纸设置位置">${TARGETS.map(([key,label],index)=>`<button type="button" class="wp-v2-target-button${index===0?' wp-v2-target-primary':''}" data-wp-v2-target="${key}" ${H(label,'选择'+(key==='home'?'桌面壁纸':key==='lock'?'锁屏':'桌面壁纸和锁屏')+'作为本次设置位置。'+(resource.type==='static'?'随后按静态壁纸规则解锁。':'下一步主要选择保留'+(resource.type==='motion'?'3D':'视频')+'效果，也可通过底部小字改为静态壁纸。')+'仅系统设置成功后记录再次使用资格。')}>${E(label)}</button>`).join('')}</div>`;
 fillVisual(body.querySelector('.wp-v2-effect'),resource,{parallax:resource.type==='motion'});
 for(const button of body.querySelectorAll('[data-wp-v2-target]'))button.onclick=()=>{context().wallpaperTarget=button.dataset.wpV2Target;chooseMode(root,resource);};
}
function renderScreen(screen,root){
 closeModeChoice(false);
 if(![CUSTOM,RESULT,DETAIL,'new-wallpaper-static','new-wallpaper-motion','new-wallpaper-video'].includes(screen)){root.classList.remove('wp-v2-screen');return false;}
 window.NEW_UI?.refresh?.();
 if(screen===CUSTOM){historySource=null;generating=false;renderCustom(root);return true;}
 if(screen===RESULT){historySource=null;const draft=store.photos[store.draft];if(!draft?.generated){renderCustom(root);return true;}selectResource(draft);renderPreview(root,draft);return true;}
 let resource=resourceCurrent();if(screen===DETAIL&&!store.records[resource.id]){const body=shell(root,'壁纸记录',{backTo:'works'});body.innerHTML='<p class="wp-v2-empty-gray">暂无这张壁纸的成功设置记录</p>';return true;}
 historySource=screen===DETAIL?resource.id:null;selectResource(resource);renderPreview(root,resource,{history:screen===DETAIL});return true;
}
function nativeLayers(key){return (window.UI_DATA?.layers?.[key]||[]).filter(layer=>layer.visible);}
function nativeNode(root,id){return root.querySelector('[id="'+id+'"]');}
function hideNative(root,layer){const element=layer&&nativeNode(root,layer.id);if(element)element.style.visibility='hidden';}
function installWorksTabs(screen,root){
 root.querySelector('.wp-v2-work-tabs')?.remove();root.querySelector('.wp-v2-record-list')?.remove();
 const data=nativeLayers(screen),title=data.find(layer=>layer.type==='text'&&['我的创作','My Creations'].includes(layer.text)),count=data.find(layer=>layer.type==='text'&&/^(共\d+个作品|Creations:)/.test(layer.text||''));
 if(count)hideNative(root,count);
 if(title&&typeof setText==='function')setText(root,title,worksTab==='wallpapers'?'壁纸记录':'我的创作');
 const tabs=document.createElement('div');tabs.className='wp-v2-work-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','作品类型');tabs.innerHTML=`<button type="button" role="tab" data-wp-v2-tab="creations" aria-selected="${worksTab==='creations'}" ${H('我的创作','查看原有图片和视频作品，保留原有删除、预览及广告布局。')}>我的创作</button><button type="button" role="tab" data-wp-v2-tab="wallpapers" aria-selected="${worksTab==='wallpapers'}" ${H('壁纸记录','查看本机已经确认设置成功的壁纸。按同一壁纸的静态与动态模式分别保存再次使用资格。')}>壁纸记录</button>`;root.appendChild(tabs);
 tabs.onclick=event=>{const button=event.target.closest('[data-wp-v2-tab]');if(!button)return;worksTab=button.dataset.wpV2Tab;redraw();};
 if(worksTab!=='wallpapers')return;
 const bannerLayers=data.filter(layer=>layer.type==='group'&&layer.w>=300&&layer.w<=345&&layer.h>=40&&layer.h<=75&&layer.y>600),banner=bannerLayers.map(layer=>layer.y);
 const bannerNodes=bannerLayers.map(layer=>nativeNode(root,layer.id)).filter(Boolean);
 const partOfBanner=element=>bannerNodes.some(bannerNode=>bannerNode===element||bannerNode.contains(element)||element.contains(bannerNode));
 const navTop=parseFloat(root.querySelector('.new-nav')?.style.top)||731;
 const bannerOn=typeof adAllowed!=='function'||adAllowed('作品下方横幅广告');const bottom=Math.min(navTop,bannerOn&&banner.length?Math.min(...banner)-5:navTop);
 // 原创作卡片从 Banner 后方一直延伸到导航栏；隐藏整个内容区，只保留 Banner 的节点与祖先。
 for(const layer of data)if(layer.y>=120&&layer.y<navTop){const element=nativeNode(root,layer.id);if(element&&!partOfBanner(element))hideNative(root,layer);}
 for(const button of root.querySelectorAll(':scope>.hotspot')){const top=parseFloat(button.style.top);if(top>=120&&top<navTop&&button.dataset.action!=='关闭横幅广告')button.style.visibility='hidden';}
 const list=document.createElement('section');list.className='wp-v2-record-list';list.setAttribute('aria-label','已使用壁纸记录');list.style.bottom=(812-bottom)+'px';
 const rows=records();list.innerHTML=rows.length?rows.map(row=>`<button type="button" class="wp-v2-record-card" data-wp-v2-record="${E(row.id)}" ${H(row.title,'点击查看已成功设置的壁纸并再次设置。静态模式无广告；已成功使用的动态效果再设仅普通用户一次插页，VIP无插页。')}><div class="wp-v2-record-visual"><small>${E(modeName(row.type))}</small></div><strong>${E(row.title)}</strong><time>${E(timeLabel(row.lastAt))}</time></button>`).join(''):'<div class="wp-v2-record-empty"><strong>还没有壁纸记录</strong><p>设置成功的壁纸会出现在这里</p><button type="button" data-wp-v2="browse">去看看壁纸</button></div>';
 root.appendChild(list);for(const card of list.querySelectorAll('[data-wp-v2-record]')){const row=store.records[card.dataset.wpV2Record];fillVisual(card.querySelector('.wp-v2-record-visual'),row);}
 list.onclick=event=>{if(event.target.closest('[data-wp-v2=browse]')){navigate('new-wallpaper');return;}const card=event.target.closest('[data-wp-v2-record]');if(card){selectResource(store.records[card.dataset.wpV2Record]);navigate(DETAIL);}};
}
function enhance(screen,root){if(['works','empty'].includes(screen))installWorksTabs(screen,root);}
function enhanceSystemPreview(body){
 const target=body.querySelector('.wp-system-preview');if(!target)return;const resource=resourceCurrent(),mode=normalizeMode(context().wallpaperMode);target.classList.add('wp-v2-system-visual');fillVisual(target,{...resource,type:mode},{parallax:mode==='motion',staticImage:mode==='static'});
}
function reset(){closeModeChoice(false);generationToken++;generating=false;photoBusy=false;worksTab='creations';selected=null;historySource=null;store={version:2,records:{},photos:{},draft:null};save();}
window.WALLPAPER_V2={get activeWorksTab(){return worksTab;},render:renderScreen,enhance,beforePrepare,recordSuccess,canReuse,allowBypass:(id,mode)=>historySource===String(id)&&canReuse(id,mode),selectResource,chooseMode,enhanceSystemPreview,reset,get records(){return clone(records());},get draft(){return store.draft?clone(store.photos[store.draft]||null):null;},currentResource:()=>clone(resourceCurrent())};
try{titles[CUSTOM]='照片生成3D壁纸';titles[RESULT]='照片生成3D · 效果预览';titles[DETAIL]='壁纸记录 · 详情';const entry=document.querySelector('#screen-list [data-key="'+CUSTOM+'"]');if(entry)entry.textContent='照片生成3D壁纸';}catch{}
const resetButton=document.querySelector('#reset'),oldReset=resetButton?.onclick;if(resetButton)resetButton.onclick=()=>{reset();oldReset?.();};
window.addEventListener('beforeunload',()=>{for(const url of objectURLs.values())URL.revokeObjectURL(url);});
})();
