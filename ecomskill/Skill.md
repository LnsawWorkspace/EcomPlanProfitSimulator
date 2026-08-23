---
name: ecomskill
version: "1.1.3"
description: "全场景单品推演"网站（https://ecomplanprofitsimulator.lnsaw.com）的总入口 SKILL。当用户要求使用/操作该网站——利润推演/单品利润模拟、创建或编辑方案、填参数、查看与解读利润报告、调优方案（如把资本回报率/利润率调到某个目标）、查看 6 个敏感性分析图（ROI/售价/单量曲线 + 售价×单量/售价×ROI/ROI×单量热力图，含保本点、盈利区间、利润极值分析）、数据空间/方案组/方案/参数的增删改查与维护（新建、切换、重命名、体检、修复、删除）——或提到 ecomplan、利润推演、单品利润模拟、方案组/方案/工作区/数据空间、资本回报率、保本点等词时，使用本技能。
agent_created: true
---

# Ecomplanprofitsimulator（全场景单品推演 · 总入口）
> **版本记录：** `version.md`（由作者维护，功能迭代后更新版本历史与当前版本号）。

## 重要提示
+ 本技能仅用于 ecomplanprofitsimulator 网站不适用于其他网站。
+ 本技能并不直接提供利润推演/单品利润模拟功能，而是通过操作网站来实现这些功能。
+ 用户在使用本技能时，应自行判断和承担风险。本技能仅提供技术支持和操作指导，用户应根据自身情况做出决策。
+ **⚠ 运行模式要求（作者确立）：本技能必须通过操作浏览器（Playwright 驱动）才能执行，因此 AI 必须处于「可执行/操作浏览器」的模式下（如 Craft 模式），不能是 Plan / Ask 模式**——Plan/Ask 下 AI 只能阅读、分析、出方案，无法真正驱动浏览器干活。**推荐用法：先用 Plan/Ask 模式和 AI 沟通需求、确认方案，再切换到可执行模式（Craft）实际运行。**（Plan/Ask 模式下 AI 仍可阅读并理解本技能的全部文档，只是不执行浏览器操作。）

## 外部依赖
**使用前请先检查外部依赖。**
+ **浏览器**：Edge（Chromium 内核）或 Chrome，需开启远程调试端口（9222），并常驻后台运行。（常驻运行的目的是减少多余的打开关闭动作。）（不需要用户自行设置，AI会处理。）
+ **Node**：v20.5.1（或更高）+ npm v9.8.0（或更高）。编写该技能的脚本时，使用了 Node 的 ES 模块特性（`import/export`），因此 Node 版本必须 >= v20.5.1。
+ **Playwright**：v1.44.0（或更高）。编写该技能的脚本时，使用了 Playwright 的浏览器自动化特性，因此 Playwright 版本必须 >= v1.44.0。
+ **Python（建议有，非必需）**：SKILL 本体（脚本）**不需要** Python；但 **AI 在使用本技能的过程中**常借 Python 做辅助操作（解析脚本输出的超长 RESULT JSON、数据分析、数值验证等），**建议设备环境预装 Python**（3.x 即可），能显著提升 AI 处理输出的效率与准确性。
+ 不确定缺少 Node 或 Playwright 的情况下，是否能够正常运行该技能。建议在本地环境中安装 Node 和 Playwright，并确保版本符合要求，以避免潜在的兼容性问题。

## 介绍（给 AI 的能力导航）

这是"全场景单品推演"网站（**纯前端 + IndexedDB，无后端 API**）的总入口技能。**用户提站点相关需求时先读本文件**，按页面/模块查文档与脚本，不要凭空猜测 DOM 或数据模型。

**四大能力域：**

