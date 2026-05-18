import { createInitialNpcs, growFactionTowns, spawnWildIfNeeded, updateNpcs } from "./modules/ai.js";
import { finishBattle, fleeBattle, orderBattleAttack, startBattle, toggleBattlePause, updateBattle } from "./modules/battle.js";
import { CONFIG } from "./modules/config.js";
import { consumeClick, consumeDoubleClick, consumeKey, consumeTextInput, createInput, getMovementVector } from "./modules/input.js";
import { clampToMap, ensurePassablePosition, findNearestResource, findNearestTown, findSafeStep, getTile, isPassable } from "./modules/map.js";
import { setNotice as assignNotice, updateNotice as advanceNotice } from "./modules/notice.js";
import { createPlayer, processNewDay, refreshOwnedResources, refreshOwnedTowns } from "./modules/player.js";
import { handlePrivilegeInput as processPrivilegeInput, redeemPrivilegeCode as redeemPrivilege } from "./modules/privilege.js";
import { addWarReport } from "./modules/reports.js";
import { createRenderer, renderGame } from "./modules/render.js";
import { applySaveToGame, autoSaveIfNeeded, createFreshGameData, deleteSaveSlot, loadGameData, loadResumeGameData, saveGame, saveResumeGame } from "./modules/save.js";
import { enterTown, resetTownUi } from "./modules/town.js";
import { distanceXY, ensureFacingState, moveToward, updateFacing } from "./modules/utils.js";
import { clearArmyUiState, clearEnemyArmyPreview, createUi, getClickedButton, handleUiAction } from "./modules/ui.js";
import { createMapCamera as createCamera, focusCameraOn, releaseCamera, screenToWorld, updateMapCamera as updateCamera } from "./map/camera.js";
import { createDisplay, updateDisplay } from "./modules/display.js";
import { createFogOfWar, restoreFogOfWar, updateFogOfWar } from "./map/fog.js";
import { createMiniMapState, handleMiniMapClick, updateMiniMapHover } from "./map/minimap.js";
import { assignUnitPath, buildRoadPreferredPath, clearUnitPath } from "./map/pathfinding.js";
import { closeWorldMapToPlayer, createWorldMapState, handleWorldMapClick, handleWorldMapDoubleClick, updateWorldMap } from "./map/worldmap.js";

// 铁冠诸侯 — 游戏入口。负责拼装模块、状态机和主循环。
// 所有业务逻辑归到各模块中，只在本文件做调度。

const WORLD_MOVE_SPEED_MULTIPLIER = 1.3;
const PRIVILEGE_FILE = "./privilege.txt";
var canvas = document.querySelector("#gameCanvas");
var display = createDisplay(canvas);
var renderer = createRenderer(canvas, display);
var input = createInput(canvas, display);
var camera = createCamera();

var fresh = createFreshGameData();
var settings = loadSettings();
var game = {
  state: "start",
  map: fresh.map,
  player: fresh.player || createPlayer(),
  camera: camera,
  input: input,
  ui: createUi(),
  fog: createFogOfWar(fresh.map),
  mapUi: {
    miniMap: createMiniMapState(),
    worldMap: createWorldMapState()
  },
  notice: null,
  npcs: [],
  activeTown: null,
  nearTown: null,
  nearResource: null,
  capturingResource: null,
  battle: null,
  pendingEncounter: null,
  encounter: null,
  travelDestination: null,
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
  lastFrameTime: performance.now(),
  hasEnteredGame: false
};

game.npcs = createInitialNpcs(game.map);
updateFogOfWar(game.fog, game.map, game.player, true);
focusCameraOn(game.camera, game.player.x, game.player.y, game.map, true);

refreshOwnedTowns(game.player, game.map.towns);
requestAnimationFrame(loop);
window.addEventListener("resize", handleDisplayResize);
document.addEventListener("fullscreenchange", handleDisplayResize);
window.addEventListener("pagehide", saveResumeSnapshot);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") {
    saveResumeSnapshot();
  }
});

function handleDisplayResize() {
  updateDisplay(display);
}

// ==================== 主循环 ====================

