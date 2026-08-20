# 方案敏感性分析图（Graphs）

> 本模块是 ecomskill 的逻辑子模块之一，公共规则见根目录 `Skill.md`；报告页见 `planReport.md`。
> 站点方案报告页提供 6 个敏感性分析图按钮（4 个单变量 + 3 个双变量中的 1 个"Roi"系列 + 2 个"价格"系列），本文先详解 **ROI 曲线图**（`planReportRoiGraph.html`），其他图后续按需补充。
> 本文所有结论均来自 2026-08-20 对"拼多多推广"方案（售价 139.9/1000单/退款 8%/ROI 4/睡衣+睡裤）的真机实测 + `page/planReport/js/planReportRoiGraph.js`（788 行）源码核对。

---

## 0. 共同前提

- **依赖广告投放**：报告页的 ROI 类图表按钮（ROI / 售价+单量 / ROI+售价 / ROI+单量）只有方案设置了广告（`planParams.advertising.name` 非空）才会打开；否则 toast「该方案未设置广告投放，无法查看 XX 图表」。脚本要先确认 `plan_params_ops raw <方案>` 的 `advertising.name`。
- **URL 三参数**：所有分析图页都是 `?workspaceId=&groupId=&planId=` 强依赖。
- **计算量控制**：双变量图慢（1万点位约 30~40s，见报告页 SKILL.md）；单变量相对快，但**步数仍受页面限制**（ROI 1~10 步长 0.1 = 91 点很顺；扫描范围过大时单图可能也慢）。读脚本里 `roi-graph-end - roi-graph-start / step` 即估算点数。
- **dataZoom 滑条（所有分析图都有）**：除了改参数范围，每张图上还有 **ECharts 的 dataZoom 组件**（图底部/右侧可拖动的区间缩放滑条）——拖动它可以直接放大看局部区间，不用重新计算。脚本通过 `option.dataZoom` 输出当前缩放范围（如 `{type:'slider', start:0, end:100}`）。
  **主动缩放**：脚本支持 `--zoom-start 0 --zoom-end 40`（百分比 0-100）——先 `dispatchAction({type:'dataZoom', start, end})` 缩放再截图，用于放大看局部；**双变量图点位非常密集，光靠调参数范围可能不够，配合 dataZoom 放大是标准做法**（只影响显示/截图，不改底层数据）。
- **页面不开自动重新生成**：页面打开后用方案当前的"售价/单量"预填输入框，但 ROI 范围（开始/步长/结束）固定默认 1/0.1/10；改范围后要点"重新生成分析图"才会重算。

---

## 1. ROI 曲线图（`planReportRoiGraph.html`）

### 1.1 怎么进去

- **报告页按钮**：方案报告页（`planReport.html`）"ROI分析图"按钮 → `window.open('planReportRoiGraph.html?workspaceId=&groupId=&planId=')`。前提：方案设了广告。
- **URL 直连**：直接拼 `planReportRoiGraph.html?workspaceId=&groupId=&planId=` 也可。

### 1.2 页面结构（实测）

```
┌ 紫色 header：ROI曲线图 + 面包屑（数据空间 -> 方案组 -> 方案）
├ 控制栏：
│   售价 #roi-graph-salePrice     单量 #roi-graph-orderQuantity
│   开始 #roi-graph-start（默认 1）  步进 #roi-graph-step（默认 0.1）  结束 #roi-graph-end（默认 10）
│   [重新生成分析图] #roi-graph-generate-btn
├ 图例 legend（6 条线 + 动态加的"广告:XX"）：
│     利润 / 利润率 / 资本回报率 / 推广回报率 / 利润增长金额 / 利润增长率
│     默认显示"利润"+"利润增长率"，其余图例可点选切换
├ 双 y 轴图（ECharts 6 + ecStat）：
│     x 轴 = ROI（推广投入产出比）
│     左 y 轴 = 元（利润 / 利润率 / 资本回报率 / 推广回报率）
│     右 y 轴 = 增长率（利润增长金额 / 利润增长率）
│     背景按"利润增长率档位"涂色带（markArea）
└ （无独立明细表，所有数据在曲线里）
```

