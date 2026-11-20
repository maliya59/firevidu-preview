/* 原型评审说明：展示在手机框外，不属于 App 内界面。 */
(()=>{'use strict';
const stage=document.querySelector('#stage');
if(!stage)return;
const panel=document.createElement('aside');
panel.className='wallpaper-rules';panel.hidden=true;
panel.setAttribute('aria-label','壁纸排序规则说明');
panel.innerHTML=`<header><span>原型说明</span><h2>壁纸排序规则</h2></header>
<p class="wr-scope">当前版本只有<strong>全部、静态壁纸、视频壁纸、3D壁纸</strong>四个入口，按创建入口自动归类，并支持名称搜索。所有抽取均限定在当前类型、搜索结果及 App 可见范围内。先按壁纸 ID 去重，并排除本轮已安排的壁纸。</p>
<p class="wr-note">卡片左上写“精选”，右上写近7天上架的“新增”，左下写 VIP，右下写图片、视频或3D；均为简单文字标签，不显示视频时长。各标记独立，不单设精选栏目，使用规则不变。</p>
<section><h3>全部及各类型 · 前两批</h3><p>每批最多 12 张，依次选取：</p><ol>
<li>随机选 4 张近 7 天上架的新壁纸，可包含精选。</li>
<li>从剩余壁纸中随机选 5 张精选。</li>
<li>从剩余壁纸中随机选 3 张非精选。</li>
<li>数量不足时，从本轮其他未安排壁纸中补齐，优先精选；同组随机抽取。</li>
<li>本批所有精选随机排在前，非精选随机排在后。</li>
</ol><p class="wr-note">同一壁纸即使同时属于新壁纸、精选，也只能占一个位置。</p></section>
<section><h3>全部及各类型 · 第三批起</h3><ul>
<li>先选最多 9 张常规壁纸：精选在前、非精选在后，各组按上架时间倒序，时间相同按 ID 倒序。</li>
<li>再从剩余未安排壁纸中随机选最多 3 张，依次插在第 4、8、12 位。</li>
</ul><p class="wr-pattern">常规 × 3 → 随机 → 常规 × 3 → 随机 → 常规 × 3 → 随机</p></section>
<p class="wr-foot">剩余不足 12 张返回实际数量；随机候选不足时不留空位，常规壁纸紧凑排列。切换壁纸类型或重新搜索开始新一轮，返回详情前的列表延续原轮次。草稿、下架及不可见壁纸不参与抽取。</p>`;
stage.append(panel);
const vipPanel=document.createElement('aside');vipPanel.className='wallpaper-rules template-vip-rules';vipPanel.hidden=true;
vipPanel.setAttribute('aria-label','首页VIP模板排序规则说明');
vipPanel.innerHTML=`<header><span>原型说明</span><h2>VIP模板排序规则</h2></header>
<p class="wr-scope"><strong>VIP 栏目只展示 VIP 模板</strong>，排除下架和 App 不可见的模板。精选、新增、VIP分别用简单文字放在卡片左上、右上、左下；右下显示图片或视频标识，不显示时长。</p>
<section><h3>从第一批开始 · 最多 12 个</h3><ol>
<li>先选最多 9 个常规模板：精选 VIP 在前，其他 VIP 在后；各组按上架时间倒序，时间相同按 ID 倒序。</li>
<li>再从剩余未安排的 VIP 模板中，随机抽取最多 3 个。</li>
<li>随机模板依次插在第 4、8、12 位，其余常规位保持原有顺序。</li>
</ol><p class="wr-pattern">常规 × 3 → 随机 → 常规 × 3 → 随机 → 常规 × 3 → 随机</p></section>
<p class="wr-foot">先按模板 ID 去重，排除本轮已安排的模板。剩余不足 12 个返回实际数量；随机候选不足不留空位。精选 VIP 优先适用于常规位，随机位从剩余 VIP 中抽取。</p>`;
stage.append(vipPanel);
function update(){const app=document.body.dataset.workspace!=='admin',screen=window.__DEMO__?.state?.screen,visible=app&&screen==='new-wallpaper',vipVisible=app&&screen==='home'&&Boolean(document.querySelector('#screen .vip-template-grid'));panel.hidden=!visible;vipPanel.hidden=!vipVisible;stage.classList.toggle('wallpaper-rules-open',visible||vipVisible);}
let queued=false;
const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;update();});});
observer.observe(document.querySelector('#screen'),{childList:true,subtree:true});
observer.observe(document.body,{attributes:true,attributeFilter:['data-workspace']});
update();
})();