1. **维护（CRUD）**：数据空间（`workspace_ops.js`）/ 方案组（`plan_group_ops.js`）/ 方案（`plan_meta_ops.js`）/ 参数（`plan_params_ops.js`）。写操作走真实 UI（复用站点名称唯一校验、级联删除），读/查找直连 IndexedDB（绕过分页拿全量）。
2. **报告解读**：`plan_report_ops.js read/json/shot`——13 核心指标 + 3 张明细表 + 全页截图；3 种入口（`--via url/params/workbench`）；**一律 DOM 读取**（控制台 JSON 60~70KB 除非特别必要不用）。
3. **敏感性分析**：`plan_report_graph_ops.js`——6 个图（`roi`/`sale`/`volume` 折线 + `salevolume`/`roisale`/`roivolume` 热力图）；自动找保本点/盈利占比/利润极值；支持临时改参重算（页面输入框=沙盒不落库）、dataZoom 缩放（单变量）、利润范围过滤（热力图）；每图都有"结论→洞察→动作"分析示例（见 graphs.md）。
4. **方案调优（闭环，作者确立的完整流程）**：**先读原始报告**（planReport.md §8 分析套路：读结构→对口径→找病灶）→ **再看相关敏感性分析图**（graphs.md 各图：折线看保本点、热力图看组合空间，别只看报告就调）→ 综合定病灶 → `plan_params_ops.js set` 改参 → `read` 再验证。例：把"拼多多推广"资本回报率从 −14% 调到 +31%（先看报告定位广告费占比 47%，再看 ROI 图/售价图确认保本点，然后改售价 139.9 / 退款 8% / ROI 4 验证）。

**使用前提**：浏览器常驻模式（脚本自动启动带 CDP 9222 的 Edge 并复用）；用托管 node 运行（路径见脚本头注释/运行环境）。

**常用任务 → 命令**（详见各文档 SOP）：

| 用户说 | 命令 |
|--------|------|
| 看 XX 方案的报告 | `plan_report_ops.js read XX --group 组` |
| 把方案调到资本回报率 ≥20% | `plan_params_ops.js set XX --sale-price … --refund-* … --ad-roi …` → `read XX` 验证 |
| ROI 多少不亏 / 保本点 | `plan_report_graph_ops.js roi XX` |
| 扫售价×ROI / ROI×单量 | `plan_report_graph_ops.js roisale XX` / `roivolume XX` |
| 建数据空间 / 方案组 / 方案 | `workspace_ops.js create …` / `plan_group_ops.js create …` / `plan_meta_ops.js create …` |

