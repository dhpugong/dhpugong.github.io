import { CONFIG, FACTIONS, TERRAIN, TROOP_TYPES } from "./config.js";
import { getBattleTitle } from "./battle.js";
import { getTerrainById } from "./map.js";
import { hasSave } from "./save.js";
import { addButton, drawButton, drawHud, drawMenuUi, drawSettingsUi, drawTownUi } from "./ui.js";
import { drawBar, drawPanel, drawPixelText, clamp } from "./utils.js";

// 渲染模块：使用像素精灵绘制地图、单位和战斗场景，保持 Canvas 结构清晰。
// 所有精灵均为程序化像素绘制，无外部资源依赖。

const titleBackgroundImage = new Image();
titleBackgroundImage.src = "./assets/title-background.svg";
const miniMapTerrainCache = {
  key: "",
  canvas: null
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export function renderGame(renderer, game) {
  const ctx = renderer.ctx;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  if (game.state === "start") {
    renderStartScreen(ctx, game);
    drawCenterNotice(ctx, game);
    return;
  }

  if (game.state === "battle") {
    renderBattle(ctx, game);
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
  if (game.state === "settings") {
    drawSettingsUi(ctx, game);
  }
  if (game.state === "encounter") {
    drawEncounterDialog(ctx, game);
  }
  if (game.player.unified) {
    drawVictoryBanner(ctx);
  }
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
  drawPixelText(ctx, "像素策略 RPG", CONFIG.canvasWidth / 2, 178, "#f8e9bd", 17, "center");
  drawPixelText(ctx, "探索大陆 · 招募扩军 · 攻城收税 · 统一全境", CONFIG.canvasWidth / 2, 212, "#b9a77a", 14, "center");

  drawPanel(ctx, 330, 264, 300, 166, "");
  const newGameButton = addButton(game.ui, 380, 300, 200, 38, "开始新游戏", "newGame");
  const continueButton = addButton(game.ui, 380, 354, 200, 38, "继续游戏", "continueGame", !hasSave());
  drawButton(ctx, newGameButton, game.input);
  drawButton(ctx, continueButton, game.input);

  const saveText = hasSave() ? "检测到本地存档" : "暂无本地存档";
  drawPixelText(ctx, saveText, CONFIG.canvasWidth / 2, 406, hasSave() ? "#d7c89e" : "#8f8060", 12, "center");
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
  drawMapLayer(ctx, game);
  drawUnitLayer(ctx, game);
  drawMiniMap(ctx, game);
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
    const color = FACTIONS[town.owner] ? FACTIONS[town.owner].color : "#888";
    const hasStationedArmy = game.npcs.some((npc) => npc.stationed && npc.homeTownId === town.id && npc.alive !== false);
    if (hasStationedArmy) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(mx - 5, my - 5, 11, 11);
    }
    ctx.fillStyle = "#070604";
    ctx.fillRect(mx - 4, my - 4, 9, 9);
    ctx.fillStyle = color;
    ctx.fillRect(mx - 3, my - 3, 7, 7);
    ctx.fillStyle = "#f8e9bd";
    ctx.fillRect(mx - 1, my - 1, 3, 3);
  }

  for (const resource of game.map.resources || []) {
    const mx = Math.round(ox + resource.x * scaleX);
    const my = Math.round(oy + resource.y * scaleY);
    ctx.fillStyle = "#070604";
    ctx.fillRect(mx - 3, my - 3, 7, 7);
    ctx.fillStyle = resource.owner === "player" ? "#ffd56a" : resource.kind === "mine" ? "#c8c1b0" : "#74d17a";
    if (resource.kind === "mine") {
      ctx.fillRect(mx - 2, my - 2, 5, 5);
    } else {
      ctx.fillRect(mx - 2, my - 1, 5, 3);
      ctx.fillRect(mx - 1, my - 2, 3, 5);
    }
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
  ctx.fillStyle = `rgba(255,213,106,${pulse})`;
  ctx.fillRect(
    Math.round(ox + game.player.x * scaleX) - 3,
    Math.round(oy + game.player.y * scaleY) - 3,
    6, 6
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
  drawPanel(ctx, 20, 20, 920, 500, getBattleTitle(battle));
  drawBattleField(ctx);
  drawBattleUnits(ctx, battle);
  drawBattleEffects(ctx, battle);
  drawBattleUi(ctx, game, battle);
}

function clearBattleBackground(ctx) {
  // 天空
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 400);
  skyGrad.addColorStop(0, "#1a0e0e");
  skyGrad.addColorStop(0.6, "#0c0806");
  skyGrad.addColorStop(1, "#050302");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  // 远处山影
  ctx.fillStyle = "rgba(30,20,15,0.4)";
  for (let i = 0; i < 18; i += 1) {
    const mx = i * 58;
    const mh = 20 + Math.sin(i * 1.7) * 18;
    ctx.fillRect(mx, 64, 42, mh);
  }
}

function drawBattleField(ctx) {
  const x = 30;
  const y = 92;
  const w = 900;
  const h = 300;

  // 草地
  ctx.fillStyle = "#2f3f25";
  ctx.fillRect(x, y, w, h);

  // 草地纹理
  ctx.fillStyle = "#3a5028";
  for (let i = 0; i < 36; i += 1) {
    ctx.fillRect(x + i * 26 + (i % 3) * 4, y + h - 48 + (i % 2) * 8, 14, 2);
  }
  ctx.fillStyle = "#284420";
  for (let i = 0; i < 28; i += 1) {
    ctx.fillRect(x + i * 34 + 7, y + 20 + (i % 3) * 12, 10, 2);
  }

  // 泥土 / 道路
  ctx.fillStyle = "#6a4c25";
  ctx.fillRect(x, y + h - 28, w, 28);
  ctx.fillStyle = "#7a5a30";
  ctx.fillRect(x, y + h - 26, w, 4);

  // 石子和车辙
  ctx.fillStyle = "rgba(140,110,70,0.5)";
  for (let i = 0; i < 22; i += 1) {
    ctx.fillRect(x + i * 44 + 6, y + h - 24 + (i % 2) * 5, 3, 2);
  }

  // 框线
  ctx.strokeStyle = "#8f682e";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

// ==================== 战斗单位精灵绘制 ====================

function drawBattleUnits(ctx, battle) {
  const offsetX = 30;
  const offsetY = 92;
  const sorted = [...battle.units].sort((a, b) => a.y - b.y);

  for (const unit of sorted) {
    const alpha = unit.dead ? Math.max(0, 1 - unit.deathTimer * 2.5) : 1;
    if (alpha <= 0) continue;

    const x = offsetX + unit.x;
    const y = offsetY + unit.y;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 阴影
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x - 10, y + 13, 20, 5);

    // 根据单位类型绘制不同精灵
    if (unit.dead) {
      drawDeadUnit(ctx, x, y, unit);
    } else {
      drawBattleSprite(ctx, x, y, unit);
    }

    // 血条
    if (!unit.dead) {
      drawBar(ctx, x - 14, y - 30, 28, 4, unit.hp / unit.maxHp, "#5fc46a", "#3a1510", "#1a0c05");
    }

    ctx.restore();
  }
}

function drawBattleSprite(ctx, x, y, unit) {
  const dir = unit.dir; // 1=面向右, -1=面向左
  const color = unit.color;
  const bodyColor = unit.side === "left" ? color : darkenColor(color, 0.15);

  if (unit.general) {
    drawGeneralSprite(ctx, x, y, unit, dir, color);
    return;
  }

  // 腿
  const legAnim = Math.sin(Date.now() / 200 + unit.x * 0.1) * 1.5;
  ctx.fillStyle = "#3d3025";
  ctx.fillRect(x - 5, y + 4, 4, 9);
  ctx.fillRect(x + 2, y + 4, 4, 9);
  // 靴子
  ctx.fillStyle = "#2a1f15";
  ctx.fillRect(x - 6, y + 13, 5, 3);
  ctx.fillRect(x + 1, y + 13, 5, 3);

  // 身体
  ctx.fillStyle = bodyColor;
  ctx.fillRect(x - 8, y - 8, 16, 15);
  // 身体纹理
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x - 5, y - 6, 4, 8);

  // 腰带
  ctx.fillStyle = "#5a3d1e";
  ctx.fillRect(x - 9, y + 2, 18, 3);

  // 头
  ctx.fillStyle = "#e8d5b7";
  ctx.fillRect(x - 5, y - 18, 10, 11);

  // 头盔
  ctx.fillStyle = unit.side === "left" ? "#b0a090" : darkenColor(color, 0.2);
  ctx.fillRect(x - 7, y - 22, 14, 7);
  ctx.fillRect(x - 6, y - 26, 12, 5);
  // 盔顶装饰
  ctx.fillStyle = unit.side === "left" ? "#ffd56a" : "#c94f3f";
  ctx.fillRect(x - 2, y - 29, 4, 4);

  // 眼睛
  ctx.fillStyle = "#0a0603";
  if (dir > 0) {
    ctx.fillRect(x + 1, y - 16, 2, 2);
  } else {
    ctx.fillRect(x - 4, y - 16, 2, 2);
  }

  // 武器和兵种特有绘制
  drawWeaponByType(ctx, x, y, unit, dir, color);
}

