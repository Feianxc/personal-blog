# IMAGE2 美术素材库 — FEIAN Signal Lab

生成时间：2026-06-03  
用途：作为个人网站重构的视觉母版，不直接把大图塞进首屏；优先抽取材质、布局、动效和组件语言，再转译成 CSS/SVG/DOM。

## 视觉总纲

- **基底**：graphite / near-black 金属底，带极细工程网格。
- **主色**：橙色代表主动动作与当前轴，青色代表信号流与数据回路，金色代表证据、交付和稳定性。
- **材质**：玻璃罩、金属倒角、低透明雷达线、扫描线、发光节点。
- **构图**：宽屏横向控制台，移动端收敛为卡片化信号板，不让浮动 Dock 遮挡主 CTA。
- **转码策略**：参考图只进 `docs/design/image2/art-library/`；前台页面用轻量 DOM/CSS/SVG 风格实现，避免发布包被 PNG 大图拖慢。

## 素材清单

| 文件 | 角色 | 提炼到前端的部分 |
| --- | --- | --- |
| `asset-01-reactor-core.png` | Reactor 核心主视觉 | 橙色核心、青色环轨、金属外框、英雄区视觉重心 |
| `asset-02-agent-chart.png` | Agent 协作图表 | Signals 区的三轴 tab、波形、协作拓扑、指标卡 |
| `asset-03-field-chart.png` | 工程现场图表 | Field 轴的遥测、异常率、现场链路语义 |
| `asset-04-tools-chart.png` | 自造工具图表 | Tool 轴的工具链节点、交付状态、索引感 |
| `asset-05-build-topology.png` | 构建物拓扑 | Featured build 的 source → core → act → ledger 微型拓扑 |
| `asset-06-route-portal.png` | 路由传送门 | route transition 的光束、碎片、扫描网格 |
| `asset-07-control-dock.png` | 控制 Dock | 底部 machined rail、圆形按钮、Command 触发器 |
| `asset-08-mobile-hero.png` | 移动端 Hero | 紧凑导航、CTA 安全区、移动端图表密度 |
| `asset-09-signal-dashboard-detail.png` | Signals 仪表盘细节 | 本轮新增：可切换 chart panel、波形条、节点图、三指标 |
| `asset-10-build-topology-detail.png` | 构建拓扑细节 | 本轮新增：开源/发布分叉、验证门、交付胶囊 |
| `asset-11-command-dock-detail.png` | Dock 细节 | 本轮新增：底部按钮材质、active glow、键盘入口 |
| `asset-12-mobile-signal-detail.png` | 移动端信号细节 | 本轮新增：移动端信号卡、底部安全区控制条 |

## 已转译的页面模块

1. **Signals chart panel**
   - 文件：`site/index.html`、`site/src/index.css`、`site/src/main.tsx`
   - 从 `asset-02` 与 `asset-09` 抽取三轴 tab、live waveform、拓扑节点、三指标卡。
   - 支持点击和键盘方向键切换，并同步说明文案、指标、颜色和雨幕冲击波。

2. **Selected Builds topology mini**
   - 文件：`site/index.html`、`site/src/index.css`
   - 从 `asset-05` 与 `asset-10` 抽取 source / rules / core / ship / log 拓扑线。
   - Featured build hover/focus 时触发核心脉冲，强调“构建物不是陈列品，而是可验证链路”。

3. **Control dock**
   - 文件：`site/src/global-effects.css`
   - 从 `asset-07` 与 `asset-11` 抽取 machined rail、圆角金属按钮、橙青高光。
   - 桌面端居中为控制轨，移动端保留横向滑动并避开安全区。

## 下一轮可继续转译

- 把 `asset-06-route-portal.png` 的传送门细节继续补到 route transition 的到达态。
- 给 Archive / Workflow 详情页加入轻量 evidence ledger 组件。
- 为开源发布页准备 release capsule / SHA 指纹 / GitHub 状态三联卡。