### 1.3 真实行为 / 怎么算

**操作规则（2026-08-20 用户明确）**：页面上的「开始 / 步进 / 结束」三个输入框**都是 ROI 的值**；「售价」「单量」输入框默认预填方案当前值，**也可以临时改——只影响本次图，不落库、不改方案参数**（页面是独立沙盒，可快速对比不同售价/单量下的 ROI 曲线，改完关掉页面即恢复）。

- **ROI 步进精度可到 0.0001**，但精度越高 → 扫描点数越多 → 算力消耗越高。**必须缩小区间范围来降低计算次数**：`计算次数 = (结束 − 开始) / 步进 + 1`。
- 例：1~10、步进 0.1 → 91 点（快）；1~2、步进 0.0001 → 10,001 点（慢）。**建议控制在 1 万以内**，脚本会估算并警示。
- 调整后**必须点「重新生成分析图」按钮**（#roi-graph-generate-btn）才会重算。

`#refreshReport()` 流程（`planReportRoiGraph.js:188-380`）：

1. 读输入框，**校验**（开始/步长/结束必须正数，结束 > 开始，否则回填为 开始+步长）。
2. 按步长扫描 ROI，**每个 ROI 用 `SimulationCore.runSimulation()` 重算一份报告**（data[i]，数组）。
3. 算"利润增长金额 / 利润增长率"：相邻点差除以前点利润（取绝对值）。
4. **`resampleToStep`** 把结果重采样到步长 0.1（保证显示点数稳定，与原始步长解耦）。
5. **markArea 着色带**：找利润增长率的 6 个"档位点"（10% / 8% / 6% / 4% / 2% / 0%）对应的 ROI 索引，把 ROI 区间分为 5 段色带，标识"成长质量"：
   - 严重(+10%) 红色 rgba(255,0,0,0.3) — 利润率低位
   - 不良(+6%) 橙色 rgba(255,165,0,0.3)
   - 一般(+2%) 黄色 rgba(255,215,0,0.3)
   - 良好(+1%) 浅绿 rgba(173,255,47,0.3)
   - 优秀(+0%) 深绿 rgba(50,205,50,0.3)
   - 卓越(+0) 收尾色（实际数据一般不会触发，注释保留）

### 1.4 怎么读

- **x 轴 ROI = 推广投入产出比**（每 1 元广告费能带回来的销售额）。ROI 越高 = 广告越划算。
- **左 y 轴（元 / %）**：看利润曲线（默认显示）随 ROI 单调上升 → 广告越划算利润越高；找利润 = 0 的 ROI 点 = **保本 ROI**。
- **右 y 轴（增长率）**：看利润增长率曲线（默认显示）——每提高 0.1 个 ROI，利润能再涨多少（绝对值的相对比例）。一般从低 ROI 的高峰（基数小）逐渐下降到高 ROI 的接近 0（边际递减）。
- **色带**：落在哪个色带 = 该 ROI 区间的"成长质量评级"。红区是亏 / 增长差的区间，越往绿色越健康。

### 1.5 怎么分析

实际看"拼多多推广"方案（售价 139.9/1000单/退款 8%）的 ROI 曲线，91 个点（1.0→10.0，步长 0.1）：

- **保本 ROI ≈ 2.2**（利润曲线过零点）：ROI < 2.2 全亏，> 2.2 开始盈利。
- **利润峰值 ≈ +4.5 万元**（ROI ≈ 5 之后，曲线趋平）。
- **色带分布**：ROI 1~2 严重红区、2~3 严重+不良、3~3.4 一般、3.4~4.4 良好、4.4+ 优秀。
- **ROI 4**（用户当前参数）：落在"良好"浅绿区，资本回报率 31% — 合理但非最优。
- **结论**：方案在 ROI 4.4 以后才进入"优秀"深绿区，但利润增量已很小（边际递减），**ROI 4~4.5 是性价比拐点**。

### 1.6 关键坑

