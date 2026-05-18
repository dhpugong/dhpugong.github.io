import { CONFIG, FACTIONS, MINIMAP_FACTION_COLORS, MINIMAP_ICON_COLORS, MINIMAP_ICON_SETTINGS, TERRAIN, TROOP_TYPES } from "./config.js";
import { getBattleTitle } from "./battle.js";
import { getTerrainById } from "./map.js";
import { getSaveSlots, hasResumeGame, hasSave } from "./save.js";
import { addButton, drawArmyPreviewOverlay, drawArmyUi, drawButton, drawHud, drawMenuUi, drawSettingsUi, drawTownUi } from "./ui.js";
import { drawBar, drawPanel, drawPixelText, clamp } from "./utils.js";
import { drawMiniMap as drawMiniMapOverlay } from "../map/minimap.js";
import { renderWorldScene } from "../map/mapRenderer.js";
import { drawWorldMap } from "../map/worldmap.js";
import { prepareFrame } from "./display.js";

// 渲染模块：使用像素精灵绘制地图、单位和战斗场景，保持 Canvas 结构清晰。
// 所有精灵均为程序化像素绘制，无外部资源依赖。

const titleBackgroundImage = new Image();
titleBackgroundImage.src = "./assets/title-background.svg";
const miniMapTerrainCache = {
  key: "",
  canvas: null
};
const UI_TEXT = {
  main: "#f4e1aa",
  body: "#ead59b",
  muted: "#d7c286",
  empty: "#b7a16a",
  dim: "#a99563"
};

export function createRenderer(canvas, display) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx, display };
}

export function renderGame(renderer, game) {
  const ctx = renderer.ctx;
  if (renderer.display) {
    prepareFrame(ctx, renderer.display);
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  }

  if (game.state === "start") {
    renderStartScreen(ctx, game);
    drawSaveSlotDialog(ctx, game);
    drawCenterNotice(ctx, game);
    return;
  }

  if (game.state === "battle") {
    renderBattle(ctx, game);
    drawSaveSlotDialog(ctx, game);
    drawCenterNotice(ctx, game);
    return;
  }

  renderWorld(ctx, game);
  drawHud(ctx, game);
  if (game.state === "town") {
    drawTownUi(ctx, game);
  }
  if (game.state === "menu") {
    drawMenuUi(ctx, game);
  }
  if (game.state === "army") {
    drawArmyUi(ctx, game);
  }
  if (game.state === "settings") {
    drawSettingsUi(ctx, game);
  }
  if (game.state === "encounter") {
    drawEncounterDialog(ctx, game);
  }
  drawArmyPreviewOverlay(ctx, game);
  if (game.player.unified) {
    drawVictoryBanner(ctx);
  }
  drawWorldMap(ctx, game);
  drawSaveSlotDialog(ctx, game);
  drawCenterNotice(ctx, game);
}

function renderStartScreen(ctx, game) {
  game.ui.buttons.length = 0;

  if (titleBackgroundImage.complete && titleBackgroundImage.naturalWidth > 0) {
    drawCoverImage(ctx, titleBackgroundImage, 0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  } else {
    clearBattleBackground(ctx);
    ctx.fillStyle = "rgba(64,93,42,0.28)";
    ctx.fillRect(0, 350, CONFIG.canvasWidth, 190);
    ctx.fillStyle = "rgba(30,64,93,0.24)";
    ctx.fillRect(0, 388, 240, 152);
    ctx.fillRect(680, 366, 280, 174);
    ctx.fillStyle = "rgba(214,168,79,0.08)";
    for (let x = 0; x < CONFIG.canvasWidth; x += 48) {
      ctx.fillRect(x, 350 + (x % 96), 34, 2);
    }
  }

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, 260);

  drawPixelText(ctx, "铁冠诸侯", CONFIG.canvasWidth / 2, 118, "#ffd56a", 46, "center");
  drawPixelText(ctx, "像素策略 RPG", CONFIG.canvasWidth / 2, 178, UI_TEXT.main, 17, "center");
  drawPixelText(ctx, "探索大陆 · 招募扩军 · 攻城收税 · 统一全境", CONFIG.canvasWidth / 2, 212, UI_TEXT.muted, 14, "center");

  const hasResume = hasResumeGame();
  const hasSlotSave = hasSave();
  drawPanel(ctx, 330, 256, 300, 198, "");
  const newGameButton = addButton(game.ui, 380, 300, 200, 38, "开始新游戏", "newGame");
  const continueButton = addButton(game.ui, 380, 348, 200, 38, "继续游戏", "continueGame", !hasResume);
  const loadButton = addButton(game.ui, 380, 396, 200, 38, "读取存档", "loadSave", !hasSlotSave);
  drawButton(ctx, newGameButton, game.input);
  drawButton(ctx, continueButton, game.input);
  drawButton(ctx, loadButton, game.input);

  const saveText = hasSlotSave ? "检测到正式存档" : "暂无正式存档";
  drawPixelText(ctx, saveText, CONFIG.canvasWidth / 2, 444, hasSlotSave ? UI_TEXT.body : UI_TEXT.empty, 12, "center");
}

function drawSaveSlotDialog(ctx, game) {
  if (!game.ui || !game.ui.saveSlotDialogOpen) {
    return;
  }

  const mode = game.ui.saveSlotDialogMode === "save" ? "save" : "load";
  const isSaveMode = mode === "save";
  const slots = getSaveSlots();
  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  const panelX = 260;
  const panelY = 138;
  const panelW = 440;
  drawPanel(ctx, panelX, panelY, panelW, 282, isSaveMode ? "保存存档" : "读取存档", "save");
  for (let i = 0; i < 3; i += 1) {
    const slot = slots[i];
    const action = (isSaveMode ? "saveGameSlot:" : "loadSaveSlot:") + i;
    const button = addButton(game.ui, 304, 188 + i * 58, 352, 46, "", action, !isSaveMode && !slot);
    drawButton(ctx, button, game.input);
    drawSaveSlotInfo(ctx, button, slot);
    if (slot) {
      const deleteButton = addButton(game.ui, 617, button.y + 22, 18, 18, "", "deleteSaveSlot:" + i);
      drawDeleteSaveButton(ctx, deleteButton, game.input);
    }
  }
  const closeButton = addButton(game.ui, 428, 368, 104, 30, "取消", "closeSaveSlotDialog");
  drawButton(ctx, closeButton, game.input);
}

function drawDeleteSaveButton(ctx, button, input) {
  const hovered = input && !button.disabled
    && input.mouse.x >= button.x
    && input.mouse.x <= button.x + button.w
    && input.mouse.y >= button.y
    && input.mouse.y <= button.y + button.h;
  const pressed = Boolean(hovered && input.mouse.down);
  const x = button.x;
  const y = button.y + (pressed ? 1 : 0);
  const red = hovered ? "#8a2f36" : "#5f1f25";

  ctx.save();
  ctx.fillStyle = pressed ? "rgba(95,31,37,0.28)" : hovered ? "rgba(95,31,37,0.18)" : "rgba(0,0,0,0.08)";
  ctx.fillRect(x, y, button.w, button.h);
  ctx.strokeStyle = red;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, button.w - 1, button.h - 1);

  const cx = x + Math.floor(button.w / 2);
  const top = y + 4;
  ctx.strokeStyle = red;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 5, top + 2);
  ctx.lineTo(cx + 5, top + 2);
  ctx.moveTo(cx - 2, top);
  ctx.lineTo(cx + 2, top);
  ctx.moveTo(cx - 4, top + 4);
  ctx.lineTo(cx - 3, top + 11);
  ctx.lineTo(cx + 3, top + 11);
  ctx.lineTo(cx + 4, top + 4);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 1.5, top + 6);
  ctx.lineTo(cx - 1.5, top + 10);
  ctx.moveTo(cx + 1.5, top + 6);
  ctx.lineTo(cx + 1.5, top + 10);
  ctx.stroke();
  ctx.restore();
}

function drawSaveSlotInfo(ctx, button, slot) {
  const x = button.x;
  const y = button.y;
  const disabled = button.disabled;
  if (!slot) {
    drawPixelText(ctx, "空存档", x + 18, y + 14, disabled ? UI_TEXT.dim : "#ffe08a", 13);
    return;
  }

  const player = slot.player || {};
  const name = player.name || "玩家";
  const level = Math.max(1, Math.floor(player.level || 1));
  const day = Math.max(1, Math.floor(player.day || 1));
  const gold = formatSaveGold(player.gold);
  const explored = getSaveExplorePercent(slot);
  const armySize = getSaveArmySize(player);
  const townCount = getSaveTownCount(slot);
  const time = slot.savedAt ? formatSaveTime(slot.savedAt) : "";

  const detailLine = "第" + day + "日  金币 " + gold + "  兵数 " + armySize + "    城市 " + townCount + "  探索 " + explored + "%";
  drawPixelText(ctx, fitSlotText(name + "  Lv." + level, 18), x + 18, y + 8, "#ffd56a", 12);
  drawPixelText(ctx, detailLine, x + 18, y + 27, UI_TEXT.body, 10);
  if (time) {
    drawPixelText(ctx, time, x + button.w - 14, y + 8, UI_TEXT.muted, 10, "right");
  }
}

function fitSlotText(text, maxChars) {
  const value = String(text || "");
  if (value.length <= maxChars) {
    return value;
  }
  return value.slice(0, Math.max(1, maxChars - 2)) + "..";
}

function getSaveExplorePercent(slot) {
  const fog = slot && slot.fog;
  const cells = fog && Array.isArray(fog.cells) ? fog.cells : [];
  if (!cells.length) {
    return 0;
  }
  let explored = 0;
  for (let i = 0; i < cells.length; i += 1) {
    if (Number(cells[i]) > 0) {
      explored += 1;
    }
  }
  return Math.round((explored / cells.length) * 100);
}