**核心约定（务必遵守）**：一个方案=一条逻辑渠道（勿混渠道）；满减/优惠券/平台补贴=售价调整（作为新方案，不算支出）；报告数据不落库、每次打开重算；技能只读站点数据。
**ROI 知识红线（涉及 ROI/推广必读 `references/qa.md`）**：① **ROI 是输入参数**（参数页填的 GMV÷推广成本预期，不受退款率影响），不是系统输出指标——别拿输入 ROI 和平台统计 ROI 直接比；② **受退款率+回收率影响的是「广告成本」**（报告输出：广告费用_有效成本 = 退款后广告费 + 广告退款损失）和**推广回报率**（利润÷广告费）——涉及 ROI/推广时，引导用户关注推广回报率（GMV 代表不了利润，生意目标是利润）；③ **ROI 陷阱**——平台推广可能把自然成交变成推广成交（无效推广），应关注增量订单 ROI；④ 方案=单渠道理想环境，报告/图只代表该渠道，不代表全店。
## 页面导航
+ workspaceId 是指**用户数据空间** ID，groupId 是指方案组 ID，planId 是指方案 ID。他们都是 GUID。
+ **数据空间 ≠ 系统库（极易混淆，先看清这层）**：`profitSimulation_systemDB` 是站点内置**系统目录库**（只登记各用户工作区，不存用户数据、不是数据空间）；每个 workspaceId 才是一个**用户 IndexedDB 库**（含 `planGroups`/`planMetas`/`planParams`/`system` 四 store）。维护细节与红线见 `references/workspace.md` §1。
+ 除了首页、工作台，其他页面都可以通过在页面URL+?workspaceId=xxx&groupId=yyy&planId=zzz 来直接访问。但前提是需要知道 workspaceId/groupId/planId，否则会报错。若不知道 workspaceId/groupId/planId，可以先访问工作台页面，找到对应的方案组/方案，点击"调整方案"按钮进入参数页，或点击"查看报告"按钮进入报告页。
### 首页
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/
+ **说明：** 这里是首页，但是通常不需要访问首页，可以直接访问工作台页面。
### 工作台
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/workbench/workbench.html
+ **说明：** 数据空间/方案组/方案的增删改查，是核心页面。
### 数据空间（概念 + 维护）
+ **不是独立页面**，而是浏览器 IndexedDB 的物理库：一个空间 = 一个 IndexedDB 库（库名 = 空间 UUID），由系统目录库 `profitSimulation_systemDB` 登记元信息。
+ **维护文档：** `references/workspace.md`——底层机制、UI 行为真相（如删除需双重确认、删库会被其他标签页阻塞等 9 个源码级坑）、以及 list/doctor/create/rename/activate/delete/repair 的 SOP。
+ **维护脚本：** `scripts/workspace_ops.js`——用 Playwright 驱动真实 UI 做写操作，直接读 IndexedDB 做体检，规避站点缺失的体检能力。命令见文档。
### 方案（概念 + 维护）
+ **业务语义：一个方案 = 一条逻辑渠道（流量/销售渠道）**，如 自然流量、京东快车、汇川、淘宝客、XX直播、YY直播。各渠道的退款率/售价/发货/赠品/费用支出都不同，**不能混在一个方案里**——宁可多建方案，不要混渠道（参数一对一的，混了报告就失真）。
+ **不是独立页面**，而是工作台里的数据对象：一个方案属于某个**方案组**（靠 `groupId` 关联），存于当前工作区库的 `planMetas` store；其参数存于同库的 `planParams` store（keyPath=方案 id，一对一，是方案的"兄弟"而非子表）。
+ **方案列表完全绑定"当前激活的方案组"**：必须先激活方案组，才看得到/改得到该组下的方案。
+ **维护文档：** `references/planMetas.md`——数据模型、`planMetas` 字段表、UI 元素清单、新建/修改/删除/查找真实行为、7 个源码级坑（强依赖激活组、按组作用域唯一性、删除不级联参数留孤儿、时间格式误解、空名被拒、成功 toast 文案误导等）、SOP 与红线。
+ **维护脚本：** `scripts/plan_meta_ops.js`——复用 workspace/方案组脚本的 Playwright+IndexedDB 直连骨架；写操作走真实 UI，读/查找直连 IndexedDB；删除高危需 `--confirm`；内置只读 `params` 命令审计"删方案后参数变孤儿"。命令见文档。
### 参数页
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/planParams/planParams.html
+ **说明：** 填参数（售价/单量/退款率/商品/赠品/支出），由工作台"调整方案"按钮打开新标签。**必须带 URL 参数 `?workspaceId=&groupId=&planId=` 才能加载**（缺一页面隐藏显示"方案不存在"）。
+ **注意：** 目标单量**建议 ≥10 且 10 的倍数**——退款是模拟真实订单、单量会向上取整，单量太小（1/2/3）时取整误差会把有效单量算成负数（报告出现荒谬值），详见 `references/qa.md` Q9。
+ **维护文档：** `references/planParams.md`——数据模型（8 个模型字段、`{value,options}` 包装、百分比存 0-1）、真实行为（保存/加载/校验）、SOP 与红线。
+ **渠道支出检查清单：** `extension/checklists/`——按渠道的填参检查清单库（每渠道一份 `XX-XX-checklist.md`，如 `拼多多通用checklist.md`、可复制新建 `抖音达人直播checklist.md` 等），含每单/部分订单/固定支出常见项目、成本类型、税率与满减规则速查；**填参数前先按方案渠道查对应清单**。
+ **维护脚本：** `scripts/plan_params_ops.js`——list/get/raw/check/set：读走 IndexedDB，写走参数页 UI（复用站点校验）。命令见文档。
### 报告页
+ **页面地址：** https://ecomplanprofitsimulator.lnsaw.com/page/planReport/planReport.html
+ **说明：** 查看利润报告、6 个敏感性分析图，由参数页"保存并查看报告"按钮打开新标签。**纯展示页**，所有数字都是打开后现场计算渲染（不落库），读报告必须打开页面等计算完成再抓。
+ **⚠ 读取规则：** 一律用 DOM 读取（`plan_report_ops.js read/json` 抓指标卡+明细表）；**除非特别必要，不得使用读取控制台 JSON 的方式**（控制台完整 JSON 60~70KB，仅深度调试才用，见 planReport.md §6.0）。
+ **维护文档：** `references/planReport.md`——报告页结构、13 个核心指标含义、4 张明细表、真实行为（计算耗时/对比按钮未完成）、SOP 与红线。
+ **维护脚本：** `scripts/plan_report_ops.js`——read/json/shot：定位方案 → 打开报告页等计算 → 抓指标与明细表并保存全页截图（只读）。