1. **页面打开后不会自动改范围**：默认 ROI 1~10 步长 0.1；要扫不同范围（如 0.5~3）必须手动改输入框 + 点"重新生成"。脚本可以代为 fill + click。
2. **不依赖广告就看不到**：脚本 read 前先 `plan_params_ops raw <方案>` 查 `advertising.name`，空就跳过并提示。
3. **双 y 轴容易看错量级**：左轴是元 / %绝对值，右轴是增长率（小数）。脚本输出摘要时**必须标清单位**。
4. **markArea 色带在数据上需要找全档位**：若曲线在 ROI 1~10 都没出现 10%/8% 等档位（极端情况），色带会少。脚本读 option 时**按实际存在输出**。

### 1.7 入口 DOM 速查（脚本用）

| 元素 | id | 用途 |
|------|----|------|
| 售价输入 | `#roi-graph-salePrice` | 预填方案售价 |
| 单量输入 | `#roi-graph-orderQuantity` | 预填方案单量 |
| ROI 开始 | `#roi-graph-start` | 默认 1 |
| ROI 步长 | `#roi-graph-step` | 默认 0.1 |
| ROI 结束 | `#roi-graph-end` | 默认 10 |
| 重新生成按钮 | `#roi-graph-generate-btn` | 修改范围后必点 |
| 图表容器 | `#roi-graph-container` | 内部有 ECharts canvas |
| 隐藏页面 | `#hidePage` | 三参数缺失时显示 |

**ECharts 数据读取**：`window.echarts.getInstanceByDom(document.getElementById('roi-graph-container'))` 拿实例，`.getOption()` 拿 `xAxis[0].data`（ROI 数组）和 `series[].data`（各曲线二维数组 [ROI值, 数据]）；markArea 在 `series[].markArea.data`（分段区间）。

---

## 2. 售价分析图（`planReportSaleGraph.html`）

### 2.1 怎么进去

- 报告页「售价分析图」按钮 → `window.open('planReportSaleGraph.html?workspaceId=&groupId=&planId=')`；URL 直连也可。
- 与 ROI 图不同：售价图**不依赖广告也能打开**，但**没设广告时 ROI 输入框被站点禁用**（锁定为 0/空，图没有意义）；设了广告则 ROI 预填方案值且可临时改。

### 2.2 页面结构（实测）

```
┌ header：售价分析图 + 面包屑
├ 控制栏：
│   ROI #sale-graph-roi（预填方案广告 ROI，可临时改；没广告=disabled）
│   单量 #sale-graph-orderQuantity（预填方案单量）
│   开始 #sale-graph-start（自动设 0）  步进 #sale-graph-step（自动）  结束 #sale-graph-end（自动=初始售价×2）
│   [重新生成分析图] #sale-graph-generate-btn
├ 图例（7 条：利润/利润率/资本回报率/推广回报率/利润增长率/利润增长金额 + 动态"广告:XX"）
├ 双 y 轴 ECharts 图（#sale-graph-container）：x=售价，左 y=元/%（利润、回报率），右 y=增长率
└ **无 markArea 色带**（与 ROI 图不同，实测确认）
```

### 2.3 真实行为 / 怎么算

- **固定 ROI（可临时改）、固定单量（可临时改），扫描售价**：开始=0、结束=初始售价×2、步进自动。
- **步进自动归一为 1/2/5×10ⁿ**（0.1/0.2/0.5/1/2/5/10…）：`saleStep = 范围/1000` 后取最近的 1/2/5×10ⁿ，保证点数 ≤1000（源码注释：避免 X 轴标签难看）。**售价步进是 1 位小数的 1/2/5 制**（用户手填任意值也行，但推荐 0.5/1/2/5 这类）。
- 计算逻辑同 ROI 图：每个售价点 `SimulationCore.runSimulation()` 重算，利润增长率=相邻点差/前点利润（绝对值），`resampleToStep` 重采样 0.1。

### 2.4 怎么读

- x=售价、y 左=利润/回报率、y 右=增长率；**找利润=0 的售价 = 保本售价**。
- 曲线一般单调上升（ROI 固定时提价增收）：售价越低越亏（甚至售价 0 附近利润率 -133 倍夸张值），售价越高利润越大。
- **用途：快速看"不同售价下的盈利性"**——不落库临时改售价（--sale-price 是 ROI 图用的；本图用 --roi/--start/--end/--step），对比保本售价与当前售价的差距 = 安全边际。