function getSaveArmySize(player) {
  const army = player && Array.isArray(player.army) ? player.army : [];
  return army.reduce(function (sum, unit) {
    return sum + Math.max(0, Math.floor(Number(unit.count) || 0));
  }, 0);
}

function getSaveTownCount(slot) {
  const towns = slot && Array.isArray(slot.towns) ? slot.towns : [];
  return towns.reduce(function (sum, town) {
    return sum + (town && town.owner === "player" ? 1 : 0);
  }, 0);
}

function formatSaveGold(value) {
  const amount = Math.max(0, Math.floor(Number(value) || 0));
  if (amount >= 1000000) {
    return Math.floor(amount / 10000) + "万";
  }
  if (amount >= 10000) {
    return Math.round(amount / 1000) / 10 + "万";
  }
  return String(amount);
}

function formatSaveTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return month + "-" + day + " " + hour + ":" + minute;
}

function drawCoverImage(ctx, image, x, y, w, h) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

  if (imageRatio > boxRatio) {
    sw = image.naturalHeight * boxRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / boxRatio;
    sy = (image.naturalHeight - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

// ==================== 世界地图渲染 ====================

function renderWorld(ctx, game) {
  renderWorldScene(ctx, game);
  drawMiniMapOverlay(ctx, game);
}

function drawMapLayer(ctx, game) {
  const { map, camera } = game;
  const tileSize = CONFIG.tileSize;
  const startCol = Math.floor(camera.x / tileSize);
  const endCol = Math.ceil((camera.x + CONFIG.canvasWidth) / tileSize);
  const startRow = Math.floor(camera.y / tileSize);
  const endRow = Math.ceil((camera.y + CONFIG.canvasHeight) / tileSize);

  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      if (!map.tiles[row] || typeof map.tiles[row][col] !== "number") {
        continue;
      }
      const terrain = getTerrainById(map.tiles[row][col]);
      const sx = Math.round(col * tileSize - camera.x);
      const sy = Math.round(row * tileSize - camera.y);
      drawTile(ctx, terrain, sx, sy, tileSize, col, row);
    }
  }

  // 装饰物
  for (const deco of map.decorations) {
    const sx = Math.round(deco.x - camera.x);
    const sy = Math.round(deco.y - camera.y);
    if (sx < -20 || sy < -20 || sx > CONFIG.canvasWidth + 20 || sy > CONFIG.canvasHeight + 20) continue;
    drawDecoration(ctx, deco, sx, sy);
  }

  // 城池
  for (const town of map.towns) {
    drawTownOnMap(ctx, game, town);
  }

  for (const resource of map.resources || []) {
    drawResourceOnMap(ctx, game, resource);
  }
}

function drawTile(ctx, terrain, x, y, size, col, row) {
  ctx.fillStyle = terrain.color;
  ctx.fillRect(x, y, size, size);

  // 网格暗线
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(x + size - 1, y, 1, size);
  ctx.fillRect(x, y + size - 1, size, 1);

  // 明线高光
  if ((col + row) % 2 === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(x, y, size, 1);
  }

  // 水域波纹
  if (terrain.id === TERRAIN.water.id) {
    ctx.fillStyle = "rgba(121,173,205,0.18)";
    const waveY = ((col * 7 + row * 5 + Math.floor(Date.now() / 1200)) % 16);
    ctx.fillRect(x + 2, y + waveY, size - 4, 2);
    ctx.fillStyle = "rgba(80,140,170,0.09)";
    ctx.fillRect(x + 6, y + (waveY + 8) % 16, size - 12, 1);
  }

  // 道路纹理
  if (terrain.id === TERRAIN.road.id) {
    ctx.fillStyle = "rgba(220,180,110,0.13)";
    ctx.fillRect(x, y + size / 2 - 3, size, 6);
    ctx.fillStyle = "rgba(180,150,90,0.08)";
    ctx.fillRect(x + size / 2 - 1, y, 2, size);
  }

  // 山脉纹理
  if (terrain.id === TERRAIN.mountain.id) {
    drawMountainTile(ctx, x, y, size, col, row);
  }

  // 森林纹理
  if (terrain.id === TERRAIN.forest.id) {
    ctx.fillStyle = "rgba(30,60,25,0.2)";
    ctx.fillRect(x + 2, y + 4, size - 4, size - 8);
    ctx.fillStyle = "rgba(45,80,35,0.12)";
    ctx.fillRect(x + 6, y + 2, size - 12, size - 4);
  }
}

function drawMountainTile(ctx, x, y, size, col, row) {
  ctx.fillStyle = "#3f392f";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#4d473c";
  ctx.fillRect(x + 2, y + 6, size - 4, size - 8);

  const peakShift = ((col * 7 + row * 5) % 9) - 4;
  ctx.fillStyle = "#251f1b";
  ctx.beginPath();
  ctx.moveTo(x + 2, y + size);
  ctx.lineTo(x + size / 2 + peakShift, y + 3);
  ctx.lineTo(x + size - 2, y + size);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#5f584b";
  ctx.beginPath();
  ctx.moveTo(x + 8, y + size - 5);
  ctx.lineTo(x + size / 2 + peakShift, y + 5);
  ctx.lineTo(x + size / 2 + 2, y + size - 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#b6aa8c";
  ctx.fillRect(x + Math.round(size / 2 + peakShift) - 4, y + 5, 8, 2);
  ctx.fillRect(x + Math.round(size / 2 + peakShift) - 2, y + 8, 4, 2);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x, y + size - 4, size, 4);
}

function drawDecoration(ctx, deco, x, y) {
  if (deco.type === "tree") {
    // 树干
    ctx.fillStyle = "#4a3520";
    ctx.fillRect(Math.round(x - 2), Math.round(y + 2), 4, 8);
    // 树冠下层
    ctx.fillStyle = "#1e351c";
    ctx.fillRect(Math.round(x - 8), Math.round(y - 2), 16, 10);
    // 树冠上层
    ctx.fillStyle = "#2d4f28";
    ctx.fillRect(Math.round(x - 6), Math.round(y - 8), 12, 9);
    // 高光点
    ctx.fillStyle = "#42883a";
    ctx.fillRect(Math.round(x), Math.round(y - 6), 3, 3);
  } else {
    // 石块
    ctx.fillStyle = "#6b6257";
    ctx.fillRect(Math.round(x - 4), Math.round(y - 2), 8, 5);
    ctx.fillStyle = "#5a5249";
    ctx.fillRect(Math.round(x - 3), Math.round(y - 3), 6, 3);
    ctx.fillStyle = "#7d7469";
    ctx.fillRect(Math.round(x), Math.round(y - 2), 2, 2);
  }
}

// ==================== 城池在地图上的绘制 ====================

function drawTownOnMap(ctx, game, town) {
  const sx = Math.round(town.x - game.camera.x);
  const sy = Math.round(town.y - game.camera.y);
  if (sx < -60 || sy < -60 || sx > CONFIG.canvasWidth + 60 || sy > CONFIG.canvasHeight + 60) return;

  const faction = FACTIONS[town.owner];

  // 地面阴影
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(sx - 20, sy + 17, 40, 8);
  ctx.fillRect(sx - 16, sy + 20, 32, 5);

  if (town.kind === "castle") {
    drawCastleSprite(ctx, sx, sy, faction.color);
  } else if (town.kind === "tavern") {
    drawTavernSprite(ctx, sx, sy, faction.color);
  } else {
    drawVillageSprite(ctx, sx, sy, faction.color);
  }

  // 名字标签
  drawPixelText(ctx, town.name, sx, sy + 24, "#f8e9bd", 11, "center");
}

function drawResourceOnMap(ctx, game, resource) {
  const sx = Math.round(resource.x - game.camera.x);
  const sy = Math.round(resource.y - game.camera.y);
  if (sx < -50 || sy < -50 || sx > CONFIG.canvasWidth + 50 || sy > CONFIG.canvasHeight + 50) return;

  const owned = resource.owner === "player";
  const color = owned ? "#ffd56a" : "#b9a77a";

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(sx - 14, sy + 12, 28, 5);

  if (resource.kind === "mine") {
    ctx.fillStyle = "#3c3732";
    ctx.fillRect(sx - 15, sy - 2, 30, 16);
    ctx.fillStyle = "#5d554c";
    ctx.fillRect(sx - 11, sy - 9, 22, 10);
    ctx.fillStyle = "#211d1a";
    ctx.fillRect(sx - 5, sy + 1, 10, 13);
    ctx.fillStyle = color;
    ctx.fillRect(sx - 13, sy - 4, 4, 4);
    ctx.fillRect(sx + 9, sy - 3, 4, 3);
  } else {
    ctx.fillStyle = "#7a5a30";
    ctx.fillRect(sx - 16, sy - 6, 32, 20);
    ctx.fillStyle = "#4f7d3f";
    for (let i = -14; i <= 12; i += 6) {
      ctx.fillRect(sx + i, sy - 4, 3, 17);
    }
    ctx.fillStyle = color;
    ctx.fillRect(sx - 5, sy - 15, 10, 8);
  }

  drawPixelText(ctx, resource.name, sx, sy + 18, color, 10, "center");
}

