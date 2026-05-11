# 贪吃蛇

一个可以直接部署到 GitHub Pages 的静态贪吃蛇游戏。项目使用原生 HTML、CSS、Canvas 和 ES Modules，不需要 npm、打包器或后端服务。

## 功能特性

- 四档难度：轻松、冲刺、高手、地狱。
- 两种边界模式：可穿墙、不可穿墙。
- 多套蛇身皮肤，皮肤下拉框带颜色预览。
- AI 控制模式，支持贪心、BFS、预判、安全路径、深度学习、强化学习六种算法。
- AI 单局评分系统，用 0-100 分和 S/A/B/C/D 评级比较算法表现。
- 普通果实和奖励果实两种得分来源。
- 音乐与音效开关、暂停、重新开始、触控方向键。
- 最高分、皮肤、墙体模式、AI 算法和 AI 评分记录保存在本地浏览器。
- 自定义 SVG logo 和 favicon。

## 运行方式

因为项目使用了 ES Modules，本地预览时不要直接双击打开 `index.html`。浏览器在 `file://` 协议下会限制模块加载，可能导致页面按钮无响应或脚本无法执行。

推荐在项目根目录启动一个静态服务器：

```bash
python -m http.server 8000 --bind 127.0.0.1
```

然后访问：

```text
http://127.0.0.1:8000/
```

部署到 GitHub Pages 时不需要额外构建，直接推送仓库即可。

## 项目结构

```text
index.html          页面结构、状态栏、设置面板和控制按钮
styles.css          页面布局、下拉框、棋盘、按钮、logo 标题和响应式样式
logo.svg            页面标题旁的主 logo
favicon.svg         浏览器标签页图标
scripts/main.js     游戏入口
scripts/game.js     游戏协调器，串联状态、规则、AI、UI、输入、设置和音频
scripts/config.js   难度、皮肤、方向、穿墙模式、AI 算法等配置
scripts/state.js    默认游戏状态
scripts/rules.js    移动、碰撞、食物、粒子、分数等规则
scripts/score.js    AI 单局评分统计和评级计算
scripts/ai.js       AI 入口，提供 chooseDirection 和 countLegalMoves
scripts/aiAlgorithms.js  贪心、BFS、Lookahead、安全路径、神经网络、强化学习六种 AI 决策算法
scripts/aiShared.js      AI 共用的方向、合法走法、BFS、模拟、距离和可达空间工具
scripts/aiFeatures.js    神经网络和强化学习共用的局面特征、即时奖励计算
scripts/aiNetworks.js    内置神经网络权重和前端推理函数
scripts/render.js   Canvas 绘制
scripts/ui.js       HUD、遮罩层、下拉框和按钮状态同步
scripts/input.js    键盘、触摸、方向按钮输入
scripts/settings.js 设置栏事件绑定
scripts/audio.js    音效和背景音乐
scripts/storage.js  localStorage 读写
```

## 得分规则

基础分由当前难度决定：

```text
轻松：10
冲刺：12
高手：15
地狱：20
```

普通果实获得 `base` 分，奖励果实获得 `base * 3` 分。连击系统已经移除，分数只由果实类型和难度决定。

每吃 5 个果实提升 1 级，速度倍率按 `1 + (level - 1) * 0.1` 计算。例如地狱模式初始为 `20ms` 一步，2 级约为 `20 / 1.1 = 18.18ms` 一步。

## AI 算法

AI 对外入口在 `scripts/ai.js`，游戏主流程只调用：

```js
chooseDirection(state, algorithmName);
countLegalMoves(state);
```

具体算法在 `scripts/aiAlgorithms.js` 中通过注册表维护：

```js
export const aiAlgorithms = {
  greedy: chooseGreedyDirection,
  bfs: chooseBfsDirection,
  lookahead: chooseLookaheadDirection,
  safe: chooseSafePathDirection,
  neural: chooseNeuralDirection,
  reinforcement: chooseReinforcementLearningDirection,
};
```

当前支持：

- 贪心 AI：从合法方向中选择离食物最近的一步。
- BFS 最短路 AI：用 BFS 找到蛇头到食物的最短路径，并执行路径第一步。
- Lookahead AI：对每个合法方向模拟下一步，综合食物距离、可活动空间、未来可选方向、墙边压力和危险状态评分。
- 安全路径 AI：先验证吃到食物后是否还能追到尾巴；不安全时追尾保命，最后选择活动空间最大的合法方向。
- 深度学习 AI：使用内置小型神经网络权重，对食物进度、可活动空间、未来可选方向、尾部可达性、墙边压力等特征做前端推理，并在合法方向中选择分数最高的一步。
- 强化学习 AI：使用内置 Q-value 近似策略，把吃到食物、靠近食物、安全空间、尾部可达性和危险惩罚合成即时奖励，再结合未来价值选择方向。

`state` 包含：

```js
{
  snake,
  foods,
  direction,
  wallMode,
  tileCount
}
```

返回值必须是 `"up"`、`"down"`、`"left"`、`"right"` 之一。

## AI 评分系统

只有开启 AI 控制后，本局结束时才会显示 AI 评分。手动游玩不会显示 AI 评分。

综合评分满分 100，权重如下：

```text
最终得分 35%
生存能力 25%
进食效率 20%
安全控制 15%
稳定性 5%
```

评级规则：

```text
S: 90-100
A: 75-89
B: 60-74
C: 40-59
D: 0-39
```

统计指标包括存活步数、吃到食物数、危险步数、最长未进食步数和死亡原因。评分结果会写入 `localStorage`，用于本地记录不同算法的平均表现。

## 扩展指南

新增难度：

修改 `scripts/config.js` 里的 `difficulties`，并在 `index.html` 增加对应的 `data-difficulty` 按钮。

新增皮肤：

修改 `scripts/config.js` 里的 `skins`，在 `index.html` 增加对应的 `data-skin` 选项，并在 `styles.css` 给 `.skin-option-swatch` 添加预览样式。

新增 AI 算法：

在 `scripts/aiAlgorithms.js` 中新增算法函数，并注册到 `aiAlgorithms`；如果需要共用寻路、距离、模拟等能力，优先从 `scripts/aiShared.js` 引入。然后在 `scripts/config.js` 的 `aiAlgorithms` 增加显示名称，再在 `index.html` 的 AI 下拉菜单里添加对应 `data-ai-algorithm` 选项。

新增模式：

先在 `scripts/config.js` 增加配置，再根据规则复杂度接入 `scripts/rules.js` 或 `scripts/game.js`。

调整评分：

修改 `scripts/score.js` 中的 `ratingWeights` 和各分项计算函数。

## 维护约定

- 配置集中放在 `scripts/config.js`。
- 游戏规则优先放在 `scripts/rules.js`。
- AI 入口保持在 `scripts/ai.js`，具体决策优先放在 `scripts/aiAlgorithms.js`。
- AI 共用工具优先放在 `scripts/aiShared.js`，神经网络权重放在 `scripts/aiNetworks.js`，特征工程放在 `scripts/aiFeatures.js`。
- AI 评分优先放在 `scripts/score.js`。
- DOM 更新优先放在 `scripts/ui.js`。
- 输入和设置事件分别放在 `scripts/input.js`、`scripts/settings.js`。
- `scripts/game.js` 只负责协调流程，尽量不要继续堆大型工具函数。