### 2.5 实测（拼多多推广，ROI=4/1000单）

- 559 点：售价 0.5 → 279.5，步长 0.5（自动，因 139.9×2=279.8）
- **保本售价 = 93.5 元**（利润 9.27）——当前售价 139.9 远超保本点，ROI 4 假设下可降价空间约 46 元
- 利润序列：售价 0.5 → −54,495，售价 279.5 → +109,017；资本回报率 0.5 → −99% 起步，279.5 → +92%
- 与 ROI 图互证：售价 139.9 时保本 ROI 2.2；ROI 4 时保本售价 93.5

### 2.6 坑

1. **无 markArea**：不要像 ROI 图一样期待色带。
2. **没广告 ROI 锁定**：sale 命令仍会读 advertising 并在输出注明「未设广告，ROI 锁定」；没广告时图无意义。
3. **步进别用太小**：默认自动 1/2/5 制；手填 0.01 且范围大 → 点数暴涨（计算次数=(结束−开始)/步长+1，脚本会警示 >1 万）。
4. 输入框 id 前缀 `sale-graph-`，与 ROI 图 `roi-graph-` 不同，脚本已按类型区分。

### 2.7 DOM 速查

| 元素 | id | 说明 |
|------|----|------|
| ROI | `#sale-graph-roi` | 预填方案广告 ROI，可临时改；没广告 disabled |
| 单量 | `#sale-graph-orderQuantity` | 预填方案单量 |
| 售价 开始/步进/结束 | `#sale-graph-start` / `#sale-graph-step` / `#sale-graph-end` | 自动 0 / 1-2-5制 / 售价×2 |
| 重新生成 | `#sale-graph-generate-btn` | 改参数后必点 |
| 图表容器 | `#sale-graph-container` | ECharts canvas |

---

## 3. 单量分析图（`planReportVolumeGraph.html`）

### 3.1 怎么进去

- 报告页「单量分析图」按钮 → `window.open('planReportVolumeGraph.html?workspaceId=&groupId=&planId=')`；URL 直连也可。
- 广告依赖同售价图：无广告时 ROI 输入框 disabled（图无意义）；设了广告则 ROI 预填方案值且可临时改。

### 3.2 页面结构（实测）

```
┌ header：单量分析图 + 面包屑
├ 控制栏：
│   ROI #volume-graph-roi（预填方案广告 ROI，可临时改；没广告=disabled）
│   售价 #volume-graph-salePrice（预填方案售价）
│   开始 #volume-graph-start（默认 10）  步进 #volume-graph-step（默认 1）  结束 #volume-graph-end（默认 1000）
│   [重新生成分析图] #volume-graph-generate-btn
├ 图例（4 条：利润/利润率/资本回报率 + 动态"广告:XX"）——**没有增长率序列**（与 ROI/售价图不同）
├ 双 y 轴 ECharts 图（#volume-graph-container）：x=单量，左 y=元/%（利润、利润率、资本回报率）
└ **无 markArea 色带**（实测确认）
```

### 3.3 真实行为 / 怎么算

- **固定 ROI（可临时改）、固定售价（可临时改），扫描单量**：默认 start=10、step=1、end=1000。
- **步进最小 1（整数）**：源码 `if (saleStep.lt(1)) saleStep = 1`（213-216 行强制），单量没有小数步进。
- 计算逻辑同其他图：每个单量点 `SimulationCore.runSimulation()` 重算；序列只有 利润/利润率/资本回报率 + 广告（无利润增长率——源码 series 里没有）。

### 3.4 怎么读

- x=单量、y 左=利润/利润率/资本回报率；**找利润=0 的单量 = 保本单量**。
- 曲线一般单调上升（固定 ROI/售价下，规模效应：固定支出如店铺月租被摊薄，单量越大利润越高）。
- **用途**：看"卖多少单才能保本/达到目标利润"，验证目标单量是否合理。

### 3.5 实测（拼多多推广，ROI=4/139.9）