function drawGeneralSprite(ctx, x, y, unit, dir, color) {
  const weapon = unit.weapon || {};
  ctx.fillStyle = "rgba(255,213,106,0.16)";
  ctx.fillRect(x - 13, y - 32, 26, 3);

  ctx.fillStyle = "#2a1a0a";
  ctx.fillRect(x - 7, y + 5, 5, 11);
  ctx.fillRect(x + 2, y + 5, 5, 11);
  ctx.fillStyle = "#17100a";
  ctx.fillRect(x - 8, y + 15, 8, 3);
  ctx.fillRect(x + 1, y + 15, 8, 3);

  ctx.fillStyle = darkenColor(color, 0.28);
  ctx.fillRect(x - 12, y - 12, 24, 22);
  ctx.fillStyle = color;
  ctx.fillRect(x - 9, y - 13, 18, 20);
  ctx.fillStyle = "#ffd56a";
  ctx.fillRect(x - 10, y - 2, 20, 3);
  ctx.fillRect(x - 4, y - 18, 8, 5);

  ctx.fillStyle = "#e8d5b7";
  ctx.fillRect(x - 6, y - 24, 12, 11);
  ctx.fillStyle = "#d6a84f";
  ctx.fillRect(x - 8, y - 30, 16, 7);
  ctx.fillRect(x - 5, y - 35, 10, 5);
  ctx.fillStyle = "#0a0603";
  ctx.fillRect(x - 3, y - 21, 2, 2);
  ctx.fillRect(x + 3, y - 21, 2, 2);

  const weaponColor = weapon.color || "#f3ead8";
  ctx.fillStyle = "#8a7050";
  if ((weapon.range || 0) > 80) {
    ctx.fillRect(x + dir * 9, y - 20, dir * 3, 30);
    ctx.strokeStyle = weaponColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + dir * 10, y - 20);
    ctx.lineTo(x + dir * 16, y - 6);
    ctx.lineTo(x + dir * 10, y + 10);
    ctx.stroke();
  } else if ((weapon.attack || 0) >= 18) {
    ctx.fillRect(x + dir * 10, y - 22, dir * 4, 34);
    ctx.fillStyle = weaponColor;
    ctx.fillRect(x + dir * 12, y - 28, dir * 10, 8);
    ctx.fillRect(x + dir * 14, y - 22, dir * 4, 12);
  } else {
    ctx.fillRect(x + dir * 8, y - 14, dir * 20, 3);
    ctx.fillStyle = weaponColor;
    ctx.fillRect(x + dir * 25, y - 17, dir * 5, 9);
  }

  drawPixelText(ctx, unit.name, x, y + 26, "#ffd56a", 10, "center");
}