function drawCastleSprite(ctx, cx, cy, color) {
  const stone = "#4a4540";
  const stoneDark = "#2b2724";
  const stoneLight = "#67615a";

  ctx.fillStyle = stoneDark;
  ctx.fillRect(cx - 25, cy - 13, 50, 24);
  ctx.fillRect(cx - 12, cy - 29, 24, 39);

  // 侧塔
  ctx.fillStyle = stone;
  ctx.fillRect(cx - 23, cy - 18, 13, 29);
  ctx.fillRect(cx + 10, cy - 18, 13, 29);
  ctx.fillRect(cx - 9, cy - 31, 18, 41);

  // 石块纹理
  ctx.fillStyle = stoneLight;
  for (let y = -24; y <= 4; y += 8) {
    ctx.fillRect(cx - 7, cy + y, 5, 2);
    ctx.fillRect(cx + 2, cy + y + 3, 6, 2);
  }
  for (let x = -21; x <= 17; x += 10) {
    ctx.fillRect(cx + x, cy - 8, 6, 2);
    ctx.fillRect(cx + x + 4, cy + 1, 5, 2);
  }

  // 城垛和屋脊
  ctx.fillStyle = color;
  ctx.fillRect(cx - 27, cy - 19, 54, 7);
  ctx.fillRect(cx - 13, cy - 34, 26, 8);
  for (let x = -25; x <= 21; x += 9) {
    ctx.fillRect(cx + x, cy - 24, 5, 7);
  }
  ctx.fillRect(cx - 11, cy - 39, 5, 7);
  ctx.fillRect(cx - 2, cy - 40, 4, 8);
  ctx.fillRect(cx + 7, cy - 39, 5, 7);

  // 门、窗、火光
  ctx.fillStyle = "#130c07";
  ctx.fillRect(cx - 6, cy - 4, 12, 15);
  ctx.fillStyle = "#8f682e";
  ctx.fillRect(cx - 4, cy - 1, 3, 10);
  ctx.fillRect(cx + 1, cy - 1, 3, 10);
  ctx.fillStyle = "#ffd56a";
  ctx.fillRect(cx - 18, cy - 9, 4, 5);
  ctx.fillRect(cx + 14, cy - 9, 4, 5);
  ctx.fillRect(cx - 3, cy - 22, 6, 5);

  // 旗帜
  const wave = Math.round(Math.sin(Date.now() / 420 + cx) * 1.5);
  ctx.fillStyle = "#d6a84f";
  ctx.fillRect(cx - 1, cy - 49, 2, 13);
  ctx.fillStyle = color;
  ctx.fillRect(cx + 1 + wave, cy - 49, 15, 8);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(cx + 3 + wave, cy - 47, 8, 2);
}

function drawTavernSprite(ctx, cx, cy, color) {
  ctx.fillStyle = "#2b1b10";
  ctx.fillRect(cx - 19, cy - 10, 38, 21);
  ctx.fillStyle = "#6a4528";
  ctx.fillRect(cx - 16, cy - 9, 32, 20);
  ctx.fillStyle = "#8a6040";
  ctx.fillRect(cx - 14, cy - 7, 28, 3);
  ctx.fillRect(cx - 14, cy + 2, 28, 2);

  // 屋顶瓦片
  ctx.fillStyle = darkenColor(color, 0.15);
  ctx.fillRect(cx - 22, cy - 19, 44, 9);
  ctx.fillStyle = color;
  ctx.fillRect(cx - 18, cy - 24, 36, 8);
  for (let x = -18; x < 18; x += 8) {
    ctx.fillStyle = x % 16 === 0 ? color : darkenColor(color, 0.08);
    ctx.fillRect(cx + x, cy - 23, 7, 12);
  }

  // 烟囱与烟
  ctx.fillStyle = "#3d2512";
  ctx.fillRect(cx + 9, cy - 30, 6, 13);
  ctx.fillStyle = "rgba(185,167,122,0.45)";
  ctx.fillRect(cx + 12, cy - 36, 5, 3);
  ctx.fillRect(cx + 16, cy - 41, 4, 3);

  // 门窗招牌
  ctx.fillStyle = "#170d07";
  ctx.fillRect(cx - 4, cy - 1, 8, 12);
  ctx.fillStyle = "#d6a84f";
  ctx.fillRect(cx - 2, cy + 4, 2, 2);
  ctx.fillStyle = "#ffd56a";
  ctx.fillRect(cx - 13, cy - 5, 6, 5);
  ctx.fillRect(cx + 7, cy - 5, 6, 5);
  ctx.fillStyle = "#d6a84f";
  ctx.fillRect(cx + 18, cy - 16, 3, 21);
  ctx.fillStyle = "#ffd56a";
  ctx.fillRect(cx + 13, cy - 26, 15, 9);
  ctx.fillStyle = "#5a3d28";
  ctx.fillRect(cx + 16, cy - 24, 9, 2);
}

function drawVillageSprite(ctx, cx, cy, color) {
  // 小屋群
  drawHut(ctx, cx - 14, cy - 1, 15, 13, color);
  drawHut(ctx, cx + 5, cy, 17, 12, darkenColor(color, 0.08));
  drawHut(ctx, cx - 1, cy - 10, 13, 11, "#8a6b3d");

  // 水井和农田
  ctx.fillStyle = "#5a5249";
  ctx.fillRect(cx - 4, cy + 9, 8, 5);
  ctx.fillStyle = "#25354a";
  ctx.fillRect(cx - 2, cy + 10, 4, 2);
  ctx.fillStyle = "rgba(214,168,79,0.2)";
  for (let i = 0; i < 4; i += 1) {
    ctx.fillRect(cx + 12 + i * 4, cy + 6 + i % 2, 2, 10);
  }

  // 围栏
  ctx.fillStyle = "#8a6e50";
  for (let i = -22; i <= 20; i += 7) {
    ctx.fillRect(cx + i, cy + 14, 2, 7);
  }
  ctx.fillRect(cx - 24, cy + 16, 50, 2);
}

function drawHut(ctx, x, y, w, h, roofColor) {
  ctx.fillStyle = "#2b1b10";
  ctx.fillRect(x - Math.floor(w / 2) - 1, y - h + 1, w + 2, h + 2);
  ctx.fillStyle = "#7a6040";
  ctx.fillRect(x - Math.floor(w / 2), y - h + 2, w, h);
  ctx.fillStyle = roofColor;
  ctx.fillRect(x - Math.floor(w / 2) - 3, y - h - 4, w + 6, 6);
  ctx.fillRect(x - Math.floor(w / 2), y - h - 8, w, 5);
  ctx.fillStyle = "#150d07";
  ctx.fillRect(x - 2, y - 5, 4, 7);
  ctx.fillStyle = "#ffd56a";
  ctx.fillRect(x + Math.floor(w / 2) - 5, y - h + 5, 3, 3);
}

// ==================== 世界地图单位绘制 ====================