- 991 点：单量 10 → 1000，步长 1
- **保本单量 = 15 单**（利润 9.64）——极低，说明 ROI 4 下该定价几乎卖一单赚一单（固定月租 300 被快速摊薄）
- 利润序列：10 单 → −154，1000 单 → +27,203（当前方案 1000 单利润 27,203，与报告页一致，闭环）
- 资本回报率：10 单 → −15%，1000 单 → +31.4%（与报告页 31.38% 一致）

### 3.6 坑

1. **无增长率序列、无 markArea**：不要期待 ROI/售价图那些曲线。
2. **步进最小 1**：填 0.5 会被页面强制回 1。
3. 输入框 id 前缀 `volume-graph-`。

### 3.7 DOM 速查

| 元素 | id | 说明 |
|------|----|------|
| ROI | `#volume-graph-roi` | 预填方案广告 ROI，可临时改；没广告 disabled |
| 售价 | `#volume-graph-salePrice` | 预填方案售价 |
| 单量 开始/步进/结束 | `#volume-graph-start` / `#volume-graph-step` / `#volume-graph-end` | 默认 10 / 1 / 1000，步进最小 1 |
| 重新生成 | `#volume-graph-generate-btn` | 改参数后必点 |
| 图表容器 | `#volume-graph-container` | ECharts canvas |

---

## 4. 售价×单量分析图（`planReportSaleVolumeGraph.html`，双变量 heatmap）

### 4.1 怎么进去

- 报告页「售价和销量分析图」按钮 → `window.open(...)`；URL 直连。
- 双变量图，依赖广告（无广告时 ROI 锁定）；计算量 = 售价点数 × 单量点数，**点位密集**。

### 4.2 页面结构（实测）

```
┌ header：售价和销量分析图 + 面包屑
├ 控制栏（9 个输入框 + 重新生成）：
│   ROI         #sale-graph-roi           预填方案 ROI
│   最小利润    #min-profit               利润过滤下界（默认 0）
│   最大利润    #max-profit               利润过滤上界（默认 10000）
│   售价开始    #sale-graph-start         默认 initialSale*0.5（用户改过：缩小）
│   售价步进    #sale-graph-step          默认 adjustedStep（1/2/5×10ⁿ）
│   售价结束    #sale-graph-end           默认 initialSale*1.5（用户改过：缩小）
│   单量开始    #volume-graph-start       默认 payOrderQuantity-500（用户改过）
│   单量步进    #volume-graph-step         默认 100（用户改过：减少节点）
│   单量结束    #volume-graph-end         默认 payOrderQuantity+500
│   [重新生成分析图] #saleAndVolume-graph-generate-btn
│   [显示选择的利润范围]（按钮，联动 min/max-profit）
├ 图表：ECharts **heatmap**（不是折线！）—— 容器 #saleAndVolume-graph-container
│   x 轴=售价、y 轴=单量、色块=利润
│   左下角 visualMap 色阶（蓝→紫→红→黄，从低到高利润）
│   **无 dataZoom 滑条**（与单变量图不同）——用户改默认参数就是为了减少节点
└ （无其他控件）
```

### 4.3 真实行为 / 怎么算

- 用户修改的默认参数（2026-08-20 实测）：售价范围 `initialSale*0.5 ~ initialSale*1.5`、单量 `±500 步长 100`。相比原先的"售价 0~×2、单量大范围步长 10"，**默认从可能上万节点降到 ~300**，代价是首次打开范围较窄。
- 调整参数按需**主动调大范围**重新计算（如 `--sale-start 0 --sale-end 300 --vol-start 0 --vol-end 3000`）；脚本就是干这事的。
- 步进：售价同售价图（1/2/5×10ⁿ 归一）、单量同单量图（最小 1，默认 100）。
- 数据是 `[[x, y, profit]...]` 矩阵。
- **利润范围过滤（用户惯用操作，不是缩放）**：`min-profit` / `max-profit` + 「显示选择的利润范围」按钮（`#saleAndVolume-graph-show-selected-btn`）——点击后直接 `setOption({visualMap: {range:[min,max]}})`，**把不在该利润区间的格子变成没有颜色**，**不重新计算、不放大/缩小可视化区域**（改动瞬间生效）。改售价/单量范围才需要点「重新生成分析图」。
- 脚本配合：只传 `--min-profit/--max-profit` 时自动点「显示选择的利润范围」（不重算、快速）；同时传了售价/单量参数则走重新生成。

