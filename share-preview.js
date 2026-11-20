/* 公开分享版：保留浏览与右键说明，读取导出的壁纸快照，不连接本机写入接口。 */
(()=>{'use strict';
const base=new URL('./',document.currentScript.src),original=window.fetch.bind(window);
window.SHARE_PREVIEW=Object.freeze({readOnly:true});
window.fetch=async(input,options={})=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return original(input,options);
 const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(method==='GET'&&url.pathname==='/api/wallpapers')return original(new URL('share-data/wallpapers.json',base),{cache:'no-store'});
 if(method==='GET'&&url.pathname==='/api/health')return new Response(JSON.stringify({ok:true,service:'FireVidu share preview'}),{headers:{'Content-Type':'application/json'}});
 return new Response(JSON.stringify({error:'分享预览不保存修改，请在本地原型中操作。'}),{status:403,headers:{'Content-Type':'application/json'}});
};
document.addEventListener('DOMContentLoaded',()=>{
 const tag=document.querySelector('.local-tag');if(tag)tag.textContent='分享预览 V2.6.1';
 document.querySelectorAll('.version-link').forEach(link=>link.remove());
 const link=document.createElement('a');link.href=new URL('文档/index.html',base).href;link.textContent='完整文档';link.className='version-link';link.target='_blank';link.rel='noopener';document.querySelector('.tool-right')?.prepend(link);
});
})();