### 敏感性分析图
+ **页面：** 6 个（`planReportRoiGraph.html` / `SaleGraph` / `VolumeGraph` / `SaleVolumeGraph` / `RoiSaleGraph` / `RoiVolumeGraph`），由报告页按钮进入。所有图都是**固定其他参数、单/双变量扫描**后现场渲染，纯展示、不落库。
+ **⚠ 依赖广告：** ROI 系列图（ROI/RoiSale/RoiVolume）要求方案设了广告投放（`planParams.advertising.name` 非空），否则站点 toast「无法查看」+ 脚本会 fail-fast。
+ **维护文档：** `references/graphs.md`——分析图总览 + 6 个图全部详解（ROI/售价/单量 折线 + 售价×单量/售价×ROI/ROI×单量 heatmap），含总览表（§7）。
+ **维护脚本：** `scripts/plan_report_graph_ops.js`——`roi` / `sale` / `volume` / `salevolume` / `roisale` / `roivolume` 命令；页面输入框=临时沙盒（只影响本次图不落库）；自动找保本点 / heatmap 利润分析 + 估算计算量（>1万警示）+ dataZoom 主动缩放（单变量有效）+ 利润范围过滤（--min-profit/--max-profit，不重算）+ 截图（只读）。
**计算量注意：** 分析图需要大量计算，打开后耐心等待（双变量图极慢：1 万点位约 30~40s）。调整参数时必须**预估计算量并控制在 1 万以内**（`计算次数 = (结束−开始)/步进 + 1`），否则图表不会更新。

**6 个图速查（地址/详解/示例全在 `references/graphs.md`，此处不再展开）：**

| 图 | 页面 | 类型 |
|----|------|------|
| ROI 敏感性分析 | `planReportRoiGraph.html` | 单变量折线 |
| 销售额敏感性分析 | `planReportSaleGraph.html` | 单变量折线 |
| 销售量敏感性分析 | `planReportVolumeGraph.html` | 单变量折线 |
| 销售额+销售量分析 | `planReportSaleVolumeGraph.html` | 双变量热力图 |
| ROI+销售额分析 | `planReportRoiSaleGraph.html` | 双变量热力图 |
| ROI+销售量分析 | `planReportRoiVolumeGraph.html` | 双变量热力图 |

## 逻辑模块（按需加载对应文件）
| 模块 | 详情文件 | 用途 |
|------|---------|------|
| 工作台 | `references/workbench.md` | 数据空间/方案组/方案 CRUD |
| 方案组维护 | `references/planGroups.md` | 方案组 新建/删除/修改/查找 的真实行为、源码级坑、SOP，配套脚本 `scripts/plan_group_ops.js` |
| 方案维护 | `references/planMetas.md` | 方案 新建/删除/修改/查找 的真实行为、源码级坑、SOP，配套脚本 `scripts/plan_meta_ops.js` |
| 参数维护 | `references/planParams.md` | 方案参数（售价/单量/退款/商品/赠品/费用/广告）数据模型、真实行为、SOP，配套脚本 `scripts/plan_params_ops.js` |
| 数据空间维护 | `references/workspace.md` | 数据空间底层机制、UI 行为真相、体检/修复 SOP（备份由用户自行负责），配套脚本 `scripts/workspace_ops.js` |
| 参数页 | `references/planParams.md` | 方案参数填写 |
| 报告页 | `references/planReport.md` | 利润报告解读，配套脚本 `scripts/plan_report_ops.js` |
| 分析图 | `references/graphs.md` | 6 个敏感性分析图总览 + ROI 图详解，配套脚本 `scripts/plan_report_graph_ops.js` |
| 问答知识库 | `references/qa.md` | ROI/推广/指标的业务口径与概念边界（ROI=输入参数、广告成本受退款+回收影响、推广回报率、ROI 陷阱边界、单渠道理想环境等）——**AI 理解网站 + 向用户解释的统一口径，涉及 ROI/推广时必读** | |