### 4.4 怎么读

- **色块颜色**=利润高低（visualMap 左下色阶）；**位置**=（售价, 单量）组合。
- **核心读法**：找"最大利润点"（色最暖/最深红）和"保本边界"（色块从蓝/紫过渡到红的等高线，即利润=0 的轨迹）；**盈利区域占比** 量化"多大范围能盈利"。
- **过滤操作**：用 `min-profit/max-profit` + 「显示选择的利润范围」只看目标利润区间的格子（如只看 3万~6万 利润的组合），范围外格子无色。它**不是区域缩放**，不能放大缩小可视化坐标区。

### 4.5 实测

**默认范围（售价 69.95~204.95×单量 500~1500, 28×11=308 点）**：
- 最大利润：售价 204.95 × 单量 1500 = **+98,131**
- 最小利润：售价 69.95 × 单量 1500 = **−20,547**
- 盈利占比：**82.1%（253/308）**
- 结论：当前方案（ROI 4）在用户默认范围内大部分组合可盈利，亏损只在低价区（< ~90 元）

**自定义聚焦（售价 99.9~179.9 步长 10 / 单量 800~1200 步长 100, 9×5=45 点）**：
- 全部 45 点都盈利，**最低 2,952 / 最高 60,831**
- 结论：聚焦到合理定价+合理单量区间，纯盈利且利润 3k~60k 区间

### 4.6 坑

1. **首次打开范围可能不够**（用户为减少节点改了默认），需要**主动调参**重新计算——这是本脚本最常见的用途。
2. **"显示利润范围"不是缩放**：`min-profit/max-profit` + 按钮只把范围外的格子变无色（visualMap range），**不重新计算、不能放大缩小坐标区**。想看更广/更细的坐标区域必须改售价/单量范围 + 重新生成。
3. **输入框 id 不统一**：售价/ROI 用 `sale-graph-*` 前缀，单量用 `volume-graph-*` 前缀（不是 bug，是历史遗留）；脚本 GRAPHS.salevolume 用显式 `idMap` 处理。
4. 计算量 = 售价步数 × 单量步数；308 点实测 ~10s；**>1 万点要警示**。

### 4.7 DOM 速查

| 元素 | id | 说明 |
|------|----|------|
| ROI | `#sale-graph-roi` | 预填方案 ROI |
| 利润过滤 | `#min-profit` / `#max-profit` | 视觉过滤；可用 `--min-profit/--max-profit` 改 |
| 售价 | `#sale-graph-start` / `-step` / `-end` | 默认 ×0.5~×1.5 |
| 单量 | `#volume-graph-start` / `-step` / `-end` | 默认 ±500 步长 100 |
| 重新生成 | `#saleAndVolume-graph-generate-btn` | 改售价/单量范围后必点（重算） |
| 显示选择的利润范围 | `#saleAndVolume-graph-show-selected-btn` | 改 min/max-profit 后点（只过滤格子，不重算） |
| 图表容器 | `#saleAndVolume-graph-container` | ECharts canvas（heatmap） |

---

## 5. 售价×ROI 分析图（`planReportRoiSaleGraph.html`，双变量 heatmap）

### 5.1 怎么进去

- 报告页「ROI和售价分析图」按钮 → `window.open(...)`；URL 直连。
- 双变量 heatmap，依赖广告；计算量 = 售价点数 × ROI 点数。

### 5.2 页面结构（实测）

```
┌ header：ROI和售价分析图 + 面包屑
├ 控制栏：
│   单量        #volume-graph         预填方案单量（⚠ 命名是历史遗留，这是单量不是单量图）
│   最小/最大利润 #min-profit / #max-profit   利润过滤
│   售价        #sale-graph-start / -step / -end   默认 ×0.5~×1.5（用户改过）
│   ROI         #roi-graph-start / -step / -end    默认 ×0.5~×1.5 步长 0.1（用户改过）
│   [重新生成分析图] #saleAndVolume-graph-generate-btn（与 salevolume 复用同一 id）
│   [显示选择的利润范围] #saleAndVolume-graph-show-selected-btn（复用）
├ 图表：ECharts heatmap，容器 #saleAndVolume-graph-container（复用）
│   x 轴=ROI、y 轴=售价、色块=利润；左下 visualMap 色阶；无 dataZoom
└ 利润过滤操作同 salevolume（visualMap range，范围外无色，不缩放区域）
```

