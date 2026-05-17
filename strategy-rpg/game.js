import { createInitialNpcs, growFactionTowns, spawnWildIfNeeded, updateNpcs } from "./modules/ai.js";
import { finishBattle, fleeBattle, startBattle, updateBattle } from "./modules/battle.js";
import { createCamera, screenToWorld, updateCamera } from "./modules/camera.js";
import { CONFIG } from "./modules/config.js";
import { consumeClick, consumeKey, consumeTextInput, createInput, getMovementVector } from "./modules/input.js";
import { clampToMap, ensurePassablePosition, findNearestResource, findNearestTown, findSafeStep, getTile, isPassable } from "./modules/map.js";
import { createPlayer, processNewDay, refreshOwnedResources, refreshOwnedTowns } from "./modules/player.js";
import { addWarReport } from "./modules/reports.js";
import { createRenderer, renderGame } from "./modules/render.js";
import { applySaveToGame, autoSaveIfNeeded, createFreshGameData, hasSave, loadGameData, saveGame } from "./modules/save.js";
import { getArmyPower } from "./modules/troop.js";
import { enterTown } from "./modules/town.js";
import { distanceXY, moveToward } from "./modules/utils.js";
import { getClickedButton, handleUiAction } from "./modules/ui.js";

// 铁冠诸侯 — 游戏入口。负责拼装模块、状态机和主循环。
// 所有业务逻辑归到各模块中，只在本文件做调度。

const WORLD_MOVE_SPEED_MULTIPLIER = 1.3;
const PRIVILEGE_FILE = "./privilege.txt";
const PRIVILEGE_USED_KEY = CONFIG.saveKey + "-privilege-used";

var canvas = document.querySelector("#gameCanvas");
var renderer = createRenderer(canvas);
var input = createInput(canvas);
var camera = createCamera();

var fresh = createFreshGameData();
var settings = loadSettings();
var game = {
  state: "start",
  map: fresh.map,
  player: fresh.player || createPlayer(),
  camera: camera,
  input: input,
  ui: { buttons: [] },
  notice: null,
  npcs: [],
  activeTown: null,
  nearTown: null,
  nearResource: null,
  capturingResource: null,
  battle: null,
  pendingEncounter: null,
  encounter: null,
  privilege: { open: false, input: "", busy: false },
  message: "点击地面移动，WASD 行军。靠近城镇按 E 进入，按 R 攻城。",
  log: ["探索大陆、招募扩军、攻城收税、统一全境", "提示：ESC 打开军务菜单 | F5 保存 | F9 读档"],
  reports: [],
  settings: settings,
  previousState: null,
  elapsedDayTimer: 0,
  dayLength: CONFIG.dayLength,
  wildSpawnTimer: CONFIG.wildSpawnInterval,
  autoSaveTimer: CONFIG.autoSaveInterval,
  lastTime: performance.now(),
  lastFrameTime: performance.now()
};

game.npcs = createInitialNpcs(game.map);

refreshOwnedTowns(game.player, game.map.towns);
requestAnimationFrame(loop);

// ==================== 主循环 ====================

function loop(now) {
  var targetFrameMs = 1000 / getTargetFps();
  if (now - game.lastFrameTime >= targetFrameMs) {
    var dt = Math.min(0.08, (now - game.lastTime) / 1000);
    game.lastTime = now;
    game.lastFrameTime = now;
    updateGame(dt);
    renderGame(renderer, game);
  }
  requestAnimationFrame(loop);
}

function getTargetFps() {
  return Math.max(10, Math.min(120, game.settings.maxFps || CONFIG.targetFps.world));
}

function updateGame(dt) {
  updateNotice(dt);
  handlePrivilegeInput();
  handleGlobalShortcuts();

  var click = consumeClick(input);
  if (click && handleUiClick(click)) return;

  if (game.state === "start") {
    return;
  }

  if (game.state === "battle") {
    updateBattle(game, dt);
    return;
  }

  if (game.state === "world") {
    updateWorld(dt, click);
  } else if (game.state === "town" || game.state === "menu" || game.state === "army" || game.state === "settings" || game.state === "encounter") {
    updateCamera(game.camera, game.player, game.map);
  }

  autoSaveIfNeeded(game, dt);
}

// ==================== 快捷键 ====================