function drawUnitLayer(ctx, game) {
  // 先画 NPC
  for (const npc of game.npcs) {
    if (npc.stationed) {
      continue;
    }
    const color = FACTIONS[npc.faction] ? FACTIONS[npc.faction].color : "#b9a77a";
    drawMapParty(ctx, game, npc, color, npc.name, false);
  }
  // 再画玩家（总是最前）
  drawMapParty(ctx, game, game.player, "#ffd56a", "领主", true);

  // 移动目标指示器
  if (game.player.target) {
    const tx = Math.round(game.player.target.x - game.camera.x);
    const ty = Math.round(game.player.target.y - game.camera.y);
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(255,213,106,${pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(tx - 6.5, ty - 6.5, 13, 13);
    ctx.fillStyle = `rgba(255,213,106,${pulse * 0.3})`;
    ctx.fillRect(tx - 4, ty - 4, 8, 8);
  }
}

function drawMapParty(ctx, game, unit, color, label, isPlayer) {
  const sx = Math.round(unit.x - game.camera.x);
  const sy = Math.round(unit.y - game.camera.y);
  if (sx < -40 || sy < -40 || sx > CONFIG.canvasWidth + 40 || sy > CONFIG.canvasHeight + 40) return;

  ctx.save();

  // 阴影
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.fillRect(sx - 14, sy + 13, 28, 6);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(sx - 8, sy + 16, 16, 3);

  // 旗帜（背后）
  const wave = Math.round(Math.sin(Date.now() / 400 + unit.x) * 1.5);
  ctx.fillStyle = "#5f3f17";
  ctx.fillRect(sx - 2, sy - 25, 2, 26);
  ctx.fillStyle = isPlayer ? "#ffd56a" : color;
  ctx.fillRect(sx + wave, sy - 27, 13, 8);
  ctx.fillStyle = isPlayer ? "#c94f3f" : "rgba(255,255,255,0.18)";
  ctx.fillRect(sx + 2 + wave, sy - 25, 8, 3);

  // 腿和靴
  const step = Math.round(Math.sin(Date.now() / 180 + unit.x * 0.05) * 1);
  ctx.fillStyle = "#33261a";
  ctx.fillRect(sx - 5, sy + 4, 4, 9 + step);
  ctx.fillRect(sx + 2, sy + 4, 4, 9 - step);
  ctx.fillStyle = "#1b120a";
  ctx.fillRect(sx - 6, sy + 13 + step, 6, 3);
  ctx.fillRect(sx + 1, sy + 13 - step, 6, 3);

  // 披风
  ctx.fillStyle = isPlayer ? "#7f2f27" : darkenColor(color, 0.32);
  ctx.fillRect(sx - 9, sy - 10, 18, 19);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(sx - 9, sy + 4, 18, 5);

  // 身体（盔甲）
  ctx.fillStyle = "#1a1008";
  ctx.fillRect(sx - 8, sy - 10, 16, 19);
  ctx.fillStyle = color;
  ctx.fillRect(sx - 7, sy - 9, 14, 16);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(sx - 5, sy - 7, 4, 11);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(sx + 4, sy - 6, 2, 12);
  ctx.fillStyle = "#d6a84f";
  ctx.fillRect(sx - 8, sy + 1, 16, 2);

  // 头盔与脸
  ctx.fillStyle = "#d9c2a0";
  ctx.fillRect(sx - 5, sy - 17, 10, 9);
  ctx.fillStyle = isPlayer ? "#d6a84f" : darkenColor(color, 0.12);
  ctx.fillRect(sx - 7, sy - 22, 14, 8);
  ctx.fillRect(sx - 5, sy - 25, 10, 4);
  ctx.fillStyle = "rgba(255,255,255,0.24)";
  ctx.fillRect(sx - 5, sy - 20, 5, 2);
  ctx.fillStyle = "#0a0603";
  ctx.fillRect(sx - 3, sy - 16, 2, 2);
  ctx.fillRect(sx + 2, sy - 16, 2, 2);

  // 盾牌（右侧）
  ctx.fillStyle = "#1a1008";
  ctx.fillRect(sx + 7, sy - 10, 9, 16);
  ctx.fillStyle = isPlayer ? "#ffd56a" : color;
  ctx.fillRect(sx + 8, sy - 9, 7, 14);
  ctx.fillStyle = isPlayer ? "#d6a84f" : "rgba(0,0,0,0.22)";
  ctx.fillRect(sx + 10, sy - 7, 3, 10);

  // 武器（左侧伸出）
  ctx.fillStyle = "#8a7050";
  ctx.fillRect(sx - 13, sy - 5, 10, 2);
  ctx.fillStyle = "#d8d2c6";
  ctx.fillRect(sx - 15, sy - 8, 3, 8);
  ctx.fillStyle = "#f3ead8";
  ctx.fillRect(sx - 16, sy - 6, 5, 2);

  if (isPlayer) {
    ctx.fillStyle = "#ffd56a";
    ctx.fillRect(sx - 2, sy - 28, 4, 3);
  }

  // 名字标签
  const labelColor = isPlayer ? "#ffd56a" : "#f8e9bd";
  const fontSize = isPlayer ? 11 : 10;
  drawPixelText(ctx, label, sx, sy + 18, labelColor, fontSize, "center");

  ctx.restore();
}

// ==================== 小地图 ====================

function drawMiniMap(ctx, game) {
  const x = 774;
  const y = 370;
  const w = 170;
  const h = 138;
  drawPanel(ctx, x, y, w, h, "小地图");

  const scaleX = (w - 22) / game.map.width;
  const scaleY = (h - 30) / game.map.height;
  const ox = x + 11;
  const oy = y + 20;
  const mapW = w - 22;
  const mapH = h - 30;
  const cellW = Math.ceil(mapW / game.map.cols) + 1;
  const cellH = Math.ceil(mapH / game.map.rows) + 1;

  const terrainCanvas = getMiniMapTerrainCanvas(game.map, mapW, mapH, cellW, cellH, scaleX, scaleY);
  ctx.drawImage(terrainCanvas, ox - 1, oy - 1);

  // 城池点位
  for (const town of game.map.towns) {
    const mx = Math.round(ox + town.x * scaleX);
    const my = Math.round(oy + town.y * scaleY);
    const color = getMiniMapFactionColor(town.owner);
    const hasStationedArmy = game.npcs.some((npc) => npc.stationed && npc.homeTownId === town.id && npc.alive !== false);
    drawMiniMapTownIcon(ctx, mx, my, color, town.kind, hasStationedArmy);
  }

  for (const resource of game.map.resources || []) {
    const mx = Math.round(ox + resource.x * scaleX);
    const my = Math.round(oy + resource.y * scaleY);
    const ownerColor = FACTIONS[resource.owner] ? FACTIONS[resource.owner].color : "#8f8060";
    drawMiniMapResourceIcon(ctx, mx, my, resource.kind, ownerColor, resource.owner === "player");
  }

  // NPC 位置
  for (const npc of game.npcs) {
    if (npc.stationed) {
      continue;
    }
    ctx.fillStyle = FACTIONS[npc.faction] ? FACTIONS[npc.faction].color : "#777";
    ctx.fillRect(
      Math.round(ox + npc.x * scaleX) - 1,
      Math.round(oy + npc.y * scaleY) - 1,
      3, 3
    );
  }

  // 玩家位置（闪烁）
  const pulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
  drawMiniMapPlayerArrow(
    ctx,
    Math.round(ox + game.player.x * scaleX),
    Math.round(oy + game.player.y * scaleY),
    MINIMAP_ICON_COLORS.playerArrow,
    pulse
  );

  // 摄像机视野
  ctx.strokeStyle = "#f8e9bd";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    Math.round(ox + game.camera.x * scaleX) + 0.5,
    Math.round(oy + game.camera.y * scaleY) + 0.5,
    Math.round(CONFIG.canvasWidth * scaleX),
    Math.round(CONFIG.canvasHeight * scaleY)
  );
}

function drawMiniMapTownIcon(ctx, x, y, color, kind, stationed) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const scale = Math.max(0.45, Math.min(1.6, MINIMAP_ICON_SETTINGS.townScale || 1));
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  x = 0;
  y = 0;

  // Reference-style castle silhouette. Every visible pixel uses the configured faction color.
  ctx.fillStyle = color;

  // Upper keep.
  ctx.fillRect(x - 3, y - 8, 2, 3);
  ctx.fillRect(x, y - 9, 2, 4);
  ctx.fillRect(x + 3, y - 8, 2, 3);
  ctx.fillRect(x - 4, y - 5, 10, 2);
  ctx.fillRect(x - 3, y - 3, 8, 2);

  // Front battlements.
  ctx.fillRect(x - 6, y - 2, 2, 2);
  ctx.fillRect(x - 3, y - 2, 2, 2);
  ctx.fillRect(x, y - 2, 2, 2);
  ctx.fillRect(x + 3, y - 2, 2, 2);
  ctx.fillRect(x + 6, y - 2, 2, 2);
  ctx.fillRect(x - 7, y, 16, 2);

  // Lower towers and hall. The gaps are transparent windows/door.
  ctx.fillRect(x - 6, y + 2, 3, 5);
  ctx.fillRect(x + 5, y + 2, 3, 5);
  ctx.fillRect(x - 2, y + 2, 2, 5);
  ctx.fillRect(x + 2, y + 2, 2, 5);
  ctx.fillRect(x, y + 2, 2, 2);
  ctx.fillRect(x - 2, y + 6, 7, 2);

  if (stationed) {
    ctx.fillRect(x + 3, y - 11, 1, 3);
    ctx.fillRect(x + 4, y - 11, 3, 1);
  }

  if (kind === "castle") {
    ctx.fillRect(x - 8, y - 3, 1, 3);
    ctx.fillRect(x + 8, y - 3, 1, 3);
  } else if (kind === "tavern") {
    ctx.fillRect(x + 5, y - 7, 3, 1);
    ctx.fillRect(x + 6, y - 6, 1, 3);
  }

  ctx.restore();
}

function getMiniMapFactionColor(factionId) {
  return MINIMAP_FACTION_COLORS[factionId]
    || (FACTIONS[factionId] ? FACTIONS[factionId].color : "#f0e0a6");
}

function drawMiniMapResourceIcon(ctx, x, y, kind, ownerColor, ownedByPlayer) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const scaleKey = kind === "mine" ? "mineScale" : "farmScale";
  const scale = Math.max(0.35, Math.min(1.4, MINIMAP_ICON_SETTINGS[scaleKey] || 1));
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  x = 0;
  y = 0;
  const accent = ownedByPlayer ? MINIMAP_ICON_COLORS.ownedAccent : ownerColor;

  if (kind === "mine") {
    ctx.fillStyle = MINIMAP_ICON_COLORS.mineBody;
    ctx.fillRect(x - 15, y - 2, 30, 16);
    ctx.fillStyle = MINIMAP_ICON_COLORS.mineTop;
    ctx.fillRect(x - 11, y - 9, 22, 10);
    ctx.fillStyle = MINIMAP_ICON_COLORS.mineDoor;
    ctx.fillRect(x - 5, y + 1, 10, 13);
    ctx.fillStyle = accent;
    ctx.fillRect(x - 13, y - 4, 4, 4);
    ctx.fillRect(x + 9, y - 3, 4, 3);
    ctx.fillStyle = MINIMAP_ICON_COLORS.mineAccent;
    ctx.fillRect(x - 1, y - 6, 3, 3);
  } else {
    ctx.fillStyle = MINIMAP_ICON_COLORS.farmSoil;
    ctx.fillRect(x - 16, y - 6, 32, 20);
    ctx.fillStyle = MINIMAP_ICON_COLORS.farmCrop;
    for (let i = -14; i <= 12; i += 6) {
      ctx.fillRect(x + i, y - 4, 3, 17);
    }
    ctx.fillStyle = accent;
    ctx.fillRect(x - 5, y - 15, 10, 8);
    ctx.fillStyle = MINIMAP_ICON_COLORS.farmBarn;
    ctx.fillRect(x - 2, y - 12, 4, 4);
  }

  ctx.restore();
}

function drawMiniMapPlayerArrow(ctx, x, y, color, alpha) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const scale = Math.max(0.45, Math.min(1.8, MINIMAP_ICON_SETTINGS.playerScale || 1));
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(8, 7);
  ctx.lineTo(0, 4);
  ctx.lineTo(-8, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function getMiniMapTerrainCanvas(map, mapW, mapH, cellW, cellH, scaleX, scaleY) {
  const key = [
    map.cols,
    map.rows,
    map.width,
    map.height,
    mapW,
    mapH,
    map.tilesVersion || 0
  ].join(":");

  if (miniMapTerrainCache.canvas && miniMapTerrainCache.key === key) {
    return miniMapTerrainCache.canvas;
  }

  const canvas = document.createElement("canvas");
  canvas.width = mapW + 2;
  canvas.height = mapH + 2;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#110b05";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < map.rows; row += 1) {
    for (let col = 0; col < map.cols; col += 1) {
      const terrain = getTerrainById(map.tiles[row][col]);
      ctx.fillStyle = terrain.color;
      ctx.fillRect(
        1 + Math.floor(col * CONFIG.tileSize * scaleX),
        1 + Math.floor(row * CONFIG.tileSize * scaleY),
        cellW,
        cellH
      );
    }
  }

  miniMapTerrainCache.key = key;
  miniMapTerrainCache.canvas = canvas;
  return canvas;
}

