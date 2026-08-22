# ecomskill 版本记录

> 本文件由用户维护，记录版本与变更历史。每次迭代后在「版本历史」表格追加一行，并更新「当前版本」。

## 当前版本

**v1.1.1**（2026-08-20）— 上架准备 + 图例交互 + checklists 重定义（拟上架技能中心）

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
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
