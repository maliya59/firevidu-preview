/* 公开分享版：保留浏览与右键说明，读取导出的壁纸快照；选择文件、创建和编辑只在当前浏览器会话演示。 */
(()=>{'use strict';
const base=new URL('./',document.currentScript.src),original=window.fetch.bind(window);
window.SHARE_PREVIEW=Object.freeze({readOnly:true,sessionOnly:true});
// A transient CDN/network failure should not leave an otherwise valid cover blank.
const imageAttempts=new WeakMap(),failedImages=new Set();let imageNotice=null;
function imageSource(element){return element?.tagName?.toLowerCase()==='img'?'src':element?.tagName?.toLowerCase()==='image'?(element.hasAttribute('href')?'href':'xlink:href'):null;}
function updateImageNotice(){
 for(const image of failedImages)if(!image.isConnected)failedImages.delete(image);
 if(!failedImages.size){imageNotice?.remove();imageNotice=null;return;}
 if(imageNotice||!document.body)return;
 imageNotice=document.createElement('button');imageNotice.type='button';imageNotice.className='share-image-retry';imageNotice.textContent='有图片未加载，点击重试';imageNotice.setAttribute('aria-label','重新加载未显示的图片');
 imageNotice.style.cssText='position:fixed;right:20px;bottom:18px;z-index:100000;padding:10px 16px;border:1px solid #aaa;border-radius:6px;background:#fff;color:#333;font:14px sans-serif;box-shadow:0 2px 10px #0002;cursor:pointer';
 imageNotice.onclick=()=>{for(const image of [...failedImages]){failedImages.delete(image);const attempt=imageAttempts.get(image);if(attempt){attempt.count=0;retryImage(image,attempt);}}updateImageNotice();};document.body.appendChild(imageNotice);
}
function retryImage(image,attempt){
 if(!image.isConnected||image.getAttribute(attempt.attribute)!==attempt.current)return;
 const url=new URL(attempt.source,base);url.searchParams.set('image-retry',String(++attempt.count)+'-'+Date.now());attempt.current=url.href;
 if(attempt.attribute==='xlink:href')image.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',attempt.current);else image.setAttribute(attempt.attribute,attempt.current);
}
document.addEventListener('error',event=>{
 const image=event.target,attribute=imageSource(image);if(!attribute)return;
 const source=image.getAttribute(attribute);if(!source)return;const url=new URL(source,location.href);
 if(url.origin!==base.origin||!['assets/','uploads/'].some(folder=>url.pathname.startsWith(base.pathname+folder)))return;
 let attempt=imageAttempts.get(image);if(!attempt||attempt.current!==source){attempt={source,current:source,attribute,count:0};imageAttempts.set(image,attempt);}
 if(attempt.count<2)setTimeout(()=>retryImage(image,attempt),attempt.count?2500:800);else{failedImages.add(image);updateImageNotice();}
},true);
document.addEventListener('load',event=>{if(imageSource(event.target)){failedImages.delete(event.target);imageAttempts.delete(event.target);updateImageNotice();}},true);
window.addEventListener('online',()=>imageNotice?.click());
const previewUploads=new Set();let previewItems=null,previewLoad=null,previewSequence=0;
const previewReply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const previewClone=value=>JSON.parse(JSON.stringify(value));
async function loadPreviewItems(){
 if(previewItems)return previewItems;
 if(!previewLoad)previewLoad=(async()=>{const response=await original(new URL('share-data/wallpapers.json',base),{cache:'no-store'});if(!response.ok)throw Error('壁纸快照未能加载，请重试');const value=await response.json();if(!Array.isArray(value.items))throw Error('壁纸快照格式不正确');previewItems=previewClone(value.items);return previewItems;})();
 try{return await previewLoad;}finally{previewLoad=null;}
}
function allowedPreviewMedia(value){if(!value)return true;if(previewUploads.has(value))return true;try{const url=new URL(value,base);return url.origin===base.origin&&['assets/','uploads/'].some(folder=>url.pathname.startsWith(base.pathname+folder));}catch{return false;}}
window.fetch=async(input,options={})=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return original(input,options);
 const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(method==='GET'&&url.pathname==='/api/health')return previewReply({ok:true,service:'FireVidu share preview'});
 if(method==='POST'&&url.pathname==='/api/uploads'){
  const file=options.body||(input instanceof Request?await input.clone().blob():null);
  if(!(file instanceof Blob)||!file.type.match(/^(image|video)\//))return previewReply({error:'请选择图片或视频文件'},415);
  if(file.size>100*1024*1024)return previewReply({error:'文件不能超过100MB'},413);
  const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined)),name=decodeURIComponent(headers.get('X-File-Name')||file.name||'本地文件'),media=URL.createObjectURL(file);previewUploads.add(media);
  return previewReply({url:media,fileName:name,mimeType:file.type,size:file.size},201);
 }
 if(method==='GET'&&url.pathname==='/api/wallpapers')try{return previewReply({items:previewClone(await loadPreviewItems())});}catch(error){return previewReply({error:error.message},503);}
 if(method==='POST'&&['/api/wallpapers','/api/wallpapers/delete'].includes(url.pathname)){
  let body;try{body=JSON.parse(options.body||(input instanceof Request?await input.clone().text():'{}'));}catch{return previewReply({error:'操作数据格式不正确'},400);}
  let items;try{items=await loadPreviewItems();}catch(error){return previewReply({error:error.message},503);}
  if(url.pathname.endsWith('/delete')){if(typeof body.id!=='string'||!body.id)return previewReply({error:'壁纸编号无效'},400);const index=items.findIndex(x=>x.id===body.id),deleted={...(items[index]||{id:body.id}),state:'已删除',deletedAt:Date.now()};if(index<0)items.unshift(deleted);else items[index]=deleted;return previewReply({deletedId:body.id,items:previewClone(items)});}
  const item=body.item;if(!item||typeof item.name!=='string'||!item.name.trim()||item.name.length>200)return previewReply({error:'请填写壁纸名称，最长200字'},400);
  if(!['静态','视频','体感'].includes(item.type)||!['草稿','已上架','已下架'].includes(item.state))return previewReply({error:'壁纸类型或状态不正确'},400);
  if(['url','posterUrl','previewUrl'].some(key=>!allowedPreviewMedia(item[key])))return previewReply({error:'请选择当前浏览器中的文件或现有预览素材'},400);
  const previous=items.find(x=>x.id===item.id);if(previous?.state==='已删除')return previewReply({error:'这条壁纸已删除，请返回列表'},410);
  const saved={...previewClone(item),id:item.id||'preview-wallpaper-'+Date.now()+'-'+(++previewSequence),name:item.name.trim(),createdAt:previous?.createdAt||Date.now(),updatedAt:Date.now()};if(previous)items[items.indexOf(previous)]=saved;else items.unshift(saved);
  return previewReply({item:previewClone(saved),items:previewClone(items)});
 }
 return previewReply({error:'此接口不在分享版演示范围内，不会向服务器保存修改。'},403);
};
window.addEventListener('pagehide',event=>{if(!event.persisted)for(const url of previewUploads)URL.revokeObjectURL(url);});
document.addEventListener('DOMContentLoaded',()=>{
 new MutationObserver(()=>updateImageNotice()).observe(document.querySelector('#screen')||document.body,{childList:true,subtree:true});
 const tag=document.querySelector('.local-tag');if(tag)tag.textContent='分享预览 V2.6.1';
 document.querySelectorAll('.version-link').forEach(link=>link.remove());
 const link=document.createElement('a');link.href=new URL('文档/index.html',base).href;link.textContent='完整文档';link.className='version-link';link.target='_blank';link.rel='noopener';document.querySelector('.tool-right')?.prepend(link);
});
})();