// ==================== 战斗场景渲染 ====================

function renderBattle(ctx, game) {
  const battle = game.battle;
  game.ui.buttons.length = 0;
  clearBattleBackground(ctx);
  drawPanel(ctx, 20, 20, 920, 500, getBattleTitle(battle), "battle");
  drawBattleField(ctx);
  drawBattleUnits(ctx, battle);
  drawBattleEffects(ctx, battle);
  drawBattleUi(ctx, game, battle);
}

function clearBattleBackground(ctx) {
  // 天空
  const skyGrad = ctx.createLinearGradient(0, 0, 0, CONFIG.canvasHeight);
  skyGrad.addColorStop(0, "#89b8dc");
  skyGrad.addColorStop(0.45, "#d4b87f");
  skyGrad.addColorStop(1, "#607a4b");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  const horizonGlow = ctx.createLinearGradient(0, 54, 0, 180);
  horizonGlow.addColorStop(0, "rgba(255,232,174,0.42)");
  horizonGlow.addColorStop(0.55, "rgba(255,194,113,0.18)");
  horizonGlow.addColorStop(1, "rgba(255,194,113,0)");
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, 54, CONFIG.canvasWidth, 126);

  ctx.fillStyle = "rgba(255,248,220,0.42)";
  for (let i = 0; i < 8; i += 1) {
    const cx = 36 + i * 126;
    const cy = 28 + (i % 3) * 10;
    ctx.fillRect(cx, cy, 54, 5);
    ctx.fillRect(cx + 18, cy - 5, 46, 5);
    ctx.fillRect(cx + 64, cy + 2, 30, 4);
  }

  // 远处山影
  ctx.fillStyle = "rgba(82,94,65,0.38)";
  for (let i = 0; i < 18; i += 1) {
    const mx = i * 58;
    const mh = 28 + Math.sin(i * 1.7) * 16;
    ctx.fillRect(mx, 66, 48, mh);
  }
  ctx.fillStyle = "rgba(104,128,79,0.26)";
  for (let i = 0; i < 14; i += 1) {
    const mx = i * 72 + 20;
    const mh = 18 + Math.sin(i * 1.3) * 10;
    ctx.fillRect(mx, 94, 62, mh);
  }
}

