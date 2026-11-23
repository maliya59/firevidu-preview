/* 公开分享版：保留浏览与右键说明，读取导出的壁纸快照，不连接本机写入接口。 */
(()=>{'use strict';
const base=new URL('./',document.currentScript.src),original=window.fetch.bind(window);
window.SHARE_PREVIEW=Object.freeze({readOnly:true});
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
window.fetch=async(input,options={})=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return original(input,options);
 const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(method==='GET'&&url.pathname==='/api/wallpapers')return original(new URL('share-data/wallpapers.json',base),{cache:'no-store'});
 if(method==='GET'&&url.pathname==='/api/health')return new Response(JSON.stringify({ok:true,service:'FireVidu share preview'}),{headers:{'Content-Type':'application/json'}});
 return new Response(JSON.stringify({error:'分享预览不保存修改，请在本地原型中操作。'}),{status:403,headers:{'Content-Type':'application/json'}});
};
document.addEventListener('DOMContentLoaded',()=>{
 new MutationObserver(()=>updateImageNotice()).observe(document.querySelector('#screen')||document.body,{childList:true,subtree:true});
 const tag=document.querySelector('.local-tag');if(tag)tag.textContent='分享预览 V2.6.1';
 document.querySelectorAll('.version-link').forEach(link=>link.remove());
 const link=document.createElement('a');link.href=new URL('文档/index.html',base).href;link.textContent='完整文档';link.className='version-link';link.target='_blank';link.rel='noopener';document.querySelector('.tool-right')?.prepend(link);
});
})();