### 5.3 真实行为 / 怎么算

- 用户改的默认参数（2026-08-20 实测）：售价 `×0.5~×1.5`（step 1/2/5 制）、ROI `×0.5~×1.5`（step 0.1）。当前方案（139.9/ROI4/1000单）默认 = 售价 70~210 step 5 × ROI 1.82~5.45 step 0.1 → **29×37=1073 点**（比 salevolume 的 308 多，用户说"变快但效果有限"——因为 ROI 步长 0.1 点数仍多）。
- 双变量 heatmap，数据 `[[x=ROI, y=售价, profit]...]`；利润过滤同 salevolume（`--min-profit/--max-profit` → 点「显示选择的利润范围」，不重算）。

### 5.4 怎么读

- x=ROI、y=售价：看"什么 ROI 配什么售价"组合的利润；**盈利占比** 衡量组合空间。
- 实测默认范围：盈利 **73.4%**（787/1073）；最大 X=ROI 5.42 × Y=售价 210 → +80,743；最小 ROI 1.82 × 70 → −32,747。ROI ≥ ~2.5 且售价 ≥ ~120 基本盈利。
- 自定义聚焦（售价 100~180 step 10 / ROI 2~6 step 0.2）：189 点，盈利 89.4%，利润 −18,823 ~ +64,289。

### 5.5 坑

1. **输入框命名混乱**：单量输入框 id 是 `#volume-graph`（沿用单量图命名）；按钮/容器 id 与 salevolume **完全相同**（`#saleAndVolume-graph-*`）——**同页面对应不同的业务图**，脚本按 GRAPHS 配置区分，不要凭 id 猜。
2. **ROI 步长 0.1 让点数仍多**：想快就加大 ROI 步长（0.2/0.5）或缩 ROI 范围；网格 >1 万警示。
3. 利润过滤不重算（同 salevolume）。

### 5.6 DOM 速查

| 元素 | id | 说明 |
|------|----|------|
| 单量 | `#volume-graph` | 预填方案单量（命名历史遗留） |
| 利润过滤 | `#min-profit` / `#max-profit` | `--min-profit/--max-profit` |
| 售价 | `#sale-graph-start/-step/-end` | `--sale-start/--sale-end/--sale-step` |
| ROI | `#roi-graph-start/-step/-end` | `--roi-start/--roi-end/--roi-step`（步进可 0.0001） |
| 重新生成 | `#saleAndVolume-graph-generate-btn` | 改售价/ROI 后重算 |
| 显示利润范围 | `#saleAndVolume-graph-show-selected-btn` | 只过滤格子，不重算 |
| 图表容器 | `#saleAndVolume-graph-container` | heatmap |

---

## 6. ROI×单量分析图（`planReportRoiVolumeGraph.html`，双变量 heatmap）

### 6.1 怎么进去

- 报告页「ROI和销量分析图」按钮 → `window.open(...)`；URL 直连。
- 双变量 heatmap，依赖广告；计算量 = ROI 点数 × 单量点数。

### 6.2 页面结构（实测）

```
┌ header：ROI和销量分析图 + 面包屑
├ 控制栏：
│   售价        #sale-graph         预填方案售价（固定，可临时改；⚠ id 是历史遗留命名）
│   最小/最大利润 #min-profit / #max-profit   利润过滤
│   ROI         #roi-graph-start / -step / -end    默认 ×0.5~×1.5 步长 0.1（用户改过，2026-08-20 部署）
│   单量        #volume-graph-start / -step / -end  默认 ±500 步长 100（用户改过）
│   [重新生成分析图] #saleAndVolume-graph-generate-btn（复用 id）
│   [显示选择的利润范围] #saleAndVolume-graph-show-selected-btn（复用）
├ 图表：ECharts heatmap，容器 #saleAndVolume-graph-container（复用）
│   x 轴=ROI、y 轴=单量、色块=利润；左下 visualMap；无 dataZoom
└ 利润过滤操作同 §4（visualMap range，范围外无色，不缩放区域）
```