function handleGlobalShortcuts() {
  if (game.state === "start") {
    return;
  }

  if (consumeKey(input, "escape")) {
    if (game.privilege && game.privilege.open) {
      game.privilege.open = false;
    } else if (game.state === "menu") {
      if (game.ui) {
        game.ui.attributeSession = null;
      }
      game.state = "world";
      game.message = "回到大地图";
    } else if (game.state === "settings") {
      game.state = game.previousState && game.previousState !== "settings" ? game.previousState : "world";
      game.previousState = null;
    } else if (game.state === "army") {
      game.state = "world";
      game.message = "回到大地图";
    } else if (game.state === "town") {
      game.state = "world";
      game.activeTown = null;
      game.message = "离开城镇";
    } else if (game.state === "encounter") {
      fleeEncounter();
    } else if (game.state === "world") {
      if (game.ui) {
        game.ui.attributeSession = null;
      }
      game.state = "menu";
      game.message = "打开军务菜单";
    }
  }
  if (consumeKey(input, "f5")) {
    saveGame(game);
    game.message = "手动保存完成";
    setNotice("保存完成", ["本地存档已写入"], 1.8, "gold");
  }
  if (consumeKey(input, "f9")) {
    loadIntoCurrentGame();
  }
}

function handleUiClick(click) {
  var button = getClickedButton(game.ui, click);
  if (!button) return false;

  if (button.action === "newGame") {
    startNewGame();
    return true;
  }
  if (button.action === "continueGame") {
    loadIntoCurrentGame(true);
    return true;
  }
  if (button.action === "finishBattle") {
    finishBattle(game);
    game.player.target = null;
    return true;
  }
  if (button.action === "fleeBattle") {
    fleeBattle(game);
    game.player.target = null;
    return true;
  }
  if (button.action === "acceptEncounter") {
    acceptEncounter();
    return true;
  }
  if (button.action === "fleeEncounter") {
    fleeEncounter();
    return true;
  }
  if (button.action === "enterNearbyTown") {
    if (game.nearTown) {
      enterTown(game, game.nearTown);
    }
    return true;
  }
  if (button.action === "siegeNearbyTown") {
    if (game.nearTown) {
      if (game.nearTown.owner === "player") {
        setNotice("无需攻城", [game.nearTown.name + " 已是我方城池"], 1.8, "gold");
      } else {
        game.player.target = null;
        addWarReport(game, "我军正在攻击 " + game.nearTown.name, "good");
        startBattle(game, { type: "siege", enemy: game.nearTown, town: game.nearTown });
      }
    }
    return true;
  }
  if (button.action === "captureNearbyResource") {
    beginResourceCapture();
    return true;
  }
  if (button.action === "save") {
    saveGame(game);
    game.message = "手动保存完成";
    setNotice("保存完成", ["本地存档已写入"], 1.8, "gold");
    return true;
  }
  if (button.action === "load") {
    loadIntoCurrentGame();
    return true;
  }
  if (button.action === "redeemPrivilege") {
    redeemPrivilegeCode();
    return true;
  }
  if (button.action && button.action.indexOf("setFps:") === 0) {
    var fps = Number(button.action.split(":")[1]);
    if (fps > 0) {
      game.settings.maxFps = fps;
      saveSettings(game.settings);
      game.lastFrameTime = performance.now();
      setNotice("帧率已设置", ["最大 " + fps + " FPS"], 1.4, "gold");
    }
    return true;
  }
  return handleUiAction(game, button.action);
}

// ==================== 大地图逻辑 ====================

function updateWorld(dt, click) {
  updatePlayerMovement(dt, click);
  updateNpcs(game, dt);
  spawnWildIfNeeded(game, dt);
  updateCamera(game.camera, game.player, game.map);
  handleWorldInteractions();
  updateResourceCapture(dt);
  processDayCycle(dt);
  refreshOwnedTowns(game.player, game.map.towns);
  refreshOwnedResources(game.player, game.map.resources);
}

