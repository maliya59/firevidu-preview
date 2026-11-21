'use strict';
/* 本地演示的右键字段说明；不修改原界面内容、不向服务器发送数据。 */
(()=>{
 const registry=new Map(), unresolved=new Map();
 let popup=null,returnFocus=null;
 const text=e=>(e?.getAttribute?.('aria-label')||e?.dataset?.action||e?.dataset?.sourceText||e?.textContent||'').replace(/\s+/g,' ').trim();
 const current=()=>window.__DEMO__?.state?.modal||window.__DEMO__?.state?.screen||'';
 const rule=(title,description,status='已确认')=>({title,description,status});
 const common={
  '首页':rule('首页','浏览模板分类与模板列表，选择模板进入详情。'),
  '作品':rule('作品','查看已经制作的图片和视频作品，进入各自的详情。'),
  '我的':rule('我的','管理个人资料、语言选择、会员、邀请和券等入口。'),
  '壁纸':rule('壁纸','浏览静态、视频或3D壁纸；上传自己的照片后自动生成3D预览，不再叠加素材。只支持设为壁纸，不下载到相册。'),
  '普通保存':rule('普通保存','继续限时免费保存，不要求观看激励广告。'),
  '高清保存':rule('高清保存','需要解锁 1 次激励广告权益；用户可以主动选择 1 张通用券抵扣。'),
  '超清保存':rule('超清保存','需要解锁 2 次激励广告权益，可使用 2 张通用券全部抵扣，或用 1 张券加 1 次广告。'),
  '去水印':rule('去水印','去除当前作品的平台水印，需要 1 次激励广告权益；可主动选择去水印专用券或通用券抵扣。'),
  '再次制作':rule('再次制作','重新进入对应模板的制作流程；视频作品详情仅保留此制作操作。'),
  '选择语言':rule('选择语言','打开语言选择弹窗。先选择语言，再确认应用；取消不改变原来的选择。'),
  'English':rule('English','选择英语；确认后保存本地语言选择。演示页面仍沿用原稿内容，未自行添加整套英文翻译。'),
  '简体中文':rule('简体中文','选择简体中文；确认后保存本地语言选择。'),
  'Continue':rule('确认语言','应用当前选择的语言并关闭弹窗。'),
  'Not now':rule('暂不更改','关闭语言弹窗，不保存本次尚未确认的选择。'),
  '推荐给朋友':rule('推荐给朋友','打开分享弹层，可选择分享渠道或复制原稿分享文案。真实下载链接尚未接入本地演示。'),
  '服务条款':rule('服务条款','打开订阅及数字权益服务说明；付款、续订和退款参照已核对的Reelit协议，并按Google Play实际渠道规则处理。'),
  '隐私政策':rule('隐私政策','保留原来的查看入口；正式隐私政策内容及链接待提供。','待确认'),
  '关于我们':rule('关于我们','查看应用品牌与版本信息，页面内容沿用原稿。','原界面说明'),
  'Continue with Google':rule('Google 登录','正式产品使用 Google 登录；本地演示只切换登录状态，不连接真实账号。'),
  '退出登录':rule('退出登录','先显示确认弹窗。确认后恢复游客状态，已经同步的作品仍保留在原账号。'),
  '昵称':rule('昵称','个人资料中的显示名称，长度为 1～20 个字符。'),
  '用户昵称':rule('昵称','个人资料中的显示名称，长度为 1～20 个字符。'),
  '更换头像':rule('更换头像','个人资料的头像修改入口；本地演示保留原稿头像，不上传图片。','原界面说明'),
  '反馈补充说明':rule('补充说明','选择“其他”后填写具体问题，帮助排查本次制作结果。'),
  '提交反馈':rule('提交反馈','Google登录后提交本次成功或失败结果的反馈。先显示感谢反馈，点击完成后，符合条件才显示免广告重试机会；已有作品详情没有此入口。'),
  '免广告重试':rule('免广告重试','返回原模板的制作同款详情，可保留或重新选择照片后点击开始制作。本次跳过制作前插页并沿用VIP体验资格；实际开始才计每日2次，失败也计次，保存广告不免。退出准备页须确认，确认退出放弃本次资格但不扣每日次数；继续制作保留照片和资格。'),
  '暂不重试':rule('暂不重试','关闭反馈后的提示，返回刚完成的作品结果。'),
  '设为壁纸':rule('设为壁纸','首次静态设置需1次、3D或视频动态需2次正常激励，可主动用券抵扣。成功设置后写入壁纸记录：同壁纸再次静态免费；已成功动态再设免激励，普通1次插页、VIP无插页。只设过静态再设动态仍需2次正常激励。主动取消不新增历史资格，实际失败保留本次资格。'),
  '保留3D动效':rule('保留3D动效','设置后保留随手机晃动的效果。首次需要2次正常激励广告权益，可用通用券逐次抵扣；三个设置目标使用同一次解锁，两屏不重复扣。历史已成功设置过3D效果时沿用再次设置规则。'),
  '保留3D效果':rule('保留3D效果','首次设置需要2次正常激励广告权益，可用通用券逐次抵扣。选择桌面、锁屏或同时设置都只解锁一次；已成功使用过的3D效果再次设置沿用历史规则。'),
  '静态壁纸':rule('静态壁纸','设置没有3D动效的壁纸。首次需要1次正常激励或1张通用券；壁纸记录中同一壁纸再次静态设置免费。'),
  '设置壁纸':rule('设置壁纸','静态壁纸首次设置需1次正常激励或1张通用券；已成功使用过的同一壁纸从记录再次静态设置免费。'),
  '设置3D壁纸':rule('设置3D壁纸','3D动态效果首次需2次正常激励，通用券可逐次抵扣。成功动态设置后的记录可再次动态设置，普通1次插页、VIP无广告；仅设过静态不等于动态已解锁。'),
  '已确认设置成功':rule('已确认设置成功','本地模拟 Android 系统已完成壁纸设置。正式产品以系统可返回的结果为准。'),
  '用户取消设置':rule('用户取消设置','本地模拟主动取消系统设置。本次已看广告或使用券取得的资格随本次取消作废，下次设置重新解锁，不返还券。'),
  '设置失败 / 无法确认':rule('设置失败或无法确认','本地模拟设置失败或系统未返回成功结果，保留本次已取得的设置资格，下次继续，不重复扣费。'),
  '会员中心':rule('会员中心','周卡、月卡、年卡价格暂用xx，左右滑动查看各套餐权益。周卡每期默认7张，7×24小时周期结束时过期；月卡和年卡每月默认30张，月周期结束时过期。新周期开始才发对应赠券，提前续费不提前发；每天默认3张日券，印度当日有效。VIP内容无需额外体验广告，普通保存等仍按券及广告配置解锁。'),
  '确认套餐后开通':rule('开通会员','登录后选择周卡、月卡或年卡；正式产品付款并由后台核验后生效。本地只模拟流程，不付款、不创建真实订单。'),
  '恢复购买':rule('恢复购买','向购买服务核验已有会员状态，正式产品核验成功后恢复权益；本地演示不连接支付服务。'),
  '每日通用券':rule('每日通用券','有效会员每天自动发 3 张通用券，印度时间当天过期，每天 00:00 重置。周卡、月卡、年卡数量相同，同一用户同一印度业务日只发一批。'),
  '邀请有礼':rule('邀请有礼','好友通过邀请链接注册后，邀请人得1张去水印券；好友首次实际看激励广告并高清保存成功，双方各得1张通用券。邀请券15天有效，用券免广告或限免保存不触发第二阶段。'),
  '立即邀请':rule('立即邀请','打开邀请分享界面，展示邀请内容与分享渠道；真实邀请链接等待正式服务接入。'),
  '好友进度与奖励记录':rule('好友进度与奖励记录','查看注册奖励和广告保存奖励两个阶段。同一好友每阶段只奖励一次；每天最多 5 位新好友获得计奖资格，保存奖励可跨天补发。'),
  '复制邀请链接':rule('复制邀请链接','复制用于邀请归因的专属链接；本地尚未接入真实邀请地址，不会伪造邀请数据。','待确认'),
  '通用券':rule('通用免广告券','抵保存、去水印和壁纸设置中的1次激励广告；VIP体验前的2次额外广告必须实际观看，不可用券。用户主动选用后优先扣快过期的券；保存失败返原期限，已过期的仍过期。'),
  '去水印专用券':rule('去水印专用券','仅能抵扣去水印所需的 1 次激励广告，不能用于高清、超清或壁纸设置。'),
  '返回':rule('返回','返回当前流程的上一个界面。视频效果预览和确认保存的返回不会弹删除作品提示。'),
  '更换照片':rule('更换照片','只在上传准备页替换自定义壁纸的原图；生成后的3D效果预览不显示此入口。需要换图时返回上传页操作。'),
  '裁剪照片':rule('裁剪照片','调整自定义壁纸中的照片显示范围；具体裁剪交互尚未接入本地演示。','待确认'),
  '0 张':rule('不使用券','本次不消耗通用券，仍需观看全部应完成的激励广告。'),
  '1 张':rule('使用 1 张通用券','用 1 张通用券抵扣本次的 1 次激励广告；超过可用余额或所需次数时不能选。'),
  '2 张':rule('使用 2 张通用券','用 2 张通用券抵扣本次的 2 次激励广告。仅在需要 2 次权益且余额足够时可选。'),
  '周卡':rule('周卡会员','有效7×24小时，每7天自动续订。每期开始默认发7张通用券，周期结束时过期；每天另发3张日券，印度当日有效。提前续费从已付款期限的最后到期日接续，新周期开始才发券。价格暂用xx。'),
  '月付':rule('月付会员','会员按自然月付费，次月同日到期；每个权益周期开始时默认发30张通用券，提前付款不提前发券，另每天3张日券。价格xx，自动续订及取消通过Google Play购买页与渠道规则处理。'),
  '年付':rule('年付会员','年付有效1年，每月开通日发30张通用券，每批到次月同日到期；另每天3张日券，印度当日有效。价格xx。'),
  '首次赠券':rule('每月赠券','月卡每个权益周期开始时默认发30张；年卡每个月周期开始时默认发30张，提前付款不提前发券，次月同日过期。恢复购买和重复回调不重复发同一期。每日日券另计。'),
  '视频壁纸':rule('视频壁纸','视频动态首次需2次正常激励，可用通用券。成功动态设置后从记录再次使用免激励，普通1次插页、VIP无插页；仅有静态记录仍按首次动态规则。'),
  '设置视频壁纸':rule('设置视频壁纸','首次视频动态需2次正常激励，可用券；已有动态成功记录免激励，普通1次插页、VIP无插页。取消不新增历史资格；实际失败保留本次资格。'),
  '立即重试':rule('立即重试','先回到原模板的制作同款详情/照片步骤，可保留或重新选择照片，模板不变，确认后再点开始制作。本次没有制作前插页；实际开始才计一次，VIP体验资格沿用，保存广告仍按原规则。'),
  '感谢反馈':rule('感谢反馈','反馈已提交。点击完成后，若当天尚有免广告重试资格，再显示机会提示；两次用完则直接结束。'),
  'Google Play Billing':rule('Google Play Billing','针对主要上架 Google Play 的印度版本推荐此支付渠道。Google 登录只识别账号，会员需另行支付并由后台核验。','建议')
 };
 const backend={
  '模版':rule('模板','列表展示模板预览封面和名称，进入对应的预览或编辑。','原界面说明'),
  '主分类/二级分类':rule('主分类 / 二级分类','模板所属的一级分类及其下的二级分类。','原界面说明'),
  '辅助分类':rule('辅助分类','模板除主分类之外关联的其他分类，可用于更多分类入口展示。','原界面说明'),
  '参考图片':rule('参考图片','制作模板所需的用户参考照片数量；范围模式需要最少与最多数量，逐项模式按入口要求提供。','原界面说明'),
  '输出形式':rule('输出形式','区分静态图片模板和动态视频模板。','原界面说明'),
  '是否精选':rule('是否精选','控制或筛选该模板是否加入精选展示。','原界面说明'),
  '上架状态':rule('上架状态','模板当前是否在 App 端对用户展示。编辑内容不改变确认创建的排序时间。','原界面说明'),
  '翻译检查':rule('翻译检查','进入当前内容的多语言文案维护。模板名称、说明和上传入口文案在模板编辑中维护，分类翻译在语言配置中维护。','原界面说明'),
  '语言名称':rule('语言名称','后台管理的语言显示名称；新增语言默认停用。','原界面说明'),
  '启用状态':rule('启用状态','控制对应内容或语言是否可用；语言必需文案完整并保存后才能启用。具体对象以所在页面为准。','原界面说明'),
  '广告位名称':rule('广告位名称','标识 App 中对应的广告展示或激励权益位置。','原界面说明'),
  '广告类型':rule('广告类型','区分开屏、插页、横幅、原生及激励广告，用来对应不同的 App 展示方式。','原界面说明'),
  '开关':rule('开关','控制该广告位是否展示。关闭激励广告后，对应次数免费放行，不关闭功能，也不扣券。'),
  '一级分类':rule('一级分类','模板分类的第一层，包含相应二级分类。','原界面说明'),
  '二级分类':rule('二级分类','归属于某个一级分类的细分类，模板可按该分类展示。','原界面说明'),
  '排序值':rule('排序值','控制本项内容的展示顺序。壁纸或素材排序的具体规则以最终确认方案为准。','待确认'),
  '资源版本':rule('资源版本','标识装饰素材的资源版本，用于追踪素材更新；壁纸编辑页不另外要求填写此字段。'),
  '删除分类':rule('删除素材分类','仅允许删除空分类，点击保存分类后才生效。有素材时须先移走或删除素材，且至少保留一个分类；关闭弹窗不保存本次删除。','原界面说明'),
  '壁纸管理':rule('壁纸管理','管理静态、视频和3D壁纸，运营维护名称、分类和文件。由列表进入新增或编辑，不另加编辑菜单。'),
  '上传壁纸':rule('上传壁纸','静态和3D上传图片，视频上传视频。3D图片由程序自动拆解成 3D，处理成功后预览并发布，不要求运营手工拆层。'),
  '新增分类':rule('新增素材分类','增加一个可填写名称的素材分类。点击保存分类后，同步更新本地分类标签及素材所属分类选项。','原界面说明') ,
  '查询条件':rule('查询条件','根据当前页面支持的条件查找本地演示记录，不查询真实线上数据。','原界面说明')
 };
 Object.entries({...common,...backend}).forEach(([k,v])=>registry.set(k,v));
 const scoped={
  'edit-profile::保存':rule('保存资料','保存本次填写的昵称并返回已登录个人中心。昵称不能为空，长度为 1～20 个字符。'),
  'edit-profile::取消':rule('取消编辑','关闭编辑资料弹层，不保存本次尚未确认的昵称修改。'),
  'edit-profile::清空昵称':rule('清空昵称','清空当前输入框，便于重新填写；只有点击保存后才应用修改。'),
  'logout::确认退出':common['退出登录'],
  'delete::删除':rule('删除作品','确认后从本地示例作品中移除对应作品，演示不会删除真实线上作品。','原界面说明'),
  'exit-creating::确认退出':rule('退出制作','终止本次本地制作演示并返回首页。','原界面说明'),
  'stop-creating::取消制作':rule('取消制作','终止本次本地制作演示并返回首页。','原界面说明'),
  'exit-save::确认退出':rule('退出保存','退出当前图片保存流程并返回首页。视频效果预览的返回不使用此弹窗。','原界面说明'),
  'watermark::暂不解锁':rule('暂不去水印','关闭去水印解锁弹层，当前作品保留水印。'),
  'watermark::观看广告解锁':common['去水印'],
  'admin-new-materials::保存分类':rule('保存素材分类','保存本次新增、改名或删除空分类的修改，同步本地分类标签与所属分类选项；至少保留一个分类，仅保存在当前浏览器。','原界面说明'),
  'admin-new-feedback::问题类型':rule('问题类型','用户提交的制作效果问题类别，供查看反馈；当前后台不增加处理状态、关联重试列或人工标记。','原界面说明'),
  'new-wallpaper::全部':rule('全部壁纸','同时显示静态、视频和3D壁纸。'),
  'new-wallpaper::静态':rule('静态壁纸筛选','仅显示静态壁纸预设。'),
  'new-wallpaper::3D':rule('3D壁纸筛选','仅显示支持随手机晃动效果的3D壁纸预设。'),
  'empty::去创作':rule('去创作','返回首页选择模板，开始制作图片或视频作品。','原界面说明'),
  'saved::返回首页':rule('返回首页','离开视频保存成功页并返回首页，已完成的作品保留。','原界面说明')
 };
 for(const [key,value]of Object.entries(scoped))registry.set(key,value);
 const confirmedExtras={
  '开通会员':common['确认套餐后开通'],
  '月付会员':common['月付'],
  '年付会员':common['年付'],
  '我的会员':common['会员中心'],
  '会员免广告范围':rule('会员免广告范围','默认关闭插页和底部 Banner，开屏、原生广告默认显示；以独立会员广告配置为准，激励权益按券或广告结算。'),
  '免广告范围':rule('会员免广告范围','默认关闭插页和底部 Banner，具体以独立会员广告配置为准。券用完仍可按规则看激励广告。'),
  '活动规则':rule('邀请规则','每天最多 5 位新注册好友取得计奖资格，印度时间 00:00 重置。两阶段每好友各奖励一次；保存奖励可跨天补发，邀请券15天过期。'),
  '好友注册成功':rule('注册阶段','经邀请链接首次注册并登录后，只给邀请人1张去水印券，15天有效；被邀请人通用券在后续首次广告高清保存成功时发放。'),
  '好友首次广告高清保存成功':rule('保存阶段','好友首次实际看激励广告并高清保存成功后，双方各得1张通用券，15天有效。用券免广告或普通限免保存不触发。'),
  '好友首次看广告保存成功':rule('保存阶段','好友首次实际看激励广告并高清保存成功后，双方各得1张通用券，15天有效。用券免广告或普通限免保存不触发。'),
  '数量与有效期待确认':common['每日通用券'],
  '套餐与价格待确认':rule('套餐与价格','周卡、月卡和年卡价格暂用 xx 占位，由定价负责人提供正式价格。'),
  '插页、底部横幅、回前台开屏':rule('会员广告范围','现行规则仅免插页和底部 Banner；回前台开屏仍正常显示。'),
  '同时关闭正在制作的原生广告卡片':rule('原生广告','现行规则保留所有原生广告，包括制作中的原生卡片。'),
  '同步购买状态':rule('同步购买状态','由服务端向支付平台核验，核验通过才发会员和券。本地没有真实支付，不能把演示状态当真实订单。'),
  '会员已生效':rule('会员已生效','服务端核验付款后生效。周卡7×24小时，每期开始默认发7张；月卡和年卡每月周期开始默认发30张，提前续费不提前发。另每天默认3张日券；本地仅模拟。'),
  '来源：邀请收益奖励':rule('邀请保存奖励','好友首次实际看激励广告并高清保存成功后，邀请人与好友各得1张通用券，有效期15天。'),
  '来源：好友注册奖励':rule('邀请注册奖励','好友经邀请链接首次注册后，邀请人获得1张去水印券；首次实际看广告高清保存成功后双方各得1张通用券。邀请券均15天过期。'),
  '来源：会员每日权益':common['每日通用券']
 };
 Object.entries(confirmedExtras).forEach(([key,value])=>registry.set(key,value));

 function resolve(label,scene,element){
  const explicitKey=element?.closest?.('[data-field-help]')?.dataset.fieldHelp;
  const direct=element?.closest?.('[data-help]');
  if(direct){
   const meaning=direct.dataset.help;
   const state=direct.dataset.helpStatus||(/待确认|待核对|尚未提供|未取得|尚待|尚未确定|待补充/.test(meaning)?'待确认':'原界面说明');
   const genericAdmin={
    '保存':'保存当前本地表单中的修改；不会写入真实线上后台。',
    '保存草稿':'保留本地草稿，未执行确认创建或正式发布。',
    '确认创建模版':'确认创建当前模板。列表排序按确认创建时间从新到旧，之后编辑不改变排序；本地不创建线上模板。',
    '预览':'查看此行模板或资源的预览。',
    '编辑':'打开此行内容的编辑表单，当前修改仅作用于本地演示。',
    '增加上传入口':'增加一个逐项上传的照片入口，对应 App 中的一项照片要求。',
    '移除最后一项':'移除本地表单中的最后一个照片入口；不会修改真实模板。',
    '下一步，填写表单':'选择本地视频后进入配置表单，真实上传后的步骤尚待核对。',
    '下一步，确认方案':'选择本地图片后继续配置；真实上传后的中间步骤尚待核对。',
    '保存分类':'保存本地分类名称、归属与译文，未提交到真实后台。',
    '保存配置':'保存本地广告位置的开关示例，未改变真实广告配置。',
    '保存语言':'保存本地语言名称及展示名称，新增语言默认停用。'
   };
   const expanded=scene.startsWith('admin')&&meaning===label&&genericAdmin[label];
   return rule(direct.dataset.helpTitle||label||'字段说明',expanded||meaning,expanded&&/待核对/.test(expanded)?'待确认':state);
  }
  if(explicitKey&&registry.has(explicitKey))return registry.get(explicitKey);

  const newAction=element?.closest?.('[data-new-action]')?.dataset?.newAction;
  if(newAction){
   const actionRules={
    week:common['周卡'],month:common['月付'],year:common['年付'],buy:common['确认套餐后开通'],restore:common['恢复购买'],
    login:rule('登录后查看','使用 Google 登录后查看当前 FireVidu 账号的券和会员权益。游客不发这些权益，不做游客权益合并；本地只模拟登录。'),
    share:common['立即邀请'],records:common['好友进度与奖励记录'],rules:confirmedExtras['活动规则'],submit:common['提交反馈'],
    coupons:rule('我的券','登录后查看当前账号的券数量、用途、来源、到期和使用记录；用户主动选券后优先用快过期的券。'),
    available:rule('可用券','显示尚未过期且还有可用数量的券，按到期时间从早到晚排列；两种券的使用范围不同。'),
    history:rule('使用明细','查看本地演示中的发券、消耗和返还记录；普通保存失败按原期限返券，过期券不恢复。'),
    sync:confirmedExtras['同步购买状态']
   };
   if(actionRules[newAction])return actionRules[newAction];
  }
  if(/登录后|Google.*登录|谷歌登录/.test(label))return rule('Google 登录','登录后才能参与邀请、获得或使用券、购买会员。Google 登录识别账号，不等于付款；本地只模拟登录。');
  if(/反馈问题|失败反馈/.test(label))return rule('制作反馈','本次成功或失败结果页提供入口；历史作品详情没有。提交后先感谢反馈，点击完成后符合资格才提示免广告重试。');
  const scoped=registry.get(scene+'::'+label);if(scoped)return scoped;
  if(registry.has(label))return registry.get(label);
  if(label==='作品预览')return rule('作品预览','展示当前模板或用户制作效果。去水印入口统一放在效果预览右上角，水印本身不附带删除叉号。');
  if(/确认保存/.test(label))return rule('确认保存',window.__DEMO__?.state?.type==='video'?'确认视频画质和解锁方式后，进入保存进度，完成后显示保存成功。':'保存当前图片；成功后在当前结果页提示“作品已保存至相册”，不进入视频保存成功页。');
  if(/搜索/.test(label))return rule('搜索模板','输入关键词搜索模板；本地以示例模板演示有结果与无结果两种状态。');
  if(/会员中心/.test(label))return common['会员中心'];
  if(/邀请有礼/.test(label))return common['邀请有礼'];
  if(/我的券|查看我的券|通用.*去水印/.test(label))return rule('我的券','查看通用券、去水印专用券的可用数量、来源、到期时间与使用记录。页面当前余额为本地演示样例。');
  if(/好友.*记录|查看好友进度/.test(label))return common['好友进度与奖励记录'];
  if(/活动规则|今日成功邀请|注册奖励|保存奖励/.test(label)&&scene.startsWith('new-invite'))return confirmedExtras['活动规则'];
  if(/去水印专用券/.test(label))return common['去水印专用券'];
  if(/每月.*30|每月赠券|月券|开通赠|首次赠券/.test(label))return common['首次赠券'];
  if(/每天.*3|每日.*3|每日.*券|今日权益|数量与有效期/.test(label))return common['每日通用券'];
  if(/自动续费|自动续订/.test(label))return rule('续订方式','按购买页显示的周期自动续订；在原付款渠道取消。取消不等于退款，可继续使用至已付费周期结束；平台及适用法律优先。');
  if(/会员免广告|免广告范围/.test(label))return confirmedExtras['会员免广告范围'];
  if(/周卡|七天会员|7天会员/.test(label)&&!scene.startsWith('admin'))return common['周卡'];
  if(/月付|月度/.test(label)&&!scene.startsWith('admin'))return common['月付'];
  if(/年付|年度/.test(label)&&!scene.startsWith('admin'))return common['年付'];
  if(/套餐与价格|价格.*xx|xx.*价格/.test(label))return rule('套餐价格','周卡、月卡和年卡价格先用 xx 占位，正式价格由定价负责人提供。');
  if(/完成/.test(label)&&scene==='new-feedback')return common['感谢反馈'];
  if(/通用券|选择.*券抵扣/.test(label))return common['通用券'];
  if(/取消制作/.test(label))return rule('取消制作','打开制作取消确认提示；是否退出由后续确认操作决定。','原界面说明');
  if(/返回|关闭|取消|暂不/.test(label))return rule(label,'关闭当前弹层或返回上一步，不提交当前尚未确认的选择。');
  if(/分享至 |WhatsApp|Instagram|Facebook|Telegram|Snapchat|更多/.test(label))return rule('分享渠道','选择此分享渠道；本地演示仅展示操作，不会实际向好友或第三方发送消息。');
  if(/复制分享文案/.test(label))return rule('复制分享文案','复制原稿提供的分享文案；真实下载地址尚未接入演示。');
  if(/叠加素材 [AB]\d+|素材 [AB]\d+/.test(label))return rule('叠加素材','点击选中或取消此素材，可跨分类同时叠加多个素材。当前缩略图为占位内容，正式素材待提供。');
  if(/分类名称 [AB]/.test(label))return rule('素材分类','切换此分类下的素材，切换后保留其他分类已经选择的素材。正式分类名称尚未提供。','待确认');
  if(/上传照片.*自定义壁纸/.test(label))return rule('上传照片定制壁纸','选择自己的照片，点击生成后经过一次插页进入3D效果预览，不再增加装饰元素。首次设为静态1次、3D2次正常激励，会员插页按配置。');
  if(/上传|参考图|需上传|图片\d/.test(label))return rule('上传参考照片',scene.includes('video')?'视频模板可按模板配置的最小、最大数量选择照片；此示例为 1～9 张。本地点击后直接进入效果预览。':'按模板设置的入口逐项提供所需照片，界面可显示对应人物或照片要求；本地演示不上传真实文件。');
  if(/开始制作/.test(label))return rule('开始制作',scene.includes('video')?'视频素材上传完成后先进入效果预览，确认保存后才显示进度。':'按模板和照片开始图片制作，完成后进入结果页。登录、广告与制作在本地模拟。');
  if(/问题反馈|效果反馈|失败反馈/.test(label))return rule('制作反馈','本次刚完成或生成失败的结果页提供入口；需要先Google登录，取消登录仍留在结果页。从“作品”进入的已有作品详情没有。提交前不提前介绍免广告重试。');
  if(/人物异常|效果不符|画面不符|内容缺失|生成失败|其他/.test(label)&&scene==='new-feedback')return rule('问题类型','单选人物异常、效果不符、内容缺失、生成失败或其他。选择其他后填写具体问题；失败结果页默认选中生成失败。');
  if(/模板名称/.test(label))return rule('模板名称','此模板在 App 中展示的名称，后台在模板编辑页维护。');
  if(/模板说明/.test(label))return rule('模板说明','介绍此模板内容或效果的文案，后台在模板编辑页维护。');
  if(/横幅广告|Banner320|原生广告|插页广告|开屏广告/.test(label))return rule('广告展示位','此处是原界面中的广告展示位置；本地使用占位内容，不会请求真实广告。');
  if(/精选/.test(label))return rule('精选','用于标记或筛选后台加入精选的模板。');
  if(label==='新增'||label==='NEW')return rule('新增标签','实际近7天上架的内容在封面右上角直接写“新增”；未知或未来的上架时间不显示，不根据创建或更新时间推定。精选在左上、VIP在左下、图片/视频/3D类型在右下，均为简单文字标签，不显示视频时长。');
  if(/静态|3D|视频/.test(label)&&scene==='new-wallpaper')return rule('壁纸类型','筛选或标识静态、视频和3D壁纸；3D卡片带3D标签。');
  if(label==='全部'&&scene==='new-wallpaper')return rule('全部壁纸','同时显示静态、视频和3D壁纸。');
  if(/个人形象|亲友关系|庆典祝福|节日文化|宗教祈福|社交表达|创意风格|全部分类/.test(label))return rule('模板分类','按后台设置的分类浏览模板。分类名称的翻译在后台语言配置中维护。');
  if(/继续解锁|确认解锁|继续观看广告|继续并设置壁纸/.test(label))return rule('继续解锁','按当前所选券数抵扣，剩余次数通过激励广告完成；当前演示不会扣真实券或请求真实广告。');
  if(/已完成.*\d|还需.*广告/.test(label))return rule('解锁进度','显示本次解锁已完成及仍需完成的权益次数。中断或加载失败的广告不计为完成。');
  if(/保存未完成|重试保存|返还券/.test(label))return rule('保存失败处理','保存失败返还本次消耗的券，保留原有效期；已过期的仍过期，不延期补发。已看广告进度不保留。壁纸设置失败按保留本次资格处理。');
  if(/删除/.test(label))return rule('删除作品','确认后从本地演示作品列表移除对应作品；真实产品删除规则沿用原界面提示。','原界面说明');
  if(/登录 FireVidu|谷歌名称|谷歌头像|昵称/.test(label))return rule('个人资料','未登录时进入登录弹层；已登录时进入个人资料编辑，昵称支持 1～20 个字符。');
  if(/观看.*广告|解锁高清/.test(label))return rule('激励广告解锁','完整观看规定次数的激励广告后获得对应权益。通用券可以替代一次激励广告；具体当前次数以当前操作显示为准。');
  if(/制作未成功|再试一次/.test(label))return rule('制作失败重试','本次制作未成功，可重新尝试或更换照片；本地展示失败及重试状态。','原界面说明');
  if(/\d+:\d+|▂|▰|^‹$|^⌂$|^▧$|^▣$|^○$/.test(label))return null;

  const cardTitle=element?.closest?.('.confirmed-card')?.querySelector?.('h3');
  if(cardTitle&&text(cardTitle)!==label)return resolve(text(cardTitle),scene,cardTitle);
  if(element?.closest?.('.confirmed-body,.retry-prompt')){
   if(scene.startsWith('new-invite'))return confirmedExtras['活动规则'];
   if(scene.startsWith('new-member'))return common['会员中心'];
   if(scene==='new-coupons')return rule('券与到期','通用券、去水印券分开显示。邀请券15天有效，每月会员赠券到次月同日到期，会员日券印度时间当天过期；优先用快过期的券。');
   if(scene==='new-feedback')return common['提交反馈'];
   if(scene==='new-retry')return common['免广告重试'];
  }
  const title=label.length>38?label.slice(0,38)+'…':label;
  if(!title)return null;
  unresolved.set(scene+'::'+label,{scene,label});
  return rule(title,'此处内容已按现有界面保留。更具体的字段定义或业务规则尚未提供，已记入待确认清单。','待确认');
 }
 function hitAt(x,y,root){
  const elements=[...root.querySelectorAll('[data-source-text],svg text,.confirmed-body h2,.confirmed-body h3,.confirmed-body p,.confirmed-body strong,.confirmed-body small,.retry-prompt strong,.retry-prompt p')].filter(el=>{
   const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width&&r.height&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom&&s.visibility!=='hidden'&&s.display!=='none';
  });
  return elements.sort((a,b)=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return x.width*x.height-y.width*y.height;})[0];
 }
 function close(){if(!popup)return;popup.remove();popup=null;if(returnFocus?.isConnected)returnFocus.focus?.({preventScroll:true});returnFocus=null;}
 function show(def,point={}){
  close();returnFocus=document.activeElement;popup=document.createElement('aside');popup.className='field-help-popup';popup.setAttribute('role','dialog');popup.setAttribute('aria-label','字段说明');popup.tabIndex=-1;
  const h=document.createElement('header'),title=document.createElement('strong'),closeBtn=document.createElement('button');title.textContent=def.title||'字段说明';closeBtn.textContent='×';closeBtn.setAttribute('aria-label','关闭字段说明');closeBtn.onclick=close;h.append(title,closeBtn);
  const status=document.createElement('span');status.className='field-help-state'+(def.status==='待确认'?' pending':'');status.textContent=def.status||'已确认';if(def.status==='建议')status.style.color='#1565c0';
  const desc=document.createElement('p');desc.textContent=def.description||def.text||'';popup.append(h,status,desc);document.body.appendChild(popup);
  const rect=popup.getBoundingClientRect();popup.style.left=Math.max(10,Math.min(point.x??innerWidth/2,innerWidth-rect.width-10))+'px';popup.style.top=Math.max(10,Math.min((point.y??innerHeight/2)+8,innerHeight-rect.height-10))+'px';popup.focus({preventScroll:true});
 }
 document.addEventListener('contextmenu',e=>{
  if(e.target.closest('.field-help-popup'))return;
  const root=e.target.closest('[data-field-help],[data-help],#screen,#modal-host,#admin-view,.admin-shell,.admin-demo,.admin-replica,.admin-new');if(!root)return;
  const explicit=e.target.closest('[data-field-help],[data-help]');
  let el=explicit||e.target.closest('button,input,textarea,select,[data-source-text],text,th,td,label,dt,dd,summary,.confirmed-body h2,.confirmed-body h3,.confirmed-body p,.confirmed-body strong,.confirmed-body small,.retry-prompt strong,.retry-prompt p');
  if(!el||el===root){const hit=hitAt(e.clientX,e.clientY,root);if(hit)el=hit;}
  let label=text(el);
  if(!label&&e.target.closest('svg image'))label='作品预览';
  const backendRoot=e.target.closest('.admin-replica,.admin-new,#admin-view,.admin-shell,.admin-demo');
  const scene=backendRoot?(window.ADMIN_UI?.current||'admin'):current();
  let def;
  const cell=e.target.closest('td');
  if(cell&&!explicit&&!e.target.closest('button,input,select,textarea')){
   const header=cell.closest('table')?.querySelector('thead tr')?.children[cell.cellIndex];
   if(header?.dataset.help)def=rule(header.dataset.helpTitle||text(header),header.dataset.help,header.dataset.helpStatus||(/待确认|待核对|尚未提供|尚待/.test(header.dataset.help)?'待确认':'原界面说明'));
   else if(header)def=resolve(text(header),scene,header);
  }
  if(!def)def=resolve(label,scene,el||e.target);if(!def)return;
  e.preventDefault();e.stopPropagation();show(def,{x:e.clientX,y:e.clientY});
 },true);
 document.addEventListener('pointerdown',e=>{if(popup&&!e.target.closest('.field-help-popup'))close();},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&popup){e.preventDefault();e.stopImmediatePropagation();close();}},true);
 window.addEventListener('resize',close);window.addEventListener('scroll',close,true);
 window.FIELD_HELP={
  register(key,definition){if(typeof key==='object'){for(const [k,v]of Object.entries(key))registry.set(k,v);}else registry.set(key,definition);},
  resolve:(label,scene=current(),element=null)=>resolve(label,scene,element),show,close,
  get unresolved(){return [...unresolved.values()];},
  get map(){return Object.fromEntries(registry);}
 };
})();
