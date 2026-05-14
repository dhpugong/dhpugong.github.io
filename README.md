# 导航页

一个可以直接部署到 GitHub Pages 的静态导航页。根路径用于展示项目入口，当前已上线的项目包括 AI 贪吃蛇和火柴人对抗，后续会继续加入神经网络 Playground 和强化学习迷宫等实验。

站点使用原生 HTML、CSS、Canvas 和 ES Modules，不需要 npm、打包器或后端服务。

## 在线路径

```text
https://dhpugong.com/              导航页
https://dhpugong.com/snake/        AI 贪吃蛇
https://dhpugong.com/stick-fight/  火柴人对抗
```

首版项目展示包含：

- AI 贪吃蛇：可体验
- 火柴人对抗：可体验
- 神经网络 Playground：计划中
- 强化学习迷宫：计划中

## AI 贪吃蛇功能

- 四档难度：轻松、冲刺、高手、地狱。
- 两种边界模式：可穿墙、不可穿墙。
- 多套蛇身皮肤，皮肤下拉框带颜色预览。
- AI 控制模式，支持贪心、BFS、预判、安全路径、深度学习、强化学习六种算法。
- AI 单局评分系统，用 0-100 分和 S/A/B/C/D 评级比较算法表现。
- 普通果实和奖励果实两种得分来源。
- 音乐与音效开关、暂停、重新开始、触控方向键。
- 最高分按可穿墙/不可穿墙模式独立记录；皮肤、墙体模式、AI 算法和 AI 评分记录保存在本地浏览器。
- 自定义 SVG logo 和 favicon。

## 火柴人对抗功能

- 本地双人横版格斗，一局定胜负。
- P1 使用 `A/D/W/S` 移动、跳跃和防御，`J/K/L` 轻击、重击和闪避。
- P2 使用方向键移动、跳跃和防御，`1/2/3` 轻击、重击和闪避。
- 双方各 100 HP，倒计时 99 秒；HP 归零或时间结束时按剩余 HP 判胜。
- Canvas 绘制原创火柴人、街机场景、命中特效、血条和胜负遮罩。
- 不使用原作角色、名称、素材或招式，只借鉴横版格斗的通用玩法结构。

## 本地运行

因为贪吃蛇项目使用 ES Modules，本地预览时不要直接双击打开 HTML 文件。浏览器在 `file://` 协议下会限制模块加载，可能导致按钮无响应或脚本无法执行。

推荐在仓库根目录启动静态服务器：

```bash
python -m http.server 8000 --bind 127.0.0.1
```

然后访问：

```text
http://127.0.0.1:8000/
http://127.0.0.1:8000/snake/
http://127.0.0.1:8000/stick-fight/
```

部署到 GitHub Pages 时不需要额外构建，直接推送仓库即可。

## 发布前检查

```bash
node --check snake/scripts/*.js
node --check stick-fight/scripts/*.js
python -m http.server 8000 --bind 127.0.0.1
git status --short --untracked-files=all
```

检查重点：

- `http://127.0.0.1:8000/` 可以打开导航页，首页卡片能进入 `snake/`。
- `http://127.0.0.1:8000/snake/` 可以打开 AI 贪吃蛇，页面右上角可以返回项目导航。
- `http://127.0.0.1:8000/stick-fight/` 可以打开火柴人对抗，开始、暂停、重开、P1/P2 键盘操作和胜负流程可用。
- 贪吃蛇的开始、暂停、重开、键盘方向、触摸方向、皮肤选择、AI 开关、六种 AI 算法和两种墙体模式可用。
- 桌面、平板和手机宽度下没有明显文字重叠、按钮溢出或棋盘变形。
- `snake/` 目录已纳入版本变更；根目录旧 `scripts/` 删除是迁移后的预期状态。

## 项目结构