function drawBattleField(ctx) {
  const x = 30;
  const y = 92;
  const w = 900;
  const h = 300;

  // 草地
  ctx.fillStyle = "#506f35";
  ctx.fillRect(x, y, w, h);

  const fieldGrad = ctx.createLinearGradient(0, y, 0, y + h);
  fieldGrad.addColorStop(0, "rgba(148,179,82,0.24)");
  fieldGrad.addColorStop(0.62, "rgba(60,90,43,0.08)");
  fieldGrad.addColorStop(1, "rgba(28,39,20,0.16)");
  ctx.fillStyle = fieldGrad;
  ctx.fillRect(x, y, w, h);

  // 草地纹理
  ctx.fillStyle = "#7f9e4d";
  for (let i = 0; i < 36; i += 1) {
    ctx.fillRect(x + i * 26 + (i % 3) * 4, y + h - 48 + (i % 2) * 8, 14, 2);
  }
  ctx.fillStyle = "#3f642e";
  for (let i = 0; i < 28; i += 1) {
    ctx.fillRect(x + i * 34 + 7, y + 20 + (i % 3) * 12, 10, 2);
  }

  // 泥土 / 道路
  ctx.fillStyle = "#8a6335";
  ctx.fillRect(x, y + h - 28, w, 28);
  ctx.fillStyle = "#b18248";
  ctx.fillRect(x, y + h - 26, w, 4);

  // 石子和车辙
  ctx.fillStyle = "rgba(227,190,122,0.55)";
  for (let i = 0; i < 22; i += 1) {
    ctx.fillRect(x + i * 44 + 6, y + h - 24 + (i % 2) * 5, 3, 2);
  }

  // 框线
  ctx.strokeStyle = "#b98a42";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

// ==================== 战斗单位精灵绘制 ====================

function drawBattleUnits(ctx, battle) {
  const offsetX = 30;
  const offsetY = 92;
  const sorted = [...battle.units].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const time = typeof battle.time === "number" ? battle.time : Date.now() / 1000;

  for (const unit of sorted) {
    const alpha = unit.dead ? Math.max(0, 1 - unit.deathTimer * 2.5) : 1;
    if (alpha <= 0) continue;

    const x = offsetX + unit.x;
    const y = offsetY + unit.y;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 阴影
    drawBattleGroundShadow(ctx, x, y, unit);

    // 根据单位类型绘制不同精灵
    if (unit.dead) {
      drawPremiumDeadUnit(ctx, x, y, unit);
    } else {
      drawPremiumBattleSprite(ctx, x, y, unit, time);
    }

    // 血条
    if (!unit.dead) {
      drawBattleHealthBar(ctx, x, y, unit);
    }

    ctx.restore();
  }
}

function drawBattleGroundShadow(ctx, x, y, unit) {
  const w = unit.type === "cavalry" ? 46 : unit.general ? 34 : 28;
  const h = unit.type === "cavalry" ? 9 : 7;
  const shadowY = unit.type === "cavalry" ? y + 8 : y + 6;
  ctx.save();
  ctx.globalAlpha *= unit.dead ? 0.45 : 1;
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.fillRect(Math.round(x - w / 2), Math.round(shadowY), w, h);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(Math.round(x - w / 3), Math.round(shadowY + 3), Math.round(w * 0.66), 3);
  ctx.restore();
}

function drawBattleHealthBar(ctx, x, y, unit) {
  const barW = unit.type === "cavalry" ? 42 : unit.general ? 40 : 32;
  const barY = y - getPremiumBattleSpriteHeight(unit) - 9;
  const ratio = clamp(unit.hp / unit.maxHp, 0, 1);
  const fill = ratio > 0.55 ? "#63d16c" : ratio > 0.25 ? "#ffd56a" : "#ff7568";
  ctx.fillStyle = "rgba(5, 3, 2, 0.72)";
  ctx.fillRect(Math.round(x - barW / 2 - 1), Math.round(barY - 1), barW + 2, 6);
  drawBar(ctx, Math.round(x - barW / 2), Math.round(barY), barW, 4, ratio, fill, "#3a1510", "#1a0c05");
}

function getPremiumBattleSpriteHeight(unit) {
  if (unit.general) return 72;
  if (unit.type === "cavalry") return 68;
  if (unit.type === "mage") return 56;
  return 60;
}

function getPremiumBattleGroundOffset(unit) {
  if (unit.type === "cavalry") return 0;
  if (unit.general) return 4;
  return 3;
}

function drawPremiumBattleSprite(ctx, x, y, unit, time) {
  const dir = unit.dir || 1;
  const palette = getPremiumBattlePalette(unit);
  const attack = getPremiumAttackAnim(unit);
  const skill = clamp((unit.skillPulse || 0) / 0.48, 0, 1);
  const seed = unit.animSeed || 0;
  const bob = Math.round(Math.sin(time * (unit.type === "cavalry" ? 8 : 6) + seed) * (unit.type === "cavalry" ? 1.4 : 1));
  const lunge = Math.round(attack * (unit.type === "cavalry" ? 8 : 4));
  const groundOffset = getPremiumBattleGroundOffset(unit);

  ctx.save();
  ctx.translate(Math.round(x + dir * lunge), Math.round(y + bob + groundOffset));
  ctx.scale(dir, 1);

  if (skill > 0) {
    drawPremiumSkillAura(ctx, unit, palette, skill, time);
  }

  if (unit.general) {
    drawPremiumGeneralSprite(ctx, unit, palette, time, attack);
  } else if (unit.type === "cavalry") {
    drawPremiumCavalrySprite(ctx, unit, palette, time, attack);
  } else if (unit.type === "mage") {
    drawPremiumMageSprite(ctx, unit, palette, time, attack);
  } else {
    drawPremiumFootSoldierSprite(ctx, unit, palette, time, attack);
  }

  if ((unit.hitFlash || 0) > 0) {
    drawPremiumHitFlash(ctx, unit);
  }

  ctx.restore();

  if (unit.general) {
    drawPixelText(ctx, unit.name, x, y + 27, palette.trim, 10, "center");
  }
}

function getPremiumAttackAnim(unit) {
  const max = unit.type === "cavalry" || unit.general ? 0.35 : 0.25;
  return Math.sin(clamp((unit.attackPulse || 0) / max, 0, 1) * Math.PI);
}

function getPremiumBattlePalette(unit) {
  const base = unit.side === "left" ? unit.color : darkenColor(unit.color, 0.12);
  const level = Math.max(1, Math.floor(unit.stackLevel || 1));
  const elite = level >= 5;
  return {
    base,
    dark: darkenColor(base, 0.42),
    shade: darkenColor(base, 0.24),
    light: lightenColor(base, 0.28),
    trim: unit.side === "left" ? "#ffd56a" : "#ff8a74",
    trimDark: unit.side === "left" ? "#b8792d" : "#8f2f28",
    skin: unit.general ? "#f0d0a8" : "#e8d5b7",
    leather: "#5b3c21",
    leatherDark: "#2a1a0d",
    cloth: unit.side === "left" ? "#7f2f27" : "#3b2634",
    metal: elite ? "#e2c574" : level >= 3 ? "#b9c2c8" : "#87909a",
    metalDark: elite ? "#876b2c" : "#4d5660",
    horse: unit.side === "left" ? "#6a4424" : "#4b2c18",
    horseDark: "#2b180d",
    glow: unit.type === "mage" ? "#c79bff" : unit.side === "left" ? "#ffe6a6" : "#ff9a7a"
  };
}

function drawPremiumFootSoldierSprite(ctx, unit, palette, time, attack) {
  const step = Math.round(Math.sin(time * 9 + (unit.animSeed || 0)) * 2);
  const attacking = attack > 0.04;
  const armSwing = attacking ? Math.round(attack * 7) : 0;

  drawPremiumBackBanner(ctx, unit, palette, -7, -39, 20);
  drawPixelBlock(ctx, -12, -29, 24, 25, palette.cloth);
  drawPixelBlock(ctx, -10, -18, 20, 14, "rgba(0,0,0,0.14)");

  drawPixelBlock(ctx, -8, -12, 5, 14 + step, palette.leatherDark);
  drawPixelBlock(ctx, 3, -12, 5, 14 - step, palette.leatherDark);
  drawPixelBlock(ctx, -10, 1 + step, 8, 4, "#17100a");
  drawPixelBlock(ctx, 2, 1 - step, 8, 4, "#17100a");

  drawPixelBlock(ctx, -12, -32, 24, 22, palette.dark);
  drawPixelBlock(ctx, -9, -33, 18, 21, palette.base);
  drawPixelBlock(ctx, -7, -31, 5, 16, palette.light);
  drawPixelBlock(ctx, -13, -17, 26, 4, palette.leather);
  drawPixelBlock(ctx, -3, -18, 6, 5, palette.trim);

  drawPixelBlock(ctx, -16, -31, 7, 10, palette.metal);
  drawPixelBlock(ctx, 9, -31, 7, 10, palette.metal);
  drawPixelBlock(ctx, -18, -22, 7, 13, palette.shade);
  drawPixelBlock(ctx, 11 + armSwing, attacking ? -24 : -22, 7, attacking ? 10 : 13, palette.shade);

  drawPremiumBattleHead(ctx, unit, palette, -1, -43);
  drawPremiumWeaponByType(ctx, unit, palette, attack);
  drawPremiumLevelAccent(ctx, unit, palette);
}

function drawPremiumMageSprite(ctx, unit, palette, time, attack) {
  const pulse = Math.sin(time * 4 + (unit.animSeed || 0)) * 0.5 + 0.5;
  const attacking = attack > 0.04;
  const castReach = Math.round(attack * 9);
  drawPixelBlock(ctx, -11, -33, 22, 31, darkenColor(palette.base, 0.18));
  drawPixelBlock(ctx, -8, -38, 16, 16, palette.base);
  drawPixelBlock(ctx, -6, -31, 12, 27, palette.light);
  drawPixelBlock(ctx, -12, -14, 24, 8, palette.dark);
  drawPixelBlock(ctx, -9, -43, 18, 8, palette.dark);
  drawPixelBlock(ctx, -7, -47, 14, 8, palette.base);
  drawPixelBlock(ctx, -4, -42, 8, 7, palette.skin);
  drawPixelBlock(ctx, 1, -39, 2, 2, "#090604");
  drawPixelBlock(ctx, -15, -27, 7, 16, palette.shade);
  drawPixelBlock(ctx, 8 + castReach, attacking ? -30 : -27, 7, attacking ? 12 : 16, palette.shade);
  if (attacking) {
    drawWeaponLine(ctx, 16, -40, 30 + castReach, -25, "#5a3a5a", 3);
    drawPixelBlock(ctx, 30 + castReach, -31, 10, 10, `rgba(199,155,255,${0.76 + pulse * 0.2})`);
    drawPixelBlock(ctx, 33 + castReach, -28, 5, 5, `rgba(255,235,255,${0.48 + pulse * 0.3})`);
    drawPixelBlock(ctx, 23 + castReach, -24, 20, 2, `rgba(199,155,255,${0.4 + pulse * 0.26})`);
  } else {
    drawPixelBlock(ctx, 15, -43, 3, 43, "#5a3a5a");
    drawPixelBlock(ctx, 12, -49, 9, 9, `rgba(199,155,255,${0.64 + pulse * 0.16})`);
    drawPixelBlock(ctx, 14, -47, 5, 5, `rgba(255,235,255,${0.3 + pulse * 0.22})`);
    drawPixelBlock(ctx, 10, -42, 13, 2, `rgba(199,155,255,${0.28 + pulse * 0.14})`);
  }
  drawPremiumLevelAccent(ctx, unit, palette);
}

function drawPremiumCavalrySprite(ctx, unit, palette, time, attack) {
  const gallop = Math.round(Math.sin(time * 11 + (unit.animSeed || 0)) * 3);
  const mane = Math.round(Math.sin(time * 7 + (unit.animSeed || 0)) * 1.5);

  drawPixelBlock(ctx, -24, -17, 43, 18, palette.horseDark);
  drawPixelBlock(ctx, -26, -20, 42, 16, palette.horse);
  drawPixelBlock(ctx, 11, -27, 17, 15, palette.horse);
  drawPixelBlock(ctx, 22, -23, 8, 7, palette.horse);
  drawPixelBlock(ctx, 14, -29, 5, 15, palette.horseDark);
  drawPixelBlock(ctx, -22, -22 + mane, 11, 5, palette.horseDark);
  drawPixelBlock(ctx, 24, -23, 2, 2, "#080503");

  drawPixelBlock(ctx, -21, -5, 5, 13 + gallop, palette.horseDark);
  drawPixelBlock(ctx, -9, -5, 5, 13 - gallop, palette.horseDark);
  drawPixelBlock(ctx, 6, -5, 5, 13 - gallop, palette.horseDark);
  drawPixelBlock(ctx, 18, -9, 5, 16 + gallop, palette.horseDark);
  drawPixelBlock(ctx, -23, 7 + gallop, 8, 3, "#17100a");
  drawPixelBlock(ctx, -11, 7 - gallop, 8, 3, "#17100a");
  drawPixelBlock(ctx, 4, 7 - gallop, 8, 3, "#17100a");
  drawPixelBlock(ctx, 16, 7 + gallop, 8, 3, "#17100a");

  drawPixelBlock(ctx, -12, -27, 24, 8, palette.leather);
  drawPixelBlock(ctx, -5, -43, 16, 21, palette.base);
  drawPixelBlock(ctx, -8, -41, 22, 13, palette.metal);
  drawPixelBlock(ctx, -2, -52, 12, 12, palette.skin);
  drawPixelBlock(ctx, -5, -58, 18, 9, palette.metal);
  drawPixelBlock(ctx, 0, -63, 7, 6, palette.trim);
  drawPixelBlock(ctx, 6, -38, 7, 13, palette.shade);

  if (attack > 0.04) {
    drawWeaponLine(ctx, 13, -43, 55 + Math.round(attack * 11), -41 + Math.round(attack * 3), "#8a7050", 3);
    drawPixelBlock(ctx, 53 + Math.round(attack * 11), -46 + Math.round(attack * 3), 8, 9, "#e8d0b0");
    drawAttackMotionTrail(ctx, 34, -45, 32, 14, palette.glow, attack);
  } else {
    drawPixelBlock(ctx, 14, -59, 4, 44, "#8a7050");
    drawPixelBlock(ctx, 11, -63, 10, 8, "#e8d0b0");
    drawPixelBlock(ctx, 17, -53, 13, 7, palette.trim);
  }
  drawPixelBlock(ctx, -14, -35, 7, 18, palette.cloth);
  drawPremiumLevelAccent(ctx, unit, palette);
}

function drawPremiumGeneralSprite(ctx, unit, palette, time, attack) {
  const weapon = unit.weapon || {};
  const step = Math.round(Math.sin(time * 7 + (unit.animSeed || 0)) * 1.4);
  const capeWave = Math.round(Math.sin(time * 5 + (unit.animSeed || 0)) * 2);

  drawPixelBlock(ctx, -18, -42, 36 + capeWave, 35, palette.cloth);
  drawPixelBlock(ctx, -14, -18, 28, 13, "rgba(0,0,0,0.18)");
  drawPixelBlock(ctx, -10, -13, 6, 17 + step, palette.leatherDark);
  drawPixelBlock(ctx, 4, -13, 6, 17 - step, palette.leatherDark);
  drawPixelBlock(ctx, -12, 3 + step, 10, 4, "#160f08");
  drawPixelBlock(ctx, 2, 3 - step, 10, 4, "#160f08");

  drawPixelBlock(ctx, -15, -38, 30, 29, palette.metalDark);
  drawPixelBlock(ctx, -11, -40, 22, 28, palette.base);
  drawPixelBlock(ctx, -9, -37, 18, 10, palette.metal);
  drawPixelBlock(ctx, -16, -26, 32, 4, palette.trim);
  drawPixelBlock(ctx, -5, -29, 10, 10, palette.trimDark);
  drawPixelBlock(ctx, -19, -37, 9, 13, palette.metal);
  drawPixelBlock(ctx, 10, -37, 9, 13, palette.metal);

  drawPremiumBattleHead(ctx, unit, palette, 0, -53, true);
  drawPremiumGeneralWeapon(ctx, weapon, palette, attack);
  drawPixelBlock(ctx, -20, -51, 40, 3, "rgba(255,213,106,0.18)");
  drawPixelBlock(ctx, -23, -48, 46, 2, "rgba(255,213,106,0.1)");
}

function drawPremiumBattleHead(ctx, unit, palette, cx, cy, ornate = false) {
  drawPixelBlock(ctx, cx - 6, cy, 12, 12, palette.skin);
  drawPixelBlock(ctx, cx - 7, cy - 7, 14, 8, palette.metal);
  drawPixelBlock(ctx, cx - 5, cy - 11, 10, 5, palette.metalDark);
  drawPixelBlock(ctx, cx + 1, cy + 4, 2, 2, "#0a0603");
  drawPixelBlock(ctx, cx - 7, cy + 1, 3, 9, "rgba(0,0,0,0.18)");
  drawPixelBlock(ctx, cx + 6, cy + 1, 2, 7, "rgba(0,0,0,0.15)");
  drawPixelBlock(ctx, cx - 2, cy - 14, 4, 5, palette.trim);
  if (ornate) {
    drawPixelBlock(ctx, cx - 8, cy - 10, 16, 3, palette.trim);
    drawPixelBlock(ctx, cx - 5, cy - 16, 3, 6, palette.trim);
    drawPixelBlock(ctx, cx + 2, cy - 16, 3, 6, palette.trim);
  }
}

function drawPremiumWeaponByType(ctx, unit, palette, attack) {
  const attacking = attack > 0.04;
  if (unit.type === "infantry") {
    drawPixelBlock(ctx, -21, -29, 10, 21, palette.metalDark);
    drawPixelBlock(ctx, -19, -27, 7, 17, palette.base);
    drawPixelBlock(ctx, -18, -24, 5, 3, palette.trim);
    if (attacking) {
      drawWeaponLine(ctx, 12, -30, 35 + Math.round(attack * 9), -42 + Math.round(attack * 10), "#d8d2c6", 4);
      drawPixelBlock(ctx, 34 + Math.round(attack * 9), -47 + Math.round(attack * 10), 6, 11, "#f3ead8");
      drawAttackMotionTrail(ctx, 18, -44, 28, 20, palette.glow, attack);
    } else {
      drawPixelBlock(ctx, 15, -26, 4, 30, "#d8d2c6");
      drawPixelBlock(ctx, 12, -29, 10, 5, "#f3ead8");
      drawPixelBlock(ctx, 13, -11, 8, 4, palette.trim);
    }
  } else if (unit.type === "pikeman") {
    if (attacking) {
      drawWeaponLine(ctx, 8, -29, 56 + Math.round(attack * 10), -38 - Math.round(attack * 3), "#8a7050", 3);
      drawPixelBlock(ctx, 54 + Math.round(attack * 10), -43 - Math.round(attack * 3), 9, 10, "#e8d8c0");
      drawAttackMotionTrail(ctx, 34, -42, 34, 11, "#e8d8c0", attack);
    } else {
      drawWeaponLine(ctx, 16, -50, 20, -5, "#8a7050", 3);
      drawPixelBlock(ctx, 13, -55, 8, 10, "#e8d8c0");
    }
    drawPixelBlock(ctx, -18, -25, 9, 12, palette.metalDark);
  } else if (unit.type === "archer") {
    drawPixelBlock(ctx, -16, -35, 5, 20, "#5b3c21");
    drawPixelBlock(ctx, -14, -37, 10, 3, "#d8d2c6");
    if (attacking) {
      const pull = Math.round(attack * 9);
      drawBowShape(ctx, 16, -39, 16, -13, 28 + attack * 4, -27, "#b58a52", 2);
      drawWeaponLine(ctx, 17, -38, 20 - pull, -26, "#f3ead8", 1);
      drawWeaponLine(ctx, 20 - pull, -26, 17, -14, "#f3ead8", 1);
      drawWeaponLine(ctx, 8 - pull, -27, 36, -27, "#d8d2c6", 2);
      drawArrowHead(ctx, 38, -27, "#f3ead8");
    } else {
      drawBowShape(ctx, 16, -39, 16, -13, 27, -27, "#b58a52", 2);
      drawWeaponLine(ctx, 17, -38, 17, -14, "#e6d6b8", 1);
    }
  }
}

function drawPremiumGeneralWeapon(ctx, weapon, palette, attack) {
  const weaponColor = weapon.color || "#f3ead8";
  const attacking = attack > 0.04;
  if ((weapon.range || 0) > 80) {
    if (attacking) {
      const pull = Math.round(attack * 10);
      drawBowShape(ctx, 17, -50, 17, -15, 32 + attack * 4, -33, "#b58a52", 3);
      drawWeaponLine(ctx, 18, -49, 22 - pull, -32, weaponColor, 1);
      drawWeaponLine(ctx, 22 - pull, -32, 18, -16, weaponColor, 1);
      drawWeaponLine(ctx, 9 - pull, -33, 43, -33, weaponColor, 2);
    } else {
      drawBowShape(ctx, -20, -49, -20, -17, -28, -33, "#b58a52", 3);
      drawWeaponLine(ctx, -20, -48, -20, -18, weaponColor, 1);
    }
  } else if ((weapon.attack || 0) >= 18) {
    if (attacking) {
      drawWeaponLine(ctx, 14, -46, 39 + Math.round(attack * 8), -22 + Math.round(attack * 8), "#7a6040", 5);
      drawPixelBlock(ctx, 35 + Math.round(attack * 8), -30 + Math.round(attack * 8), 14, 13, weaponColor);
      drawPixelBlock(ctx, 38 + Math.round(attack * 8), -27 + Math.round(attack * 8), 7, 16, lightenColor(weaponColor, 0.25));
      drawAttackMotionTrail(ctx, 20, -41, 36, 26, palette.glow, attack);
    } else {
      drawPixelBlock(ctx, 16, -55, 5, 48, "#7a6040");
      drawPixelBlock(ctx, 12, -63, 13, 14, weaponColor);
      drawPixelBlock(ctx, 15, -51, 7, 17, lightenColor(weaponColor, 0.25));
    }
  } else {
    if (attacking) {
      drawWeaponLine(ctx, 14, -31, 49 + Math.round(attack * 8), -41 + Math.round(attack * 6), "#8a7050", 4);
      drawPixelBlock(ctx, 46 + Math.round(attack * 8), -47 + Math.round(attack * 6), 8, 12, weaponColor);
      drawAttackMotionTrail(ctx, 20, -46, 34, 18, palette.glow, attack);
    } else {
      drawPixelBlock(ctx, 15, -34, 4, 39, "#8a7050");
      drawPixelBlock(ctx, 12, -39, 10, 10, weaponColor);
      drawPixelBlock(ctx, 18, -28, 4, 12, palette.trim);
    }
  }
}

function drawWeaponLine(ctx, x1, y1, x2, y2, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawBowShape(ctx, topX, topY, bottomX, bottomY, curveX, curveY, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.quadraticCurveTo(curveX, curveY, bottomX, bottomY);
  ctx.stroke();
  ctx.restore();
}

function drawArrowHead(ctx, x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(Math.round(x + 5), Math.round(y));
  ctx.lineTo(Math.round(x - 3), Math.round(y - 5));
  ctx.lineTo(Math.round(x - 2), Math.round(y + 5));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAttackMotionTrail(ctx, x, y, w, h, color, attack) {
  const alpha = clamp(attack, 0, 1) * 0.32;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 2);
  ctx.fillRect(Math.round(x + w * 0.25), Math.round(y + h * 0.45), Math.round(w * 0.72), 2);
  ctx.fillRect(Math.round(x + w * 0.5), Math.round(y + h * 0.86), Math.round(w * 0.4), 2);
  ctx.restore();
}

function drawPremiumBackBanner(ctx, unit, palette, x, y, h) {
  if (Math.floor(unit.stackLevel || 1) < 4) {
    return;
  }
  drawPixelBlock(ctx, x, y, 2, h, palette.leather);
  drawPixelBlock(ctx, x + 2, y + 1, 12, 8, palette.trim);
  drawPixelBlock(ctx, x + 4, y + 3, 7, 2, "rgba(255,255,255,0.26)");
}

function drawPremiumLevelAccent(ctx, unit, palette) {
  const level = Math.floor(unit.stackLevel || 1);
  if (level < 3) {
    return;
  }
  drawPixelBlock(ctx, -9, -35, 18, 2, level >= 5 ? palette.trim : palette.metal);
  if (level >= 5) {
    drawPixelBlock(ctx, -2, -39, 4, 4, palette.trim);
  }
}

function drawPremiumSkillAura(ctx, unit, palette, ratio, time) {
  const radius = unit.type === "cavalry" ? 34 : unit.general ? 30 : 24;
  ctx.save();
  ctx.globalAlpha *= ratio * 0.65;
  ctx.strokeStyle = palette.glow;
  ctx.lineWidth = 2;
  ctx.strokeRect(-radius, -Math.round(radius * 0.72), radius * 2, Math.round(radius * 1.15));
  for (let i = 0; i < 6; i += 1) {
    const a = time * 5 + i * Math.PI / 3;
    drawPixelBlock(ctx, Math.cos(a) * radius - 1, Math.sin(a) * radius * 0.45 - 22, 3, 3, palette.glow);
  }
  ctx.restore();
}

function drawPremiumHitFlash(ctx, unit) {
  const alpha = clamp((unit.hitFlash || 0) / 0.18, 0, 1) * 0.58;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = "#ffffff";
  if (unit.type === "cavalry") {
    ctx.fillRect(-26, -27, 55, 35);
  } else if (unit.general) {
    ctx.fillRect(-18, -60, 36, 66);
  } else {
    ctx.fillRect(-18, -51, 36, 55);
  }
  ctx.restore();
}

function drawPremiumDeadUnit(ctx, x, y, unit) {
  const palette = getPremiumBattlePalette(unit);
  const dir = unit.dir || 1;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + 4));
  ctx.scale(dir, 1);

  if (unit.type === "cavalry") {
    drawPixelBlock(ctx, -27, -10, 49, 12, palette.horseDark);
    drawPixelBlock(ctx, -21, -16, 37, 10, palette.horse);
    drawPixelBlock(ctx, 12, -19, 14, 10, palette.horse);
    drawPixelBlock(ctx, -2, -29, 17, 12, palette.base);
    drawPixelBlock(ctx, 8, -23, 32, 3, "#8a7050");
  } else {
    drawPixelBlock(ctx, -17, -7, 34, 10, palette.dark);
    drawPixelBlock(ctx, -14, -11, 25, 12, palette.base);
    drawPixelBlock(ctx, 8, -15, 11, 8, palette.skin);
    drawPixelBlock(ctx, -21, -14, 10, 6, palette.metalDark);
    drawPixelBlock(ctx, -5, -1, 31, 3, palette.leather);
  }

  drawPixelBlock(ctx, 11, -13, 2, 5, "#0a0603");
  drawPixelBlock(ctx, 9, -11, 6, 1, "#0a0603");
  ctx.restore();
}

