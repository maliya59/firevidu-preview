/* 本地演示的资源标记；VIP访问权限与精选排序相互独立。 */
(()=>{'use strict';
const KEY='firevidu-resource-flags-v1';
const defaults={template:{'1':{vip:true},'12':{vip:true}},wallpaper:{'official-0':{vip:true}}};
let values={template:{},wallpaper:{}};
function read(){try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&typeof saved==='object')for(const kind of ['template','wallpaper'])if(saved[kind]&&typeof saved[kind]==='object'&&!Array.isArray(saved[kind]))values[kind]=saved[kind];}catch{}}
read();
const kindKey=kind=>kind==='wallpaper'?'wallpaper':'template';
function get(kind,id,field,fallback=false){const key=kindKey(kind),row=values[key]?.[String(id)],def=defaults[key]?.[String(id)];if(typeof row==='boolean')return field==='vip'?row:Boolean(fallback);return typeof row?.[field]==='boolean'?row[field]:typeof def?.[field]==='boolean'?def[field]:Boolean(fallback);}
function setField(kind,id,field,value){if(id===null||id===undefined||String(id)==='')return false;const key=kindKey(kind),resourceId=String(id),old=values[key][resourceId];values[key][resourceId]={...(old&&typeof old==='object'?old:typeof old==='boolean'?{vip:old}:{}),[field]:Boolean(value)};let saved=true;try{localStorage.setItem(KEY,JSON.stringify(values));}catch{saved=false;}window.dispatchEvent(new CustomEvent('vip-flags-change',{detail:{kind:key,id:resourceId,field,value:Boolean(value)}}));return saved;}
function filterTemplates(rows,selection=''){
 if(!Array.isArray(rows))return [];
 if(selection!=='是'&&selection!=='否')return rows;
 const expected=selection==='是';
 return rows.filter(row=>get('template',row.id,'vip',Boolean(row.vip))===expected);
}
const templateBadgeObservers=new WeakMap();
function decorateTemplateBadges(content){
 for(const group of content.querySelectorAll('.admin-template [data-resource-flags]')){
  group.classList.add('template-row-flags');
  group.querySelector('[data-resource-flag="vip"]')?.classList.add('template-row-inline-vip');
 }
}
function enhanceTemplateFilters(content,filters={}){
 const toolbar=content?.querySelector('.admin-filters');if(!toolbar)return;
 let field=toolbar.querySelector('[data-template-vip-filter]');
 if(!field){
  field=document.createElement('label');field.className='admin-field admin-template-vip-filter';field.setAttribute('data-template-vip-filter','');
  field.setAttribute('data-help-title','是否VIP');field.setAttribute('data-help','筛选模板是否VIP专享，与模板名称、分类、是否精选、上架状态及输出形式共同生效。VIP与精选可以同时开启。');
  field.innerHTML='是否VIP<select aria-label="是否VIP" data-filter="vip" data-help-title="是否VIP" data-help="全部不限制VIP；是仅显示VIP专享模板；否仅显示普通模板。与其他条件组合筛选。"><option value="">全部</option><option value="是">是</option><option value="否">否</option></select>';
  const featured=toolbar.querySelector('[data-filter="featured"]')?.closest('.admin-field');
  toolbar.insertBefore(field,featured?.nextSibling||toolbar.querySelector('[data-admin-action="search"]'));
 }
 field.querySelector('select').value=['是','否'].includes(filters.vip)?filters.vip:'';
 decorateTemplateBadges(content);
 if(!templateBadgeObservers.has(content)&&typeof MutationObserver==='function'){
  const observer=new MutationObserver(()=>decorateTemplateBadges(content));observer.observe(content,{childList:true,subtree:true});templateBadgeObservers.set(content,observer);
 }
}
window.addEventListener('storage',event=>{if(event.key===KEY){values={template:{},wallpaper:{}};read();window.dispatchEvent(new CustomEvent('vip-flags-change',{detail:{external:true}}));}});
window.VIP_FLAGS={
 isVip:(kind,id,fallback=false)=>get(kind,id,'vip',fallback),
 set:(kind,id,value)=>setField(kind,id,'vip',value),
 isFeatured:(kind,id,fallback=false)=>get(kind,id,'featured',fallback),
 setFeatured:(kind,id,value)=>setField(kind,id,'featured',value),
 setFlags(kind,id,flags){let saved=true;if(typeof flags?.vip==='boolean')saved=setField(kind,id,'vip',flags.vip)&&saved;if(typeof flags?.featured==='boolean')saved=setField(kind,id,'featured',flags.featured)&&saved;return saved;},
 filterTemplates,enhanceTemplateFilters,
 snapshot(){return JSON.parse(JSON.stringify(values));}
};
})();