```text
index.html                 导航页
styles.css                 导航页样式
CNAME                      GitHub Pages 自定义域名配置
logo.svg                   站点 logo
favicon.svg                浏览器标签页图标

snake/index.html           AI 贪吃蛇页面结构、状态栏、设置面板和控制按钮
snake/styles.css           AI 贪吃蛇布局、棋盘、按钮、面板和响应式样式
snake/scripts/main.js      贪吃蛇入口
snake/scripts/game.js      游戏协调器，串联状态、规则、AI、UI、输入、设置和音频
snake/scripts/config.js    难度、皮肤、方向、穿墙模式、AI 算法等配置
snake/scripts/state.js     默认游戏状态
snake/scripts/rules.js     移动、碰撞、食物、粒子和分数规则
snake/scripts/score.js     AI 单局评分统计和评级计算
snake/scripts/ai.js        AI 入口，提供 chooseDirection 和 countLegalMoves
snake/scripts/aiAlgorithms.js 具体 AI 决策算法
snake/scripts/aiShared.js  AI 共用寻路、模拟、距离和空间计算工具
snake/scripts/aiFeatures.js 神经网络和强化学习共用特征
snake/scripts/aiNetworks.js 内置神经网络权重和前端推理函数
snake/scripts/render.js    Canvas 绘制
snake/scripts/ui.js        HUD、遮罩层、下拉框和按钮状态同步
snake/scripts/input.js     键盘、触摸和方向按钮输入
snake/scripts/settings.js  设置栏事件绑定
snake/scripts/audio.js     音效和背景音乐
snake/scripts/storage.js   localStorage 读写

stick-fight/index.html     火柴人对抗页面结构、血条、舞台和键位说明
stick-fight/styles.css     火柴人对抗街机舞台和响应式样式
stick-fight/scripts/main.js    火柴人对抗入口
stick-fight/scripts/game.js    主循环、状态机、计时和胜负流程
stick-fight/scripts/input.js   键盘输入状态
stick-fight/scripts/fighter.js 角色移动、跳跃、攻击、防御、闪避和碰撞规则
stick-fight/scripts/render.js  Canvas 绘制舞台、火柴人和命中特效
```

## AI 算法接口

AI 对外入口在 `snake/scripts/ai.js`，游戏主流程只调用：

```js
chooseDirection(state, algorithmName);
countLegalMoves(state);
```

具体算法在 `snake/scripts/aiAlgorithms.js` 中通过注册表维护：

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
- 预判 AI：模拟下一步，综合食物距离、活动空间、未来可选方向和危险状态评分。
- 安全路径 AI：优先验证吃到食物后还能追到尾巴；不安全时追尾保命。
- 深度学习 AI：使用内置小型神经网络权重为合法方向打分。
- 强化学习 AI：使用 Q-value 近似策略评估即时奖励与未来价值。

## AI 评分系统

只有开启 AI 控制后，本局结束时才会显示 AI 评分。手动游玩不显示 AI 评分。

综合评分满分 100，包含最终得分、生存能力、进食效率、安全控制和稳定性。评分结果会写入本地 `localStorage`，用于记录不同算法的平均表现。

评级规则：

```text
S: 90-100
A: 75-89
B: 60-74
C: 40-59
D: 0-39
```

统计指标包括存活步数、吃到食物数、危险步数、紧张步数、平均合法方向数、平均进食间隔、最长未进食步数和死亡原因。

## 扩展指南

新增项目：

- 在根目录创建新的项目文件夹，例如 `stick-fight/`、`nn/` 或 `rl-maze/`。
- 每个项目使用自己的 `index.html`、样式和脚本。
- 在根目录 `index.html` 的项目卡片中把状态从“计划中”改为“可体验”，并把按钮链接指向对应路径。

扩展 AI 贪吃蛇：

- 新增难度：修改 `snake/scripts/config.js` 的 `difficulties`，并在 `snake/index.html` 增加对应按钮。
- 新增皮肤：修改 `snake/scripts/config.js` 的 `skins`，在 `snake/index.html` 增加对应选项，并在 `snake/styles.css` 添加颜色预览。
- 新增 AI 算法：在 `snake/scripts/aiAlgorithms.js` 新增算法函数并注册到 `aiAlgorithms`，需要共用工具时优先从 `snake/scripts/aiShared.js` 引入。
- 调整评分：修改 `snake/scripts/score.js` 中的评分权重和分项计算。

## 维护约定

- 根目录只放项目展示首页、共享资源和 GitHub Pages 配置。
- 每个可体验项目独立放在自己的目录中，避免多个项目共用易冲突的脚本入口。
- AI 贪吃蛇脚本已经从根目录 `scripts/` 迁移到 `snake/scripts/`，不要在根目录恢复旧脚本入口。
- AI 贪吃蛇配置集中放在 `snake/scripts/config.js`。
- 游戏规则优先放在 `snake/scripts/rules.js`。
- AI 入口保持在 `snake/scripts/ai.js`，具体决策优先放在 `snake/scripts/aiAlgorithms.js`。
- DOM 更新优先放在 `snake/scripts/ui.js`，输入和设置事件分别放在 `snake/scripts/input.js`、`snake/scripts/settings.js`。