function drawPixelBlock(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function darkenColor(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * (1 - amount));
  const dg = Math.round(g * (1 - amount));
  const db = Math.round(b * (1 - amount));
  return "#" + [dr, dg, db].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function lightenColor(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return "#" + [lr, lg, lb].map((c) => c.toString(16).padStart(2, "0")).join("");
}

// ==================== 战斗特效 ====================

function drawBattleEffects(ctx, battle) {
  const offsetX = 30;
  const offsetY = 92;

  for (const effect of battle.effects) {
    const ratio = clamp(effect.life / effect.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.max(0, ratio);

    const ex = offsetX + (effect.x || effect.toX || 0);
    const ey = offsetY + (effect.y || effect.toY || 0);

    if (effect.type === "projectile") {
      const fx = offsetX + effect.fromX;
      const fy = offsetY + effect.fromY;
      const tx = offsetX + effect.toX;
      const ty = offsetY + effect.toY;
      const px = fx + (tx - fx) * (1 - ratio);
      const py = fy + (ty - fy) * (1 - ratio) - Math.sin(ratio * Math.PI) * 10;

      ctx.fillStyle = effect.color;
      ctx.fillRect(px - 2, py - 1, 5, 2);
      // 拖尾
      ctx.fillStyle = "rgba(255,255,200,0.5)";
      ctx.fillRect(px + 3, py - 1, 3, 2);
    } else if (effect.type === "slash") {
      ctx.fillStyle = effect.color;
      ctx.fillRect(ex - 12, ey - 8, 24, 3);
      ctx.fillRect(ex - 4, ey - 14, 4, 15);
    } else if (effect.type === "burst") {
      const r = 28 * (1 - ratio);
      ctx.fillStyle = effect.color;
      ctx.fillRect(ex - r, ey - r * 0.6, r * 2, r * 1.2);
      ctx.fillStyle = "rgba(255,200,100,0.6)";
      ctx.fillRect(ex - r * 0.4, ey - r * 0.2, r * 0.8, r * 0.4);
      // 火花粒子
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + Date.now() / 800;
        const dist = r * 1.4;
        ctx.fillStyle = "#ffd56a";
        ctx.fillRect(ex + Math.cos(angle) * dist - 1, ey + Math.sin(angle) * dist * 0.6 - 1, 2, 2);
      }
    } else if (effect.type === "shock") {
      const r = 22 * (1 - ratio);
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(ex - r, ey - r * 0.5, r * 2, r);
      // 震波线
      ctx.fillStyle = effect.color;
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2;
        ctx.fillRect(ex + Math.cos(a) * r, ey + Math.sin(a) * r * 0.5, 3, 1);
      }
    } else if (effect.type === "banner") {
      const wave = Math.sin(Date.now() / 300) * 2;
      ctx.fillStyle = "#ffd56a";
      ctx.fillRect(ex - 2, ey - 24, 4, 30);
      ctx.fillStyle = "#c94f3f";
      ctx.fillRect(ex + 2 + wave, ey - 24, 18, 10);
      ctx.fillStyle = "#ffd56a";
      ctx.fillRect(ex + 4 + wave, ey - 22, 14, 6);
    } else if (effect.type === "death") {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(ex - 14, ey - 4, 28, 12);
      // 灵魂升天
      ctx.fillStyle = `rgba(255,255,255,${ratio * 0.6})`;
      ctx.fillRect(ex - 2, ey - 6 - (1 - ratio) * 14, 4, 4);
    }

    ctx.restore();
  }
}