### 6.3 真实行为 / 怎么算

- **默认参数（用户 2026-08-20 改后部署）**：ROI `×0.5~×1.5`（step 0.1）、单量 `±500`（step 100）→ 当前方案（139.9/ROI4/1000单）默认 = ROI 1.82~5.45 × 单量 500~1500 → **37×11=407 点**。
- 改参数前默认是 ROI 0~10 × 单量 0~1000（步长 0.1/10）= **1 万点**（最慢的图，实测要 30~40s+）；用户改后首次打开快很多。
- 数据 `[[x=ROI, y=单量, profit]...]`；利润过滤同 salevolume。

### 6.4 怎么读

- x=ROI、y=单量：看"什么 ROI 配什么单量"的利润；盈利占比衡量组合空间。
- 实测默认范围：盈利 **89.2%**（363/407）；最大 ROI 5.42 × 单量 1500 → +53,394；最小 ROI 1.82 × 单量 1500 → −15,966。**单量 500 时 ROI ≥ 3 就盈利**（角落采样 X=5.42/Y=500 → +17,610），ROI 低时必须靠大单量对冲。
- 与报告页闭环：ROI 4 × 单量 1000（当前方案）落在盈利区（报告页利润 +27,203）。

### 6.5 坑

1. **这是最慢的图**（默认曾 1 万点）：脚本默认等 120s；建议按需缩小范围/加大步长（如 ROI 步长 0.2、单量步长 200）。
2. 输入框 id 复用/历史遗留同 §5（售价输入框 `#sale-graph`）；按钮/容器与 salevolume/roisale 完全相同，脚本按 GRAPHS 配置区分。
3. 利润过滤不重算（同 §4）。

### 6.6 DOM 速查

| 元素 | id | 说明 |
|------|----|------|
| 售价 | `#sale-graph` | 固定，预填方案售价（命名历史遗留） |
| 利润过滤 | `#min-profit` / `#max-profit` | `--min-profit/--max-profit` |
| ROI | `#roi-graph-start/-step/-end` | `--roi-start/--roi-end/--roi-step` |
| 单量 | `#volume-graph-start/-step/-end` | `--vol-start/--vol-end/--vol-step` |
| 重新生成 | `#saleAndVolume-graph-generate-btn` | 改 ROI/单量后重算 |
| 显示利润范围 | `#saleAndVolume-graph-show-selected-btn` | 只过滤格子，不重算 |
| 图表容器 | `#saleAndVolume-graph-container` | heatmap |

---

## 7. 总览（6 个图全部支持，2026-08-20）

| 图 | 页面 | 类型 | 扫描变量 | 默认范围（当前方案） | 命令 |
|----|------|------|---------|---------------------|------|
| ROI 曲线图 | `planReportRoiGraph.html` | line | ROI | 1~10 步长 0.1（91 点） | `roi` |
| 售价分析图 | `planReportSaleGraph.html` | line | 售价 | 0~售价×2 步长 1/2/5 制 | `sale` |
| 单量分析图 | `planReportVolumeGraph.html` | line | 单量 | 10~1000 步长 1（991 点） | `volume` |
| 售价×单量 | `planReportSaleVolumeGraph.html` | heatmap | 售价×单量 | ×0.5~×1.5 / ±500（308 点） | `salevolume` |
| 售价×ROI | `planReportRoiSaleGraph.html` | heatmap | 售价×ROI | ×0.5~×1.5 / ×0.5~×1.5（1073 点） | `roisale` |
| ROI×单量 | `planReportRoiVolumeGraph.html` | heatmap | ROI×单量 | ×0.5~×1.5 / ±500（407 点） | `roivolume` |

- 公共：依赖广告（ROI 系列）、输入框=临时沙盒、dataZoom（单变量）/利润范围过滤（heatmap）、计算量估算警示、只读+截图。