function loop(now) {
  refreshDisplayIfNeeded();
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

function refreshDisplayIfNeeded() {
  var nextDpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  if (Math.abs(nextDpr - display.dpr) > 0.01) {
    updateDisplay(display);
  }
}

function getTargetFps() {
  return Math.max(10, Math.min(120, game.settings.maxFps || CONFIG.targetFps.world));
}

function updateGame(dt) {
  advanceNotice(game, dt);
  handlePrivilegeInput();
  handleGlobalShortcuts();
  saveBeforeStartIfRequested();

  var click = consumeClick(input);
  var doubleClick = consumeDoubleClick(input);
  if (doubleClick && handleWorldMapDoubleClick(game, doubleClick)) return;
  if (game.mapUi && game.mapUi.worldMap.open) {
    updateWorldMap(game, dt);
    if (click && handleWorldMapClick(game, click)) return;
    return;
  }
  input.mouse.dragDx = 0;
  input.mouse.dragDy = 0;
  input.mouse.wheel = 0;

  if (click && handleUiClick(click)) return;

  if (game.state === "start") {
    return;
  }

  if (game.state === "battle") {
    updateBattle(game, dt);
    return;
  }

  if (game.state === "world") {
    updateMiniMapHover(game);
    if (click && handleMiniMapClick(game, click)) return;
    updateWorld(dt, click);
  } else if (game.state === "town" || game.state === "menu" || game.state === "army" || game.state === "settings" || game.state === "encounter") {
    updateCamera(game.camera, game.player, game.map);
  }

  autoSaveIfNeeded(game, dt);
}

function saveBeforeStartIfRequested() {
  if (!game.__requestSaveBeforeStart) {
    return;
  }
  game.__requestSaveBeforeStart = false;
  saveResumeSnapshot();
}

// ==================== 快捷键 ====================

function handleGlobalShortcuts() {
  if (game.state === "start") {
    return;
  }

  if (consumeKey(input, "escape")) {
    if (game.privilege && game.privilege.open) {
      game.privilege.open = false;
    } else if (game.ui && game.ui.selectedMarketItem) {
      game.ui.selectedMarketItem = null;
    } else if (game.ui && game.ui.enemyArmyPreview) {
      clearEnemyArmyPreview(game.ui);
    } else if (game.ui && game.ui.selectedArmySoldierKey) {
      game.ui.selectedArmySoldierKey = null;
    } else if (game.mapUi && game.mapUi.worldMap && game.mapUi.worldMap.open) {
      closeWorldMapToPlayer(game);
      game.message = "关闭世界地图";
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
      clearArmyUiState(game.ui);
      game.state = "world";
      game.message = "回到大地图";
    } else if (game.state === "town") {
      game.state = "world";
      game.activeTown = null;
      resetTownUi(game);
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
    openSaveSlotDialog("save");
  }
  if (consumeKey(input, "f9")) {
    openSaveSlotDialog("load");
  }
}

function handleUiClick(click) {
  var button = getClickedButton(game.ui, click);
  if (!button) {
    return Boolean(game.ui && game.ui.saveSlotDialogOpen);
  }

  if (game.ui && game.ui.saveSlotDialogOpen && !isSaveSlotDialogAction(button.action)) {
    return true;
  }

  if (button.action === "newGame") {
    startNewGame();
    return true;
  }
  if (button.action === "continueGame") {
    loadIntoCurrentGame("resume");
    return true;
  }
  if (button.action === "loadSave") {
    openSaveSlotDialog("load");
    return true;
  }
  if (button.action === "closeSaveSlotDialog") {
    closeSaveSlotDialog();
    return true;
  }
  if (button.action && button.action.indexOf("saveGameSlot:") === 0) {
    var saveSlotIndex = Number(button.action.split(":")[1]);
    saveIntoSlot(saveSlotIndex);
    return true;
  }
  if (button.action && button.action.indexOf("loadSaveSlot:") === 0) {
    var slotIndex = Number(button.action.split(":")[1]);
    loadIntoCurrentGame("slot", slotIndex);
    return true;
  }
  if (button.action && button.action.indexOf("deleteSaveSlot:") === 0) {
    var deleteSlotIndex = Number(button.action.split(":")[1]);
    deleteSlot(deleteSlotIndex);
    return true;
  }
  if (button.action === "finishBattle") {
    finishBattle(game);
    clearUnitPath(game.player);
    return true;
  }
  if (button.action === "fleeBattle") {
    fleeBattle(game);
    clearUnitPath(game.player);
    return true;
  }
  if (button.action === "orderBattleAttack") {
    orderBattleAttack(game);
    return true;
  }
  if (button.action === "toggleBattlePause") {
    toggleBattlePause(game);
    return true;
  }
  if (button.action === "acceptEncounter") {
    clearEnemyArmyPreview(game.ui);
    acceptEncounter();
    return true;
  }
  if (button.action === "fleeEncounter") {
    clearEnemyArmyPreview(game.ui);
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
        clearEnemyArmyPreview(game.ui);
        clearUnitPath(game.player);
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
  if (button.action === "autoPathDestination") {
    startAutoPathToDestination();
    return true;
  }
  if (button.action === "save") {
    openSaveSlotDialog("save");
    return true;
  }
  if (button.action === "load") {
    openSaveSlotDialog("load");
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

function isSaveSlotDialogAction(action) {
  return action === "closeSaveSlotDialog"
    || (action && action.indexOf("saveGameSlot:") === 0)
    || (action && action.indexOf("loadSaveSlot:") === 0)
    || (action && action.indexOf("deleteSaveSlot:") === 0);
}

function openSaveSlotDialog(mode) {
  if (!game.ui) {
    return;
  }
  game.ui.saveSlotDialogMode = mode === "save" ? "save" : "load";
  game.ui.saveSlotDialogOpen = true;
}

function closeSaveSlotDialog() {
  if (!game.ui) {
    return;
  }
  game.ui.saveSlotDialogOpen = false;
  game.ui.saveSlotDialogMode = null;
}

function saveIntoSlot(slotIndex) {
  var data = saveGame(game, slotIndex);
  if (!data) {
    game.message = "请选择有效存档槽";
    setNotice("保存失败", ["请选择有效存档槽"], 1.8, "gold");
    return;
  }
  closeSaveSlotDialog();
  game.message = "手动保存完成";
  setNotice("保存完成", ["已写入存档 " + (slotIndex + 1)], 1.8, "gold");
}

function deleteSlot(slotIndex) {
  var deleted = deleteSaveSlot(slotIndex);
  if (!deleted) {
    game.message = "该存档槽为空";
    setNotice("删除失败", ["该存档槽为空"], 1.6, "gold");
    return;
  }
  game.message = "已删除存档 " + (slotIndex + 1);
  setNotice("删除完成", ["存档 " + (slotIndex + 1) + " 已清空"], 1.6, "gold");
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
    clearUnitPath(game.player);
    game.message = "部队已回到可通行地形";
  }
  ensureFacingState(game.player);

  var movement = getMovementVector(input);
  var movingByKeyboard = movement.dx !== 0 || movement.dy !== 0;

  if (movingByKeyboard) {
    clearUnitPath(game.player);
    releaseCamera(game.camera);
    updateFacing(game.player, movement.dx, movement.dy);
    movePlayerBy(movement.dx, movement.dy, dt);
  } else if (game.player.target) {
    var terrain = getTile(game.map, game.player.x, game.player.y);
    var speed = CONFIG.playerSpeed * WORLD_MOVE_SPEED_MULTIPLIER * terrain.speed;
    var oldX = game.player.x;
    var oldY = game.player.y;
    updateFacing(game.player, game.player.target.x - game.player.x, game.player.target.y - game.player.y);
    var arrived = moveToward(game.player, game.player.target.x, game.player.target.y, speed, dt);
    var safe = findSafeStep(game.map, oldX, oldY, game.player.x, game.player.y);
    game.player.x = safe.x;
    game.player.y = safe.y;
    if (safe.x === oldX && safe.y === oldY && !isPassable(game.map, game.player.target.x, game.player.target.y)) {
      clearUnitPath(game.player);
      game.message = "山体无法通行";
      return;
    }
    if (arrived || distanceXY(game.player.x, game.player.y, game.player.target.x, game.player.target.y) < CONFIG.clickArriveDistance) {
      advancePlayerPath();
    }
  }

  // 鼠标点击移动
  if (click) {
    var world = screenToWorld(game.camera, click.x, click.y);
    if (isPassable(game.map, world.x, world.y)) {
      clearUnitPath(game.player);
      game.player.target = world;
      updateFacing(game.player, world.x - game.player.x, world.y - game.player.y);
      releaseCamera(game.camera);
      game.message = "部队正在行军……";
    } else {
      game.message = "山体无法通行";
    }
  }

  clampToMap(game.map, game.player);
  updateFogOfWar(game.fog, game.map, game.player);
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

function advancePlayerPath() {
  var player = game.player;
  var followingPath = Array.isArray(player.path) && player.path.length > 0;
  if (followingPath && player.pathIndex < player.path.length - 1) {
    player.pathIndex += 1;
    player.target = player.path[player.pathIndex];
    game.message = player.pathUsesRoads ? "沿主干道行军中" : "远征行军中";
    return;
  }
  var completedAutoPath = followingPath && player.pathMode === "road";
  clearUnitPath(player);
  if (completedAutoPath) {
    game.travelDestination = null;
  }
  game.message = "到达目的地";
}

function startAutoPathToDestination() {
  if (!game.travelDestination) {
    game.message = "请先在世界地图设立目的地";
    return false;
  }
  var route = buildRoadPreferredPath(game.map, game.player, game.travelDestination);
  if (!assignUnitPath(game.player, route, "road")) {
    game.message = "无法到达该目的地";
    return false;
  }
  if (route.adjusted && route.adjustedTarget) {
    game.travelDestination = route.adjustedTarget;
  }
  releaseCamera(game.camera);
  game.message = route.usedRoads ? "自动寻路：优先走主干道" : "自动寻路：前往目的地";
  return true;
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
      clearUnitPath(game.player);
      enterTown(game, nearTown);
      return;
    }
    if (consumeKey(input, "r")) {
      if (nearTown.owner === "player") {
        game.message = nearTown.name + " 已是我方城池，无需攻城";
        setNotice("无需攻城", [nearTown.name + " 已是我方城池"], 1.8, "gold");
      } else {
        clearEnemyArmyPreview(game.ui);
        clearUnitPath(game.player);
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
  clearUnitPath(game.player);
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
  clearUnitPath(game.player);
  game.capturingResource = null;
  game.encounter = { enemy: enemy };
  game.state = "encounter";
  game.message = "遭遇 " + enemy.name;
}

function acceptEncounter() {
  if (!game.encounter || !game.encounter.enemy) {
    clearEnemyArmyPreview(game.ui);
    game.state = "world";
    return;
  }
  var enemy = game.encounter.enemy;
  game.encounter = null;
  clearEnemyArmyPreview(game.ui);
  clearUnitPath(game.player);
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
  clearUnitPath(game.player);
  game.encounter = null;
  clearEnemyArmyPreview(game.ui);
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

function loadIntoCurrentGame(source, slotIndex) {
  var isResume = source === "resume";
  var data = isResume ? loadResumeGameData() : loadGameData(slotIndex);
  if (!data) {
    var missingText = isResume ? "没有可继续的进度" : "没有可读取的正式存档";
    game.message = missingText;
    setNotice("读取失败", [missingText], 1.8, "gold");
    return;
  }
  applySaveToGame(game, data);
  game.fog = restoreFogOfWar(game.map, data.fog, game.player);
  game.mapUi = {
    miniMap: createMiniMapState(),
    worldMap: createWorldMapState()
  };
  clearUnitPath(game.player);
  game.nearTown = null;
  game.nearResource = null;
  game.capturingResource = null;
  game.encounter = null;
  if (game.ui) {
    game.ui.saveSlotDialogOpen = false;
    resetTownUi(game);
    clearArmyUiState(game.ui);
    clearEnemyArmyPreview(game.ui);
  }
  game.travelDestination = null;
  game.message = isResume ? "继续游戏，欢迎回来。" : "读档完成，欢迎回来。";
  game.state = "world";
  game.hasEnteredGame = true;
  focusCameraOn(game.camera, game.player.x, game.player.y, game.map, true);
  setNotice(isResume ? "继续游戏" : "读档完成", [isResume ? "已恢复上次退出进度" : "已读取正式存档"], 1.8, "gold");
}

function saveResumeSnapshot() {
  if (!game || !game.hasEnteredGame || !game.player || !game.map) {
    return;
  }
  saveResumeGame(game);
}

function startNewGame() {
  var freshGame = createFreshGameData();
  game.state = "world";
  game.hasEnteredGame = true;
  game.map = freshGame.map;
  game.player = freshGame.player || createPlayer();
  game.player.usedPrivilegeCodes = [];
  clearUnitPath(game.player);
  game.fog = createFogOfWar(game.map);
  updateFogOfWar(game.fog, game.map, game.player, true);
  game.mapUi = {
    miniMap: createMiniMapState(),
    worldMap: createWorldMapState()
  };
  game.camera.x = 0;
  game.camera.y = 0;
  game.camera.shake = 0;
  focusCameraOn(game.camera, game.player.x, game.player.y, game.map, true);
  game.npcs = createInitialNpcs(game.map);
  game.activeTown = null;
  game.nearTown = null;
  game.nearResource = null;
  game.capturingResource = null;
  game.battle = null;
  game.pendingEncounter = null;
  game.encounter = null;
  game.travelDestination = null;
  if (game.ui) {
    resetTownUi(game);
    clearArmyUiState(game.ui);
    clearEnemyArmyPreview(game.ui);
  }
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
  const wasOpen = Boolean(game.privilege && game.privilege.open);
  processPrivilegeInput(game, consumeTextInput(input), redeemPrivilegeCode);
  if (wasOpen && game.privilege && !game.privilege.open) {
    input.keys.delete("escape");
  }
}

async function redeemPrivilegeCode() {
  await redeemPrivilege(game, PRIVILEGE_FILE, setNotice);
}

function setNotice(title, lines, duration, kind) {
  assignNotice(game, title, lines, duration, kind);
}