// ==================== 战斗 UI ====================

function drawBattleUi(ctx, game, battle) {
  const leftAlive = battle.units.filter((unit) => unit.side === "left" && !unit.dead).length;
  const rightAlive = battle.units.filter((unit) => unit.side === "right" && !unit.dead).length;

  // 兵力计数
  drawPixelText(ctx, "我军 " + leftAlive, 54, 54, "#ffd56a", 16);
  drawPixelText(ctx, battle.enemyName + " " + rightAlive, 906, 54, "#ff8a74", 16, "right");

  // 战斗进度条
  const total = leftAlive + rightAlive;
  if (total > 0) {
    const ratio = leftAlive / total;
    drawBar(ctx, 384, 54, 192, 6, ratio, "#ffd56a", "#c94f3f", "#2a1a0a");
  }

  if (!battle.ended) {
    const pauseButton = addButton(game.ui, 462, 34, 36, 28, battle.paused ? ">" : "||", "toggleBattlePause");
    const attackLabel = battle.playerAttackOrdered ? "进攻中" : "发起进攻";
    const attackButton = addButton(game.ui, 384, 474, 140, 30, attackLabel, "orderBattleAttack", battle.playerAttackOrdered);
    const fleeButton = addButton(game.ui, 54, 474, 92, 30, "逃跑", "fleeBattle");
    drawButton(ctx, pauseButton, game.input);
    drawButton(ctx, attackButton, game.input);
    drawButton(ctx, fleeButton, game.input);
    if (battle.paused) {
      drawPixelText(ctx, "暂停", 480, 84, "#ffd56a", 13, "center");
    }
  }

  if (battle.ended) {
    drawBattleSummary(ctx, game, battle);
  }
}

function drawBattleSummary(ctx, game, battle) {
  const summary = battle.summary;
  const isWin = battle.result === "win";
  const fled = battle.result === "flee";
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillRect(20, 20, 920, 500);

  drawPanel(ctx, 310, 130, 340, 250, isWin ? "战斗胜利" : fled ? "撤退成功" : "战斗失败", isWin ? "victory" : "battle");
  drawPixelText(ctx, isWin ? "胜利！" : fled ? "撤退" : "战败", 480, 158, isWin ? "#ffd56a" : fled ? "#f8e9bd" : "#ff8a74", 28, "center");

  const lines = summary && summary.lines && summary.lines.length
    ? summary.lines
    : ["战斗结束"];
  lines.slice(0, 6).forEach((line, index) => {
    drawPixelText(ctx, line, 344, 206 + index * 24, index < 2 && isWin ? "#ffd56a" : "#f8e9bd", 15);
  });

  const button = addButton(game.ui, 400, 334, 160, 34, "返回大地图", "finishBattle");
  drawButton(ctx, button, game.input);
}

function drawCenterNotice(ctx, game) {
  if (!game.notice) return;

  const notice = game.notice;
  const progress = clamp(notice.timer / notice.duration, 0, 1);
  const alpha = Math.min(1, progress * 3);
  const lines = notice.lines || [];
  const y = Math.round(CONFIG.canvasHeight / 2 - 22);

  ctx.save();
  ctx.globalAlpha = alpha;
  drawPixelText(ctx, notice.title || "提示", CONFIG.canvasWidth / 2, y, "#ffd56a", 17, "center");
  lines.forEach((line, index) => {
    drawPixelText(ctx, line, CONFIG.canvasWidth / 2, y + 22 + index * 18, "#f8e9bd", 12, "center");
  });

  ctx.restore();
}

function drawEncounterDialog(ctx, game) {
  if (!game.encounter || !game.encounter.enemy) return;

  const enemy = game.encounter.enemy;
  game.ui.buttons.length = 0;

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  const panelX = 314;
  const panelY = 174;
  const panelW = 332;
  drawPanel(ctx, panelX, panelY, panelW, 188, "遭遇敌军", "battle");

  drawPixelText(ctx, enemy.name || "敌军", 480, 204, "#ff8a74", 22, "center");
  drawPixelText(ctx, "敌军挡住了去路，是否开战？", 480, 242, "#f8e9bd", 14, "center");
  drawPixelText(ctx, "逃跑会后撤一段距离，不会损失金币。", 480, 268, "#b9a77a", 12, "center");

  const enemyArmy = enemy.army || enemy.garrison || [];
  const previewButton = addButton(game.ui, panelX + panelW - 42, panelY + 12, 26, 24, "兵", "openEncounterArmyPreview", !enemyArmy.length);
  const fightButton = addButton(game.ui, 360, 310, 104, 34, "战斗", "acceptEncounter");
  const fleeButton = addButton(game.ui, 496, 310, 104, 34, "逃跑", "fleeEncounter");
  drawButton(ctx, previewButton, game.input);
  drawButton(ctx, fightButton, game.input);
  drawButton(ctx, fleeButton, game.input);
}

// ==================== 统一胜利横幅 ====================

function drawVictoryBanner(ctx) {
  // 背景遮罩
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  drawPanel(ctx, 248, 150, 464, 184, "大陆统一", "victory");

  // 王冠
  const cx = 480;
  const cy = 200;
  ctx.fillStyle = "#ffd56a";
  ctx.fillRect(cx - 16, cy - 10, 32, 8);
  ctx.fillRect(cx - 24, cy - 4, 48, 6);
  // 王冠尖刺
  for (let i = -20; i <= 20; i += 8) {
    ctx.fillRect(cx + i, cy - 20, 4, 12);
  }
  // 宝石
  ctx.fillStyle = "#c94f3f";
  ctx.fillRect(cx - 4, cy - 8, 8, 6);

  drawPixelText(ctx, "铁冠盟约已统一大陆", 480, 224, "#ffd56a", 22, "center");
  drawPixelText(ctx, "所有城池尽归王土，天下已定", 480, 258, "#f8e9bd", 14, "center");
  drawPixelText(ctx, "你可以继续巡游并清剿残部", 480, 284, "#b9a77a", 12, "center");

  // 动画粒子
  const t = Date.now() / 500;
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2 + t * 0.5;
    const radius = 52 + Math.sin(t + i) * 12;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius * 0.5;
    ctx.fillStyle = i % 2 === 0 ? "#ffd56a" : "#d6a84f";
    ctx.fillRect(px - 1, py - 1, 3, 3);
  }
}