function updatePlayerMovement(dt, click) {
  if (ensurePassablePosition(game.map, game.player)) {
    game.message = "部队已回到可通行地形";
  }

  var movement = getMovementVector(input);
  var movingByKeyboard = movement.dx !== 0 || movement.dy !== 0;

  if (movingByKeyboard) {
    game.player.target = null;
    movePlayerBy(movement.dx, movement.dy, dt);
  } else if (game.player.target) {
    var terrain = getTile(game.map, game.player.x, game.player.y);
    var speed = CONFIG.playerSpeed * WORLD_MOVE_SPEED_MULTIPLIER * terrain.speed;
    var oldX = game.player.x;
    var oldY = game.player.y;
    var arrived = moveToward(game.player, game.player.target.x, game.player.target.y, speed, dt);
    var safe = findSafeStep(game.map, oldX, oldY, game.player.x, game.player.y);
    game.player.x = safe.x;
    game.player.y = safe.y;
    if (safe.x === oldX && safe.y === oldY && !isPassable(game.map, game.player.target.x, game.player.target.y)) {
      game.player.target = null;
      game.message = "山体无法通行";
      return;
    }
    if (arrived || distanceXY(game.player.x, game.player.y, game.player.target.x, game.player.target.y) < CONFIG.clickArriveDistance) {
      game.player.target = null;
      game.message = "到达目的地";
    }
  }

  // 鼠标点击移动
  if (click) {
    var world = screenToWorld(game.camera, click.x, click.y);
    if (isPassable(game.map, world.x, world.y)) {
      game.player.target = world;
      game.message = "部队正在行军……";
    } else {
      game.message = "山体无法通行";
    }
  }

  clampToMap(game.map, game.player);
}

function movePlayerBy(dx, dy, dt) {
  ensurePassablePosition(game.map, game.player);
  var terrain = getTile(game.map, game.player.x, game.player.y);
  var speed = CONFIG.playerSpeed * WORLD_MOVE_SPEED_MULTIPLIER * terrain.speed;
  var oldX = game.player.x;
  var oldY = game.player.y;
  var nextX = oldX + dx * speed * dt;
  var nextY = oldY + dy * speed * dt;
  var safe = findSafeStep(game.map, oldX, oldY, nextX, nextY);
  game.player.x = safe.x;
  game.player.y = safe.y;
}

// ==================== 世界交互 ====================

function handleWorldInteractions() {
  // 城池交互
  var nearTown = findNearestTown(game.map, game.player.x, game.player.y, CONFIG.interactDistance);
  game.nearTown = nearTown || null;
  if (nearTown) {
    var factionName = nearTown.owner === "player" ? "我方" : "敌方";
    game.message = "靠近 " + nearTown.name + "（" + factionName + "）— 按 E 进入，按 R 攻城";

    if (consumeKey(input, "e")) {
      enterTown(game, nearTown);
      return;
    }
    if (consumeKey(input, "r")) {
      if (nearTown.owner === "player") {
        game.message = nearTown.name + " 已是我方城池，无需攻城";
        setNotice("无需攻城", [nearTown.name + " 已是我方城池"], 1.8, "gold");
      } else {
        game.player.target = null;
        addWarReport(game, "我军正在攻击 " + nearTown.name, "good");
        startBattle(game, { type: "siege", enemy: nearTown, town: nearTown });
      }
      return;
    }
  }

  var nearResource = nearTown ? null : findNearestResource(game.map, game.player.x, game.player.y, CONFIG.interactDistance);
  game.nearResource = nearResource || null;

  // 待处理的遭遇
  if (game.pendingEncounter) {
    var enemy = game.pendingEncounter;
    if (distanceXY(game.player.x, game.player.y, enemy.x, enemy.y) < 50) {
      openEncounter(enemy);
      game.pendingEncounter = null;
    } else {
      game.pendingEncounter = null;
    }
  }

  // NPC 碰撞检测
  for (var i = 0; i < game.npcs.length; i++) {
    var npc = game.npcs[i];
    if (npc.faction !== "neutral" && distanceXY(game.player.x, game.player.y, npc.x, npc.y) < 28) {
      openEncounter(npc);
      break;
    }
  }

  // 统一提示
  if (game.player.unified) {
    game.message = "大陆已经统一！你可以继续巡游、清剿荒野残部。";
  }
}

