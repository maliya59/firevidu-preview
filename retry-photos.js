/* 免费反馈重试的选图控件：只替换本机照片，不改变模板或VIP体验资格。 */
(()=>{'use strict';
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const H=(title,description)=>`data-help-title="${E(title)}" data-help="${E(description)}" data-help-status="已确认"`;
const seedIds={image:['','l30DBF6029288482CA3E887388E0035CB'],video:['lB1B9A67AAFC74FFFB380F15C331BBFAC','l76B416111344413FAC348135E2917CA2','l6A781A3C15AE40FFAF7CCF75BC68C0CA','lA83A05FB487947219768C9DBED14D4C1']};
let session=null,view=null,submitted=null;
const urls=new Set();
const retry=()=>window.NEW_UI?.preparedRetry;
const same=(a,b)=>Boolean(a&&b&&a.id===b.id&&a.templateId===b.templateId&&a.type===b.type&&a.attemptId===b.attemptId);
function release(photo){if(photo?.local&&urls.has(photo.src)){URL.revokeObjectURL(photo.src);urls.delete(photo.src);}}
function reset(){for(const url of urls)URL.revokeObjectURL(url);urls.clear();session=null;view=null;submitted=null;}
function nativePhoto(root,id,index){const image=id?root.querySelector('[id="'+id+'"] image'):null;return {src:image?.getAttribute('href')||image?.getAttribute('xlink:href')||'',name:'原照片'+(index+1),local:false};}
function ensure(root,current){
 const key=current.type+':'+current.templateId;
 if(!session||session.key!==key){reset();session={key,type:current.type,templateId:current.templateId,photos:seedIds[current.type].map((id,index)=>nativePhoto(root,id,index))};}
 return session;
}
function updateCount(){if(session&&typeof state!=='undefined'){state.uploaded=session.photos.length;if(typeof persist==='function')persist();}}
function isCurrent(v){return Boolean(v&&view===v&&v.input.isConnected&&same(retry(),v.retry)&&window.NEW_UI?.hasPreparedRetry());}
function busy(v,on){v.loading=on;if(!isCurrent(v))return;const start=v.root.querySelector('[data-action="开始制作"]');if(start){start.disabled=on;start.setAttribute('aria-busy',String(on));}}
function message(v,text){if(!isCurrent(v))return;v.error.textContent=text;v.error.hidden=!text;}
function choose(v,index){
 if(!isCurrent(v)||v.loading)return;
 if(index===null&&session.photos.length>=9){message(v,'最多选择9张照片');return;}
 v.replace=index;v.input.multiple=session.type==='video'&&index===null;v.input.value='';v.input.click();
}
async function readPhoto(file){
 if(!/^(image\/(jpeg|png|webp))$/i.test(file.type)&&!(file.type===''&&/\.(jpe?g|png|webp)$/i.test(file.name)))throw new Error('请选择JPG、PNG或WebP照片');
 const src=URL.createObjectURL(file);urls.add(src);
 try{const img=new Image();img.src=src;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw new Error('照片无法读取');return {src,name:file.name,size:file.size,mime:file.type,local:true};}
 catch{release({src,local:true});throw new Error('照片无法读取，请重新选择JPG、PNG或WebP照片');}
}
async function selectedFiles(v){
 const files=[...(v.input.files||[])];if(!files.length||!isCurrent(v))return;
 const index=v.replace,target=session,capacity=index===null?9-target.photos.length:1;
 if(files.length>capacity){message(v,index===null?'最多选择9张照片，请减少本次选择数量':'每个位置请选择1张照片');v.input.value='';return;}
 busy(v,true);message(v,'');const photos=[];
 try{
  for(const file of files)photos.push(await readPhoto(file));
  if(!isCurrent(v)||session!==target){for(const photo of photos)release(photo);return;}
  if(index===null)target.photos.push(...photos);else{release(target.photos[index]);target.photos[index]=photos[0];}
  updateCount();draw(v);if(typeof status==='function')status('照片已更新，模板不变；点击开始制作后才使用本次重试机会。');
 }catch(error){for(const photo of photos)release(photo);message(v,error.message||'照片无法读取，请重新选择');}
 finally{busy(v,false);v.input.value='';}
}
function draw(v){
 const photos=session.photos;
 if(session.type==='image'){
  v.panel.innerHTML=photos.map((photo,index)=>`<button type="button" class="retry-photo-slot" style="top:${index?565:462}px" data-retry-photo="${index}" aria-label="重新选择照片${index+1}" ${H('重新选择照片'+(index+1),'可保留或更换这张照片，模板不变；选图不扣重试次数，也不自动开始制作。')}>${photo.src?`<img src="${E(photo.src)}" alt="${E(photo.name)}">`:'<span aria-hidden="true">＋</span>'}</button>`).join('');
 }else{
  const top=v.panel.scrollTop;
  v.panel.innerHTML=photos.map((photo,index)=>`<div class="retry-video-photo"><button type="button" data-retry-photo="${index}" aria-label="重新选择照片${index+1}" ${H('更换照片'+(index+1),'更换本位置的照片，照片数量不增加；模板及原VIP体验资格不变。')}><img src="${E(photo.src)}" alt="${E(photo.name)}"></button><button type="button" class="retry-photo-remove" data-retry-remove="${index}" aria-label="移除照片${index+1}" ${H('移除照片','移除本次重试的这张照片，不扣重试次数。视频至少保留1张照片。')}>×</button></div>`).join('')+(photos.length<9?`<button type="button" class="retry-photo-add" data-retry-add aria-label="添加重试照片" ${H('添加照片','可以补选照片，视频最多9张；选图后仍需点击开始制作。')}>＋<small>添加照片</small></button>`:'');
  v.panel.scrollTop=top;
 }
 v.panel.onclick=event=>{event.stopPropagation();const remove=event.target.closest('[data-retry-remove]');if(remove){if(v.loading)return;release(photos[Number(remove.dataset.retryRemove)]);photos.splice(Number(remove.dataset.retryRemove),1);updateCount();draw(v);return;}const slot=event.target.closest('[data-retry-photo]');if(slot)choose(v,Number(slot.dataset.retryPhoto));else if(event.target.closest('[data-retry-add]'))choose(v,null);};
 if(session.type==='image')for(const [index,label] of ['上传图片1','上传图片2'].entries()){const row=v.root.querySelector('[data-action="'+label+'"]');if(row){row.onclick=event=>{event.stopPropagation();choose(v,index);};row.dataset.helpTitle='重新选择照片'+(index+1);row.dataset.help='可重新选择本机照片，模板不变；选图不扣次数，点击开始制作才使用重试机会。';}}
}
function enhance(screen,root){
 if(!window.NEW_UI?.hasPreparedRetry()||!['detail-image','detail-video'].includes(screen))return;
 const current=retry();ensure(root,current);
 root.querySelectorAll('.retry-photo-layer,.retry-photo-input,.retry-photo-error').forEach(el=>el.remove());
 const panel=document.createElement('section');panel.className='retry-photo-layer '+(current.type==='video'?'retry-video-photos':'retry-image-photos');panel.setAttribute('aria-label','重试照片');
 const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.className='retry-photo-input';input.setAttribute('aria-label','选择重试照片');
 const error=document.createElement('p');error.className='retry-photo-error';error.setAttribute('role','alert');error.hidden=true;
 if(current.type==='video')root.querySelectorAll('[data-action="编辑已选照片"],[data-action="上传图片"]').forEach(el=>el.remove());
 root.append(panel,input,error);view={root,panel,input,error,retry:current,loading:false,replace:null};const v=view;input.onchange=()=>selectedFiles(v);draw(v);busy(v,false);
}
function beforeStart(){
 if(!window.NEW_UI?.hasPreparedRetry()||!session)return true;
 if(view?.loading){if(typeof status==='function')status('正在读取照片，请稍候。');return false;}
 if(session.type==='video'&&!session.photos.length){message(view,'请至少选择1张照片');return false;}
 updateCount();submitted={templateId:session.templateId,type:session.type,photos:session.photos.map(photo=>({...photo}))};return true;
}
window.RETRY_PHOTOS={enhance,beforeStart,reset,get photos(){return session?.photos.map(photo=>({...photo}))||[];},get submitted(){return submitted?{...submitted,photos:submitted.photos.map(photo=>({...photo}))}:null;}};
window.addEventListener('beforeunload',reset);
})();
