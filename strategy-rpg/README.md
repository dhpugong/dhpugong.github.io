# 策略 RPG 说明文档

这是一个纯前端 Canvas 策略 RPG 小游戏。项目不依赖打包工具，入口文件是 `index.html`，主逻辑从 `game.js` 启动，并按功能拆分到 `modules/` 目录。

## 运行方式

因为游戏使用了 ES Modules，不建议直接双击打开 `index.html`。请在本目录或仓库根目录启动本地 HTTP 服务。

在 `strategy-rpg/` 目录运行：

```powershell
cd d:\桌面\github\daohaipugong.github.io\strategy-rpg
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/
```

也可以在仓库根目录运行：

```powershell
cd d:\桌面\github\daohaipugong.github.io
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/strategy-rpg/
```

## 基本操作

| 操作 | 说明 |
| --- | --- |
| `W` / `A` / `S` / `D` | 控制角色移动 |
| 方向键 | 控制角色移动 |
| 鼠标点击地图 | 移动到目标位置 |
| `E` | 靠近城镇时进入城镇 |
| `R` | 靠近敌对或中立城镇时发起攻城 |
| `ESC` | 打开或关闭军务菜单 |
| `F5` | 手动保存 |
| `F9` | 读取存档 |

## 游戏目标

玩家扮演一名领主，在大地图上探索、招募军队、攻占城镇并扩大势力。游戏的主要目标是占领所有非玩家阵营的城镇，统一地图。

## 主要系统

- 大地图：由不同地形组成，山地和水域不可通行，道路移动更快。
- 城镇：包含城防、税收、驻军和可招募兵种。
- 招募：进入城镇后可以招募当地提供的兵种。敌对城堡需要先攻占后才能招募。
- 战斗：靠近敌人或攻城时会进入战斗状态，军队会根据兵种属性自动交战。
- 成长：战斗和攻城可获得经验，升级后获得技能点，用于提升角色属性。
- 存档：使用浏览器 `localStorage` 保存进度，支持自动保存、手动保存和读档。

## 目录结构

```text
strategy-rpg/
  index.html          页面入口
  styles.css          页面与 Canvas 容器样式
  game.js             游戏主入口、状态机和主循环
  assets/             静态资源目录
  modules/
    ai.js             NPC 与野外敌人逻辑
    battle.js         战斗创建与战斗更新
    camera.js         摄像机跟随与坐标转换
    config.js         全局配置、阵营、地形、兵种、城镇模板
    input.js          键盘、鼠标输入处理
    map.js            地图生成、地形查询、城镇查找
    player.js         玩家数据、升级、属性和占领刷新
    render.js         Canvas 渲染
    save.js           localStorage 存档与读档
    town.js           城镇进入、招募、修城、防守和占领
    troop.js          军队、兵种、战力和招募计算
    ui.js             HUD、菜单、城镇面板和按钮交互
    utils.js          通用工具函数
```

## 修改指南

- 调整地图大小、移动速度、自动保存间隔：修改 `modules/config.js` 的 `CONFIG`。
- 调整兵种数值：修改 `modules/config.js` 的 `TROOP_TYPES`。
- 调整初始军队：修改 `modules/config.js` 的 `STARTING_ARMY`。
- 调整城镇、阵营、驻军和可招募兵种：修改 `modules/config.js` 的 `TOWN_TEMPLATES`。
- 修改玩家初始金币、属性和出生点：修改 `modules/config.js` 的 `PLAYER_TEMPLATE`。
- 修改战斗规则：查看 `modules/battle.js` 和 `modules/troop.js`。
- 修改 UI 文案、按钮和面板：查看 `modules/ui.js`。
- 修改存档格式：查看 `modules/save.js`，同时注意兼容旧存档。

## 存档说明

存档保存在浏览器 `localStorage` 中，键名为：

```text
iron-crown-lords-save-v1
```

如果需要清空存档，可以在浏览器开发者工具的 Console 中执行：

```js
localStorage.removeItem("iron-crown-lords-save-v1");
```

也可以清空当前网站的浏览器站点数据。

## 开发注意事项

- 这是静态前端项目，没有安装依赖和构建步骤。
- 所有模块都使用相对路径导入，移动文件时要同步更新 `import` 路径。
- Canvas 固定逻辑尺寸为 `960 x 540`，相关配置在 `modules/config.js`。
- 游戏状态主要包括 `world`、`town`、`menu` 和 `battle`，主循环在 `game.js` 中调度。
- 修改存档字段时，建议提高存档版本号或在读取时兼容旧字段。
