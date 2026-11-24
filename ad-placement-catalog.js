/* 广告配置按实际页面路径细分。legacy用于迁移旧开关，不等于仍共用开关。 */
(()=>{'use strict';const rows=[];
function add(id,name,type,legacy,scene,description,proof,extra={}){rows.push({id,name,type,legacy,scene,description,proof,...extra});}
add('launch','启动应用－开屏广告','开屏广告','启动页开屏广告','splash','冷启动时展示；关闭后继续首页或语言选择。',['splash']);
add('resume','应用回前台－开屏广告','开屏广告','回前台开屏广告','home','返回桌面后，停留满3分钟再回来时展示1次开屏广告；关闭后返回离开前的页面。',['home','splash','home'],{proofActions:['返回桌面再回来','关闭广告，返回原页面']});
for(const [id,path,scene] of [['home','首页','home'],['search','首页－搜索结果','search'],['empty-search','首页－搜索无结果','no-search']])add(id+'-banner',path+'－底部横幅广告','横幅广告','首页下方横幅广告',scene,'固定显示在该页面下方，不阻断模板浏览。各搜索分支与首页分别配置。',[scene]);
add('home-native','首页－模板列表－原生广告','原生广告','模板原生广告','home','首页既有列表原生；和作品列表原生分别控制，不是新增壁纸原生。',['home']);
for(const [id,path,scene]of [['image','图片模板','detail-image'],['video','视频模板','detail-video']])add(id+'-detail-banner','首页－'+path+'详情－底部横幅广告','横幅广告','模板详情下方横幅广告',scene,'制作同款照片准备页的底部横幅；反馈免费重做只免制作前插页，不免本横幅。',[scene]);
add('creating-native','制作－正在制作－原生广告','原生广告','正在制作原生广告卡片','creating','制作进度页的原生卡，不要求观看完成才能获得制作结果。',['creating']);
add('creating-reward','制作－正在制作－解锁高清－激励广告','激励广告','正在制作激励广告','creating','用户主动解锁高清时观看1条；与该作品最终高清保存共享资格，不能重复收取。',['creating','rewarded','creating']);
for(const [id,path,scene]of [['complete','图片制作－制作完成','complete'],['video-preview','视频制作－保存预览','save-video'],['saved','视频保存－保存成功','saved']])add(id+'-banner',path+'－底部横幅广告','横幅广告','制作完成下方横幅广告',scene,'保留该页原横幅；没有本次曾拟议的O03原生替换。',[scene]);
add('image-create-interstitial','首页－图片模板－开始制作－插页广告','插页广告','制作同款开始制作插页广告','detail-image','普通用户开始图片制作前1次；会员按独立配置。反馈免费重做跳过，不抵高清或超清激励。',['detail-image','interstitial','creating']);
for(const [id,path,scene]of [['works','作品－我的创作列表','works'],['work-image','作品－图片详情','work-image'],['work-video','作品－视频详情','work-video'],['records','作品－壁纸记录','wallpaper-records']])add(id+'-banner',path+'－底部横幅广告','横幅广告','作品下方横幅广告',scene,'仅控制这个页面的底部横幅。壁纸记录继续保留原横幅，不新增O02替换原生。',[scene]);
add('works-native','作品－我的创作列表－原生广告','原生广告','模板原生广告','works','作品列表既有原生，与首页原生分别配置；壁纸记录不复用此原生。',['works']);
for(const [id,path,scene]of [['guest','未登录','profile'],['logged','已登录','profile-in']])add('profile-'+id+'-banner','我的－'+path+'个人中心－底部横幅广告','横幅广告','个人中心下方横幅广告',scene,'个人中心下方横幅，不改变登录、会员或邀请入口。',[scene]);
for(const [kind,path,before,after]of [['image','图片','save-image','complete'],['video','视频','confirm-video','saved']]){
 add(kind+'-hd','保存－'+path+'－高清保存－激励广告','激励广告','高清保存的激励广告',before,'未解锁高清时需1次正常激励，可主动用1张通用券抵；已有高清资格不重复观看。普通保存一直免费。',[before,'rewarded',after]);
 add(kind+'-uhd','保存－'+path+'－超清保存－激励广告','激励广告','超清保存的激励广告',before,'未解锁超清时需2次正常激励，可2张券抵或1券加1广告；下图中间代表每条激励，需按进度重复到2次。',[before,'rewarded',after]);
 add(kind+'-watermark','保存－'+path+'－去水印－激励广告','激励广告','去水印的激励广告',before,'主动去水印需1次激励；可用去水印专用券或通用券。与高清画质解锁分别判断。',[before,'rewarded',before]);
}
for(const [kind,path,before,after]of [['template','模板','vip-experience','creating'],['wallpaper','壁纸','vip-experience','new-wallpaper-unlock']])add('vip-'+kind+'-reward','VIP内容－'+path+'体验－额外激励广告','激励广告','VIP'+(kind==='template'?'模板':'壁纸')+'体验激励广告',before,(kind==='template'?'游客先在原模板详情底部登录，识别权益后，有效VIP直接继续；未开通VIP再显示开通VIP与看广告体验本次的选择弹窗。仅主动选择体验才播放，进度回同一弹窗；开通后可继续原模板。':'')+'非会员登录后体验VIP内容，额外2条激励，不能用券；模板和壁纸共享每日2次体验额度。有效VIP免。关闭此额外广告后按配置免费取得本次资格，日体验计次规则保留。',[before,'rewarded',after],{fixedMemberOff:true});
for(const [id,name,before,cost]of [['static','静态（含视频及3D转静态）','new-wallpaper-static',1],['video','视频动态','new-wallpaper-video',2],['motion','3D动态（含个人照片）','new-wallpaper-motion',2]])add('wallpaper-'+id+'-reward','壁纸－首次设置'+name+'－激励广告','激励广告',id==='static'?'壁纸静态首次设置激励广告':id==='video'?'视频壁纸动态首次设置激励广告':'3D壁纸动态首次设置激励广告',before,'首次正常设置需'+cost+'次激励，可主动用通用券抵；已有本次/历史资格不重复。三个设置目标共用同次资格，系统失败保留资格，取消按现有规则处理。',[before,'rewarded','new-wallpaper-system']);
add('custom-generate-interstitial','壁纸－个人照片－生成3D预览－插页广告','插页广告','照片生成3D插页广告','new-wallpaper-custom','点击生成3D后1次插页，再进入预览；不抵之后静态或动态设置的正常激励。',['new-wallpaper-custom','interstitial','new-wallpaper-custom-result'],{defaultMemberOn:true});
add('records-dynamic-interstitial','作品－壁纸记录－动态再次设置－插页广告','插页广告','壁纸记录动态再次设置插页广告','new-wallpaper-history-detail','已成功设置过动态的视频/3D再设动态，普通1次插页，VIP固定0；再设静态没有广告。不重复扣券或VIP体验次数。',['new-wallpaper-history-detail','interstitial','new-wallpaper-system'],{fixedMemberOff:true});
for(const [id,path,source]of [['home','首页','home'],['search','搜索结果','search']])add('browse-return-'+id,'模板浏览－返回'+path+'列表－插页广告','插页广告','模板浏览返回插页广告','detail-image','B01：同会话同模板只计一次，前台可见满10秒且未编辑/制作才算有效浏览。每3次形成1机会，日最多2次，距任意全屏结束120秒。广告未就绪即跳过，不回列表后补弹；两个返回来源共用日额度。',['detail-image','browse-return-ad',source],{returnSource:source});
add('coupon-reward','我的－我的券－主动看视频领当日券－激励广告','激励广告','券包自愿领券激励广告','new-coupons','B02：普通用户和会员均可主动看1条获得1张当日通用券；未登录先登录，印度次日00:00到期；每账号每天最多成功领取5次，每次1条激励换1张当日券；同一事务重复完成只发1张。失败或取消不发券、不占成功额度，等待60秒后可重试；成功不触发该冷却，不设总尝试次数上限。不抵VIP额外体验。',['new-coupons','rewarded','new-coupons']);
for(const [id,path,scene]of [['home','首页','new-wallpaper'],['search','搜索结果','new-wallpaper-search']]){
 add('wallpaper-'+id+'-native','壁纸－'+path+'－列表原生广告','原生广告','壁纸首页原生广告',scene,'O01：与壁纸卡片等大；前8个内容后1个，之后每6个后1个，位置8、14、20…；广告不占内容配额、不参与排序。同轮翻页延续序号，少于8个不显示。',[scene]);
 add('wallpaper-'+id+'-banner','壁纸－'+path+'－底部横幅广告','横幅广告','壁纸首页底部横幅广告',scene,'O04：和列表原生同时保留，开关独立。固定在导航上方或结果页底部，列表缩短避开横幅。一次访问同一实例，类型切换、搜索及详情返回不刷新；空结果也可展示。',[scene]);
}

// 同结构但文案不同的分支使用独立实图，避免高清/超清、静态/动态或奖励前后混用。
const proofVariants={
 'creating-reward':['creating','rewarded','creating-hd-after'],
 'image-uhd':['image-uhd-before','rewarded','complete'],
 'video-uhd':['video-uhd-before','rewarded','saved'],
 'image-watermark':['save-image','rewarded','image-watermark-after'],
 'video-watermark':['confirm-video','rewarded','video-watermark-after'],
 'vip-wallpaper-reward':['vip-wallpaper-experience','rewarded','vip-wallpaper-normal-unlock'],
 'wallpaper-static-reward':['new-wallpaper-static','rewarded','wallpaper-static-success'],
 'wallpaper-video-reward':['new-wallpaper-video','rewarded','wallpaper-video-success'],
 'wallpaper-motion-reward':['new-wallpaper-motion','rewarded','wallpaper-motion-success'],
 'records-dynamic-interstitial':['new-wallpaper-history-detail','interstitial','wallpaper-motion-success'],
 'coupon-reward':['new-coupons','rewarded','coupon-reward-after']
};
for(const row of rows)if(proofVariants[row.id])row.proof=proofVariants[row.id];
// 原图像素坐标已逐张核对；既有 SVG 横幅坐标与实图边界互证。
// 同一截图的不同广告位分别定义，不能用文件名推定框位。
const proofPixelRects={
 'launch':[0,0,278,479],
 'home-banner':[18,512,215,34],
 'search-banner':[20,501,237,37],
 'empty-search-banner':[21,550,238,38],
 'home-native':[132,309,112,149],
 'image-detail-banner':[20,501,237,37],
 'video-detail-banner':[19,506,225,35],
 'creating-native':[11,390,257,113],
 'complete-banner':[20,529,237,37],
 'video-preview-banner':[20,478,237,37],
 'saved-banner':[20,501,237,37],
 'works-banner':[20,502,237,37],
 'work-image-banner':[20,529,237,37],
 'work-video-banner':[20,529,237,37],
 'records-banner':[20,502,237,37],
 'works-native':[145,304,124,164],
 'profile-guest-banner':[20,502,237,37],
 'profile-logged-banner':[20,502,237,37],
 'wallpaper-home-native':[12,362,123,133],
 'wallpaper-home-banner':[21,509,238,37],
 'wallpaper-search-native':[12,334,123,133],
 'wallpaper-search-banner':[21,550,238,38]
};
// 手机裁图均高604px；三张宽度例外来自原图实测，其余均为278px。
const proofWidths={home:252,'detail-video':264,'browse-return-ad':264};
for(const row of rows){
 row.proofSizes=Object.freeze(row.proof.map(scene=>Object.freeze({width:proofWidths[scene]||278,height:604})));
 row.proofRects=Object.freeze(row.proof.map((scene,index)=>{
  // 全屏流程仅标中间的本次广告，不把触发前后页面中的其他广告框成本次位置。
  if(row.proof.length>1&&index!==1)return Object.freeze([]);
  const size=row.proofSizes[index],pixels=row.proof.length>1?(row.type==='开屏广告'?[0,0,278,479]:[0,0,size.width,size.height]):proofPixelRects[row.id];
  if(!pixels)throw new Error('缺少广告位红框：'+row.id);
  const [x,y,w,h]=pixels,percent=(value,total)=>Number((value/total*100).toFixed(5));
  return Object.freeze([Object.freeze({x:percent(x,size.width),y:percent(y,size.height),w:percent(w,size.width),h:percent(h,size.height),label:row.type,pixels:Object.freeze({x,y,w,h})})]);
 }));
}
window.AD_PLACEMENTS=Object.freeze(rows.map(r=>Object.freeze(r)));
})();
