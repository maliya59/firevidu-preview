/* App 资源封面四角标记。展示层不改变排序、权限、费用或资源元数据。 */
(()=>{'use strict';
const WEEK=7*86400000;
const typeLabel=type=>({image:'图片',static:'图片','静态':'图片',video:'视频','视频':'视频',motion:'3D','3d':'3D','3D':'3D','体感':'3D'}[type]||'');
function isNew(publishedAt,now=Date.now()){
 return typeof publishedAt==='number'&&Number.isFinite(publishedAt)&&publishedAt>0&&Number.isFinite(now)&&publishedAt<=now&&publishedAt>=now-WEEK;
}
function descriptors(resource={},options={}){
 const result=[];
 if(resource.featured===true)result.push({kind:'featured',label:'精选',corner:'top-left'});
 if(isNew(resource.publishedAt,options.now??Date.now()))result.push({kind:'new',label:'新增',corner:'top-right'});
 if(resource.vip===true)result.push({kind:'vip',label:'VIP',corner:'bottom-left'});
 const label=typeLabel(resource.type);if(label)result.push({kind:'type',label,corner:'bottom-right'});
 return result;
}
function render(host,resource={},options={}){
 if(!host)return null;
 for(const child of [...host.children])if(child.classList.contains('resource-badges'))child.remove();
 host.classList.add('resource-badge-host');host.dataset.resourceId=String(resource.id??'');
 const badges=descriptors(resource,options),layer=document.createElement('div');layer.className='resource-badges';layer.setAttribute('aria-hidden','true');
 host.dataset.resourceNew=String(badges.some(item=>item.kind==='new'));host.dataset.resourceFeatured=String(resource.featured===true);host.dataset.resourceVip=String(resource.vip===true);host.dataset.resourceType=typeLabel(resource.type);
 for(const item of badges){const badge=document.createElement('span');badge.className='resource-badge resource-badge-'+item.kind;badge.dataset.badge=item.kind;badge.dataset.corner=item.corner;badge.textContent=item.label;layer.appendChild(badge);}
 host.appendChild(layer);return layer;
}
window.RESOURCE_BADGES={isNew,typeLabel,descriptors,render};
})();
