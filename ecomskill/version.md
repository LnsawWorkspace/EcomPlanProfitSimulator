# ecomskill 版本记录

> 本文件由作者维护，记录版本与变更历史。每次迭代后在「版本历史」表格追加一行，并更新「当前版本」。

## 当前版本

**v1.1.3**（2026-08-23）— 支出"基于"选择修复 + ROI 读图体系完善 + 文档清理

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.1.3 | 2026-08-23 | **脚本修复**：支出"基于"（base）选择——站点在 shown.bs.modal 后才填充选项，脚本改为等选项就绪再选（新增 selectExpenseBase）；Fixed 模块 base 选项无"售价"（是 付款金额/销售金额/收入/利润），per 类型默认选"利润"，--expense-fixed 支持第 5 项指定基于。**ROI 读图体系**：保本 ROI 三步法（增长率尖峰秒判→过零点确认→粗扫+精扫逼近）、保本 ROI 是"逼近值"非精确点（离散步进）、色带按增长率划分（红区=利润快速增长期=该提 ROI，非亏赚）、色带固定按 0.1 步进计算、7 条图例用途速览（源码 yAxisIndex 核对：左轴=利润/广告，右轴=各率+增长金额）、双 y 轴量程压制、"给平台打工"分界线彩蛋、ROI 非越高越好（成交量反噬+边际递减，用 ROI×单量热力图）。**文档清理**：MD 去掉脚本实现细节（只留业务口径/接口/红线）、去掉"日期+作者"署名、称呼区分（作者=创建者/用户=技能使用者/电商顾客=消费者，系统术语"用户工作区"保留）。**checklists**：手续费类默认归部分订单支出（订单比例=支付方式占比）、部分退款用部分订单支出近似模拟（税率跟销项走，补贴/小额打款税率 0）。**外部依赖**：加 Python（建议有，AI 辅助解析用，SKILL 本体不需要）。SKILL.md/version.md/manifest.yaml 版本三处同步 |
| v1.1.2 | 2026-08-22 | 新增 `references/qa.md` 问答知识库（ROI=GMV÷推广成本口径、与平台 ROI 对比需换算、引导关注推广回报率、ROI 陷阱=自然成交变推广成交、单渠道理想环境）；Skill.md 核心约定加 ROI 知识红线，6 图逐页详解压缩为速查表、数据空间≠系统库压缩指向 workspace.md；planParams/planReport/graphs/workbench 四文档同步 ROI 指针；清除全库除法 bug 内容；新增根目录「人类请读我.md」（给人类看的说明，AI 不读）；SKILL.md/version.md/manifest.yaml 版本三处同步。同日补充：GMV 口径明确为付款金额（不扣退款），说明本站暂不显示"实际 ROI"（后期添加），GMV 代表不了利润、建议看推广回报率 |
| v1.1.1 | 2026-08-20 | 上架材料（manifest.yaml + 512×512 图标 icon-ecomskill.png + beta 标注）；图例交互（--show-series 只看指定曲线，避开量程压制）；渠道 checklists 库重定义（按渠道 XX-XX-checklist.md）；SKILL.md/version.md/manifest.yaml 版本三处同步 |
| v1.1.0 | 2026-08-20 | 6 个敏感性分析图全部接入（roi/sale/volume 折线 + salevolume/roisale/roivolume 热力图）；报告与各图"读法→结论→洞察→动作"分析模板沉淀；调优完整流程（报告+6图→改参→验证）；SKILL.md 介绍/description 面向 AI 优化 |
| v1.0.0 | 2026-08-20 | 功能基线（见下） |

---

## 功能基线（v1.0.0）

| 模块 | 脚本 | 文档 |
|------|------|------|
| 数据空间维护 | `scripts/workspace_ops.js` | `references/workspace.md` |
| 方案组维护 | `scripts/plan_group_ops.js` | `references/planGroups.md` |
| 方案维护 | `scripts/plan_meta_ops.js` | `references/planMetas.md` |
| 参数维护 | `scripts/plan_params_ops.js` | `references/planParams.md` |
| 报告页 | `scripts/plan_report_ops.js` | `references/planReport.md` |
| 敏感性分析图 | `scripts/plan_report_graph_ops.js`（roi / sale / volume / salevolume / roisale / roivolume） | `references/graphs.md` |
| 工作台 | — | `references/workbench.md` |
| 渠道支出清单 | — | `extension/checklists/`（按渠道 `XX-XX-checklist.md`，如 拼多多通用checklist.md） |

## 待办

- 站点已知问题（供参考，修复在站点源码侧，不由本技能处理）：报告页「收入明细」表为弃用残留；0退款率计算未含部分订单支出行内退款率 → 利润损失被低估。

---

## 新增版本模板

```markdown
| vX.Y.Z | YYYY-MM-DD | 一句话概括本次变更 |
```