function beginResourceCapture() {
  if (!game.nearResource) return;
  if (game.nearResource.owner === "player") {
    setNotice("已占领", [game.nearResource.name + " 已属于你"], 1.6, "gold");
    return;
  }
  game.player.target = null;
  game.capturingResource = {
    id: game.nearResource.id,
    timer: 0,
    duration: game.nearResource.captureTime || 3
  };
  setNotice("开始占领", [game.nearResource.name, "请在附近坚持片刻"], 1.5, "gold");
}

function updateResourceCapture(dt) {
  if (!game.capturingResource) return;

  var resource = (game.map.resources || []).find(function (item) {
    return item.id === game.capturingResource.id;
  });
  if (!resource || distanceXY(game.player.x, game.player.y, resource.x, resource.y) > CONFIG.interactDistance + 12) {
    game.capturingResource = null;
    setNotice("占领中断", ["离资源点太远"], 1.5, "gold");
    return;
  }

  game.capturingResource.timer += dt;
  if (game.capturingResource.timer >= game.capturingResource.duration) {
    resource.owner = "player";
    game.capturingResource = null;
    refreshOwnedResources(game.player, game.map.resources);
    addWarReport(game, "我军占领 " + resource.name, "good");
    setNotice("占领完成", [resource.name + " 每日 +" + resource.income + " 金"], 2, "gold");
  }
}

function openEncounter(enemy) {
  game.player.target = null;
  game.capturingResource = null;
  game.encounter = { enemy: enemy };
  game.state = "encounter";
  game.message = "遭遇 " + enemy.name;
}

function acceptEncounter() {
  if (!game.encounter || !game.encounter.enemy) {
    game.state = "world";
    return;
  }
  var enemy = game.encounter.enemy;
  game.encounter = null;
  game.player.target = null;
  startBattle(game, { type: "encounter", enemy: enemy });
}

function fleeEncounter() {
  if (game.encounter && game.encounter.enemy) {
    var enemy = game.encounter.enemy;
    var dx = game.player.x - enemy.x;
    var dy = game.player.y - enemy.y;
    var len = Math.max(1, Math.hypot(dx, dy));
    game.player.x += (dx / len) * 56;
    game.player.y += (dy / len) * 56;
    enemy.x -= (dx / len) * 18;
    enemy.y -= (dy / len) * 18;
    clampToMap(game.map, game.player);
    clampToMap(game.map, enemy);
  }
  game.player.target = null;
  game.encounter = null;
  game.state = "world";
  setNotice("已逃离", ["暂避锋芒，重新整队"], 1.6, "gold");
}

// ==================== 日循环 ====================

function processDayCycle(dt) {
  game.elapsedDayTimer += dt;
  if (game.elapsedDayTimer >= CONFIG.dayLength) {
    game.elapsedDayTimer = 0;
    var result = processNewDay(game.player, game.map.towns, game.map.resources);
    growFactionTowns(game);
    game.log.unshift(result.message);
    setNotice(
      "第 " + result.day + " 日",
      [
        "城镇 +" + result.townIncome + " 金",
        "资源 +" + result.resourceIncome + " 金",
        "维护费 -" + result.upkeep + " 金"
      ],
      2.5,
      "gold"
    );
  }
}

// ==================== 读档 ====================

function loadIntoCurrentGame(fromStart) {
  var data = loadGameData();
  if (!data) {
    game.message = "没有可读取的本地存档";
    setNotice("读取失败", ["没有可读取的本地存档"], 1.8, "gold");
    return;
  }
  applySaveToGame(game, data);
  game.player.target = null;
  game.nearTown = null;
  game.nearResource = null;
  game.capturingResource = null;
  game.encounter = null;
  game.message = "读档完成，欢迎回来。";
  game.state = "world";
  setNotice("读档完成", ["已读取本地存档"], 1.8, "gold");
}

