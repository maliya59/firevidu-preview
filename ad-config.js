/* 每个页面路径有独立开关；从旧18项按来源迁移，不再让细项共用布尔值。 */
(()=>{'use strict';
const STORAGE_KEY='firevidu-ad-placements-v2',LEGACY_KEY='firevidu-ad-config-v1';
const ROWS=window.AD_PLACEMENTS||[],AUDIENCES={regular:'普通广告配置',member:'会员广告配置'};
const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const settings={regular:{},member:{}};let old={},stored={},audience='regular',proof=null,previousFocus=null;
try{old=JSON.parse(localStorage.getItem(LEGACY_KEY)||'{}')||{};}catch{}
try{stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{};}catch{}
const regularOnly=new Set(['模板浏览返回插页广告','券包自愿领券激励广告','壁纸首页原生广告','壁纸首页底部横幅广告']);
const legacyFallback={'照片生成3D插页广告':'制作同款开始制作插页广告','壁纸记录动态再次设置插页广告':'制作同款开始制作插页广告'};
function locked(row,key){return Boolean(key==='member'&&(row.fixedMemberOff||regularOnly.has(row.legacy)));}
function defaultValue(row,key){if(key==='regular'||row.defaultMemberOn)return true;return row.type!=='横幅广告'&&row.type!=='插页广告'&&!row.fixedMemberOff&&!regularOnly.has(row.legacy);}
// This rule now includes members. Migrate this one member slot once; subsequent
// explicit changes remain independent of the image-creation and other ad slots.
const photo3dPolicyVersion=1,migratePhoto3d=stored.photo3dPolicyVersion!==photo3dPolicyVersion;
for(const key of Object.keys(AUDIENCES))for(const row of ROWS){const previous=old[key]?.[row.legacy]??old[key]?.[legacyFallback[row.legacy]];settings[key][row.id]=migratePhoto3d&&key==='member'&&row.id==='custom-generate-interstitial'?true:typeof stored[key]?.[row.id]==='boolean'?stored[key][row.id]:typeof previous==='boolean'?previous:defaultValue(row,key);}
function saveSettings(){localStorage.setItem(STORAGE_KEY,JSON.stringify({...settings,photo3dPolicyVersion}));}
if(migratePhoto3d)try{saveSettings();}catch{}
const byId=new Map(ROWS.map(row=>[row.id,row])),byName=new Map(ROWS.map(row=>[row.name,row]));
function route(context={}){const s=window.__DEMO__?.state||{};return {scene:context.scene||s.screen||'home',type:context.type||s.type||'image',worksTab:context.worksTab||window.WALLPAPER_V2?.activeWorksTab||'creations',returnSource:context.returnSource||'home'};}
function resolve(name,context={}){
 if(byId.has(name))return byId.get(name);if(byName.has(name))return byName.get(name);
 const {scene:k,type,worksTab,returnSource}=route(context);let id;
 switch(name){
 case '首页下方横幅广告':id=k==='search'?'search-banner':k==='no-search'?'empty-search-banner':'home-banner';break;
 case '模板详情下方横幅广告':id=k==='detail-video'?'video-detail-banner':'image-detail-banner';break;
 case '模板原生广告':id=k==='works'?'works-native':'home-native';break;
 case '制作完成下方横幅广告':id=k==='saved'?'saved-banner':k==='save-video'?'video-preview-banner':'complete-banner';break;
 case '作品下方横幅广告':id=k==='work-video'?'work-video-banner':k==='work-image'?'work-image-banner':k==='works'&&worksTab==='wallpapers'?'records-banner':'works-banner';break;
 case '个人中心下方横幅广告':id=k==='profile-in'?'profile-logged-banner':'profile-guest-banner';break;
 case '高清保存的激励广告':id=type==='video'?'video-hd':'image-hd';break;
 case '超清保存的激励广告':id=type==='video'?'video-uhd':'image-uhd';break;
 case '去水印的激励广告':id=type==='video'?'video-watermark':'image-watermark';break;
 case '模板浏览返回插页广告':id=returnSource==='search'?'browse-return-search':'browse-return-home';break;
 case '壁纸首页原生广告':id=k==='new-wallpaper-search'?'wallpaper-search-native':'wallpaper-home-native';break;
 case '壁纸首页底部横幅广告':id=k==='new-wallpaper-search'?'wallpaper-search-banner':'wallpaper-home-banner';break;
 default:return ROWS.find(row=>row.legacy===name)||null;
 }
 return byId.get(id)||null;
}
function isEnabled(name,targetAudience='regular',context={}){const key=targetAudience==='member'?'member':'regular',row=resolve(name,context);if(row)return !locked(row,key)&&settings[key][row.id]!==false;return typeof old[key]?.[name]==='boolean'?old[key][name]:true;}
function setEnabled(id,key,on){const row=byId.get(id);if(!row||!Object.hasOwn(AUDIENCES,key)||locked(row,key))return false;settings[key][id]=Boolean(on);let persisted=true;try{saveSettings();}catch{persisted=false;}if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('ad-config-change',{detail:{id,audience:key,enabled:Boolean(on)}}));return persisted;}

function meaning(row,key){if(key==='member'&&(row.fixedMemberOff||regularOnly.has(row.legacy)))return row.description+' 本场景对有效VIP固定免除此广告，会员组不适用，不能通过这里改成收费。';return row.description+(row.type==='激励广告'?' 关闭仅免除此处广告，不扣券；不免其他独立解锁。':' 关闭仅隐藏此位置，不关闭功能。')+' 当前配置只影响'+(key==='member'?'会员':'普通用户')+'，不影响另一组。';}
const help=(title,body)=>`data-help-title="${E(title)}" data-help="${E(body)}" data-help-status="本地原型"`;
function render(root,selectedAudience){
 if(!root)return false;if(Object.hasOwn(AUDIENCES,selectedAudience))audience=selectedAudience;
 root.classList.remove('admin-new','admin-wallpaper-creation','wallpaper-editor');root.classList.add('ad-config');root.oninput=null;root.onchange=null;root.ondragover=null;root.ondrop=null;
 const who=audience==='member'?'会员':'普通用户';
 root.innerHTML=`<div class="admin-wide-row ad-config-heading"><h2>广告配置</h2><span class="admin-muted">${ROWS.length} 个广告场景</span></div><div class="ad-config-tabs" role="tablist" aria-label="广告用户分组">${Object.entries(AUDIENCES).map(([key,label])=>`<button type="button" role="tab" id="ad-config-tab-${key}" aria-selected="${audience===key}" aria-controls="ad-config-panel" data-ad-audience="${key}" class="${audience===key?'active':''}">${label}</button>`).join('')}</div><p class="ad-config-note">按页面路径分别配置，右键广告名称查看红框位置截图与触发流程。当前为${who}组，普通用户与会员分别配置。</p><section id="ad-config-panel" role="tabpanel" aria-labelledby="ad-config-tab-${audience}"><table class="admin-table ad-config-table" aria-label="${AUDIENCES[audience]}"><colgroup><col style="width:65%"><col style="width:17%"><col style="width:18%"></colgroup><thead><tr><th>广告位名称</th><th>广告类型</th><th>开关</th></tr></thead><tbody>${ROWS.map(row=>{const on=isEnabled(row.id,audience),disabled=locked(row,audience);return `<tr data-ad-placement="${E(row.id)}"><td><button type="button" class="ad-placement-name" data-ad-proof="${E(row.id)}" aria-haspopup="dialog" ${help(row.name,meaning(row,audience))}>${E(row.name)}</button></td><td>${E(row.type)}</td><td><div class="ad-config-control"><button type="button" role="switch" aria-checked="${on}" aria-label="${who} · ${E(row.name)}" data-ad-toggle="${E(row.id)}" class="ad-config-switch ${on?'on':''}" ${disabled?'disabled':''} ${help(who+' · '+row.name,meaning(row,audience))}></button><span class="ad-config-state">${disabled?'不适用':on?'开启':'关闭'}</span></div></td></tr>`;}).join('')}</tbody></table></section><div class="ad-config-status" role="status" aria-live="polite"></div>`;
 root.onclick=event=>{const tab=event.target.closest('[data-ad-audience]');if(tab){audience=tab.dataset.adAudience;render(root);root.querySelector(`[data-ad-audience="${audience}"]`)?.focus();return;}const view=event.target.closest('[data-ad-proof]');if(view){openProof(view.dataset.adProof);return;}const button=event.target.closest('[data-ad-toggle]');if(!button)return;const row=byId.get(button.dataset.adToggle);if(!row||locked(row,audience))return;const next=!isEnabled(row.id,audience),stored=setEnabled(row.id,audience,next);button.classList.toggle('on',next);button.setAttribute('aria-checked',String(next));button.nextElementSibling.textContent=next?'开启':'关闭';const out=root.querySelector('.ad-config-status');if(out){out.textContent=stored?'已保存'+who+'的此项配置。':'本次配置已修改，浏览器未能持久保存。';out.dataset.state=stored?'success':'warning';}};return true;
}
function closeZoom(){proof?.querySelector('.ad-proof-zoom')?.remove();proof?.querySelector('[data-ad-close]')?.focus();}
function closeProof(){if(!proof)return;proof.remove();proof=null;previousFocus?.focus?.({preventScroll:true});previousFocus=null;}
function proofPicture(row,index,zoom=false){
 const scene=row.proof[index],size=row.proofSizes[index],ratio=size.width/size.height,rects=row.proofRects[index]||[];
 return `<span class="ad-proof-picture${zoom?' ad-proof-zoom-frame':''}" style="--ad-proof-ratio:${ratio}" data-ad-proof-frame="${index}"><img src="assets/ad-placement-guides/${E(scene)}.jpg" alt="${E(row.name+(zoom?' · 放大截图':' · 位置截图'))}" loading="eager">${rects.map(rect=>`<span class="ad-proof-rect" role="img" aria-label="红框：${E(rect.label)}位置" style="left:${rect.x}%;top:${rect.y}%;width:${rect.w}%;height:${rect.h}%"></span>`).join('')}</span>`;
}
function openProof(id){
 const row=byId.get(id);if(!row)return;closeProof();previousFocus=document.activeElement;proof=document.createElement('div');proof.className='ad-proof-mask';proof.setAttribute('role','dialog');proof.setAttribute('aria-modal','true');proof.setAttribute('aria-labelledby','ad-proof-title');
 const flow=row.proof.length>1,steps=row.proof.map((scene,index)=>{const title=flow?(index===0?'触发前页面':index===row.proof.length-1?'完成后的页面':row.type):'广告位所在页面';return `${index?`<span class="ad-proof-arrow${row.proofActions?.[index-1]?' with-action':''}">${row.proofActions?.[index-1]?`<small class="ad-proof-action">${E(row.proofActions[index-1])}</small>`:''}<span aria-hidden="true">→</span></span>`:''}<figure><figcaption>${E(title)}</figcaption><button type="button" class="ad-proof-image" data-ad-zoom="${index}" aria-label="放大${E(title)}">${proofPicture(row,index)}</button></figure>`;}).join('');
 proof.innerHTML=`<section class="ad-proof-dialog"><header><div><h2 id="ad-proof-title">${E(row.name)}</h2><p>${E(row.type)} · 流程说明</p></div><button type="button" data-ad-close aria-label="关闭广告位置截图">×</button></header><p class="ad-proof-rule">${E(meaning(row,audience))}</p><div class="ad-proof-steps${flow?' is-flow':''}">${steps}</div><p class="ad-proof-foot">红框标出本次广告位置，点击图片可放大查看。${row.type==='激励广告'?'中间图代表每一条激励广告，实际所需次数及是否可用券抵扣以上方本位置规则为准。':''}</p></section>`;
 document.body.append(proof);proof.onclick=event=>{if(event.target===proof||event.target.closest('[data-ad-close]')){closeProof();return;}if(event.target.closest('[data-ad-zoom-close]')){closeZoom();return;}const button=event.target.closest('[data-ad-zoom]');if(button){const index=Number(button.dataset.adZoom),zoom=document.createElement('div');zoom.className='ad-proof-zoom';zoom.innerHTML=`<button type="button" data-ad-zoom-close aria-label="关闭放大图片">×</button>${proofPicture(row,index,true)}`;proof.append(zoom);zoom.querySelector('button').focus();}};proof.querySelector('[data-ad-close]').focus();
}
document.addEventListener('contextmenu',event=>{const target=event.target.closest('[data-ad-proof]');if(!target)return;event.preventDefault();event.stopImmediatePropagation();openProof(target.dataset.adProof);},true);
document.addEventListener('keydown',event=>{if(!proof)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(proof.querySelector('.ad-proof-zoom'))closeZoom();else closeProof();return;}if(event.key==='Tab'){const area=proof.querySelector('.ad-proof-zoom')||proof;const buttons=[...area.querySelectorAll('button')].filter(el=>!el.disabled&&el.getClientRects().length);const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}},true);
window.AD_CONFIG={render,isEnabled,resolve,setEnabled,openProof,closeProof,get placements(){return ROWS;},get settings(){return JSON.parse(JSON.stringify(settings));}};
})();