function drawWeaponByType(ctx, x, y, unit, dir, color) {
  const weaponX = dir > 0 ? x + 9 : x - 13;

  if (unit.type === "infantry") {
    // 剑 + 盾
    // 剑
    ctx.fillStyle = "#d0d0d0";
    ctx.fillRect(weaponX, y - 6, dir * 4, 2);
    ctx.fillRect(weaponX + dir * 3, y - 8, dir * 2, 6);
    // 盾
    ctx.fillStyle = "#8a7a60";
    ctx.fillRect(x - dir * 12, y - 8, 5, 16);
    ctx.fillStyle = color;
    ctx.fillRect(x - dir * 11, y - 6, 3, 12);
  } else if (unit.type === "pikeman") {
    // 长枪
    ctx.fillStyle = "#8a7050";
    ctx.fillRect(weaponX - dir * 2, y - 8, dir * 20, 2);
    ctx.fillStyle = "#e0d0c0";
    ctx.fillRect(weaponX + dir * 16, y - 10, dir * 2, 6);
  } else if (unit.type === "archer") {
    // 弓
    ctx.fillStyle = "#8a6040";
    ctx.fillRect(weaponX - dir * 2, y - 10, dir * 2, 10);
    ctx.fillStyle = "#c0a080";
    ctx.fillRect(weaponX, y - 14, dir * 6, 2);
    // 弓弦
    ctx.strokeStyle = "#e8d8c0";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(weaponX + dir * 5, y - 14);
    ctx.lineTo(weaponX + dir * 5, y - 8);
    ctx.stroke();
  } else if (unit.type === "cavalry") {
    // 骑枪 + 马身
    ctx.fillStyle = "#6a4a28";
    ctx.fillRect(x - 12, y + 5, 24, 10);
    ctx.fillRect(x - 10, y + 8, 20, 6);
    ctx.fillStyle = "#4a2a10";
    ctx.fillRect(x - 12, y + 14, 4, 4);
    ctx.fillRect(x + 8, y + 14, 4, 4);
    // 马头
    ctx.fillStyle = "#5a3a18";
    ctx.fillRect(x + dir * 12, y - 2, dir * 6, 9);
    // 骑枪
    ctx.fillStyle = "#7a6040";
    ctx.fillRect(weaponX, y - 4, dir * 22, 2);
    ctx.fillStyle = "#e8d0b0";
    ctx.fillRect(weaponX + dir * 20, y - 6, dir * 2, 6);
    // 马鬃
    ctx.fillStyle = "#3a2010";
    ctx.fillRect(x + dir * 2, y + 6, 2, 6);
  } else if (unit.type === "mage") {
    // 法杖
    ctx.fillStyle = "#5a3a5a";
    ctx.fillRect(x - dir * 4, y - 12, 3, 24);
    // 法球
    const glow = Math.sin(Date.now() / 500 + x) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(180,100,220,${glow})`;
    ctx.fillRect(x - dir * 4 - 3, y - 18, 10, 8);
    ctx.fillStyle = `rgba(220,160,255,${glow * 0.6})`;
    ctx.fillRect(x - dir * 4 - 1, y - 16, 6, 4);
  }
}

function drawDeadUnit(ctx, x, y, unit) {
  // 卧倒的身体
  ctx.fillStyle = unit.color;
  ctx.fillRect(x - 13, y + 7, 26, 8);
  // 头横过来
  ctx.fillStyle = "#e8d5b7";
  ctx.fillRect(x + 6, y + 3, 8, 6);
  // 掉落的头盔
  ctx.fillStyle = "#555";
  ctx.fillRect(x - 10, y + 3, 6, 4);
  // X 眼
  ctx.fillStyle = "#0a0603";
  ctx.fillRect(x + 8, y + 4, 1, 3);
  ctx.fillRect(x + 7, y + 5, 3, 1);
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
    const fleeButton = addButton(game.ui, 54, 474, 92, 30, "逃跑", "fleeBattle");
    drawButton(ctx, fleeButton, game.input);
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

  drawPanel(ctx, 310, 130, 340, 250, isWin ? "战斗胜利" : fled ? "撤退成功" : "战斗失败");
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
  drawPanel(ctx, 314, 174, 332, 188, "遭遇敌军");

  drawPixelText(ctx, enemy.name || "敌军", 480, 204, "#ff8a74", 22, "center");
  drawPixelText(ctx, "敌军挡住了去路，是否开战？", 480, 242, "#f8e9bd", 14, "center");
  drawPixelText(ctx, "逃跑会后撤一段距离，不会损失金币。", 480, 268, "#b9a77a", 12, "center");

  const fightButton = addButton(game.ui, 360, 310, 104, 34, "战斗", "acceptEncounter");
  const fleeButton = addButton(game.ui, 496, 310, 104, 34, "逃跑", "fleeEncounter");
  drawButton(ctx, fightButton, game.input);
  drawButton(ctx, fleeButton, game.input);
}

// ==================== 统一胜利横幅 ====================

function drawVictoryBanner(ctx) {
  // 背景遮罩
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  drawPanel(ctx, 248, 150, 464, 184, "大陆统一");

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