function startNewGame() {
  var freshGame = createFreshGameData();
  game.state = "world";
  game.map = freshGame.map;
  game.player = freshGame.player || createPlayer();
  game.camera.x = 0;
  game.camera.y = 0;
  game.camera.shake = 0;
  game.npcs = createInitialNpcs(game.map);
  game.activeTown = null;
  game.nearTown = null;
  game.nearResource = null;
  game.capturingResource = null;
  game.battle = null;
  game.pendingEncounter = null;
  game.encounter = null;
  game.notice = null;
  game.message = "点击地面移动，WASD 行军。靠近城镇按 E 进入，按 R 攻城。";
  game.log = ["探索大陆、招募扩军、攻城收税、统一全境", "提示：ESC 打开军务菜单 | F5 保存 | F9 读档"];
  game.reports = [];
  game.settings = loadSettings();
  game.previousState = null;
  game.elapsedDayTimer = 0;
  game.dayLength = CONFIG.dayLength;
  game.wildSpawnTimer = CONFIG.wildSpawnInterval;
  game.autoSaveTimer = CONFIG.autoSaveInterval;
  game.lastTime = performance.now();
  game.lastFrameTime = performance.now();
  refreshOwnedTowns(game.player, game.map.towns);
  setNotice("新游戏开始", ["旧存档不会立即覆盖"], 1.8, "gold");
}

function loadSettings() {
  try {
    var raw = localStorage.getItem(CONFIG.saveKey + "-settings");
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.maxFps === "number") {
        return { maxFps: parsed.maxFps };
      }
    }
  } catch (error) {
    console.warn("读取设置失败", error);
  }
  return { maxFps: CONFIG.targetFps.world };
}

function saveSettings(nextSettings) {
  localStorage.setItem(CONFIG.saveKey + "-settings", JSON.stringify(nextSettings));
}

function handlePrivilegeInput() {
  const events = consumeTextInput(input);
  if (!game.privilege || !game.privilege.open || !events.length) {
    return;
  }
  for (const event of events) {
    if (event.type === "char") {
      game.privilege.input = (game.privilege.input + event.value).slice(0, 32);
    } else if (event.type === "backspace") {
      game.privilege.input = game.privilege.input.slice(0, -1);
    } else if (event.type === "enter") {
      redeemPrivilegeCode();
    } else if (event.type === "escape") {
      game.privilege.open = false;
      input.keys.delete("escape");
    }
  }
}

async function redeemPrivilegeCode() {
  if (!game.privilege || !game.privilege.open || game.privilege.busy) {
    return;
  }
  const inputCode = (game.privilege.input || "").trim();
  if (!inputCode) {
    setNotice("兑换失败", ["请输入兑换码"], 1.6, "gold");
    return;
  }

  game.privilege.busy = true;
  try {
    const response = await fetch(PRIVILEGE_FILE, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("privilege file not found");
    }
    const text = await response.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const code = lines[0] || "";
    const gold = Math.max(0, Math.floor(Number(lines[1] || 0)));
    if (!code || gold <= 0) {
      setNotice("兑换失败", ["兑换码配置无效"], 1.8, "gold");
      return;
    }
    if (inputCode !== code) {
      setNotice("兑换失败", ["兑换码不正确"], 1.8, "gold");
      return;
    }
    if (hasUsedPrivilegeCode(code)) {
      setNotice("已兑换", ["该兑换码已经使用过"], 1.8, "gold");
      return;
    }
    markPrivilegeCodeUsed(code);
    game.player.gold += gold;
    game.privilege.open = false;
    game.privilege.input = "";
    setNotice("兑换成功", ["金币 +" + gold], 2, "gold");
  } catch (error) {
    console.warn("兑换码读取失败", error);
    setNotice("兑换失败", ["无法读取 privilege.txt"], 1.8, "gold");
  } finally {
    if (game.privilege) {
      game.privilege.busy = false;
    }
  }
}

function hasUsedPrivilegeCode(code) {
  try {
    const used = JSON.parse(localStorage.getItem(PRIVILEGE_USED_KEY) || "[]");
    return Array.isArray(used) && used.includes(code);
  } catch (error) {
    return false;
  }
}

function markPrivilegeCodeUsed(code) {
  let used = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PRIVILEGE_USED_KEY) || "[]");
    used = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    used = [];
  }
  if (!used.includes(code)) {
    used.push(code);
  }
  localStorage.setItem(PRIVILEGE_USED_KEY, JSON.stringify(used));
}

function updateNotice(dt) {
  if (!game.notice) return;
  game.notice.timer -= dt;
  if (game.notice.timer <= 0) {
    game.notice = null;
  }
}

function setNotice(title, lines, duration, kind) {
  game.notice = {
    title: title,
    lines: Array.isArray(lines) ? lines : [],
    timer: duration || 2,
    duration: duration || 2,
    kind: kind || "default"
  };
}
