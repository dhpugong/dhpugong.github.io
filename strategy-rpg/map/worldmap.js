import { CONFIG, FACTIONS, MINIMAP_FACTION_COLORS } from "../modules/config.js";
import { clamp, lerp, rectContains } from "../modules/utils.js";
import { focusCameraOn } from "./camera.js";
import { isWorldPointDiscovered } from "./fog.js";
import { getTerrainOverviewCanvas } from "./mapRenderer.js";
import { clearUnitPath } from "./pathfinding.js";

const WORLD_MAP_RECT = { x: 58, y: 34, w: 844, h: 472 };
const CLOSE_BUTTON = {
  x: WORLD_MAP_RECT.x + WORLD_MAP_RECT.w - 10,
  y: WORLD_MAP_RECT.y - 19,
  w: 24,
  h: 24
};
const CLEAR_DEST_BUTTON = {
  x: WORLD_MAP_RECT.x + WORLD_MAP_RECT.w - 188,
  y: WORLD_MAP_RECT.y - 19,
  w: 104,
  h: 24
};

export function createWorldMapState() {
  return {
    open: false,
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    zoom: 0,
    targetZoom: 0,
    velocityX: 0,
    velocityY: 0,
    lastMouseDown: false,
    dragDistance: 0,
    hoverWorld: null
  };
}

export function openWorldMap(state, map, focus) {
  state.open = true;
  state.lastMouseDown = false;
  state.dragDistance = 0;
  const zoom = clamp(state.targetZoom || fitWorldZoom(map), fitWorldZoom(map), 2.2);
  state.zoom = zoom;
  state.targetZoom = zoom;
  centerWorldMapOn(state, map, focus ? focus.x : map.width / 2, focus ? focus.y : map.height / 2, true);
}

export function closeWorldMap(state) {
  state.open = false;
  state.velocityX = 0;
  state.velocityY = 0;
  state.lastMouseDown = false;
  state.dragDistance = 0;
}

export function closeWorldMapToPlayer(game) {
  const state = game.mapUi && game.mapUi.worldMap;
  if (state) {
    closeWorldMap(state);
  }
  if (game.camera && game.player && game.map) {
    focusCameraOn(game.camera, game.player.x, game.player.y, game.map, true);
    game.camera.locked = false;
  }
}

export function toggleWorldMap(state, map, focus) {
  if (state.open) {
    closeWorldMap(state);
  } else {
    openWorldMap(state, map, focus);
  }
}

export function updateWorldMap(game, dt) {
  const state = game.mapUi && game.mapUi.worldMap;
  if (!state || !state.open) {
    return;
  }

  const input = game.input;
  state.zoom = lerp(state.zoom, state.targetZoom, 0.22);
  state.x = lerp(state.x, state.targetX, 0.18);
  state.y = lerp(state.y, state.targetY, 0.18);

  if (input.mouse.down && !state.lastMouseDown) {
    state.dragDistance = 0;
  }

  if (input.mouse.down && rectContains(WORLD_MAP_RECT, input.mouse.x, input.mouse.y)) {
    const dx = input.mouse.dragDx || 0;
    const dy = input.mouse.dragDy || 0;
    if (dx || dy) {
      state.dragDistance += Math.abs(dx) + Math.abs(dy);
      state.targetX -= dx / state.zoom;
      state.targetY -= dy / state.zoom;
      state.velocityX = -dx / Math.max(dt, 0.016) / state.zoom * 0.014;
      state.velocityY = -dy / Math.max(dt, 0.016) / state.zoom * 0.014;
    }
  } else {
    state.targetX += state.velocityX;
    state.targetY += state.velocityY;
    state.velocityX *= 0.86;
    state.velocityY *= 0.86;
  }
  state.lastMouseDown = input.mouse.down;

  const wheel = input.mouse.wheel || 0;
  if (wheel && rectContains(WORLD_MAP_RECT, input.mouse.x, input.mouse.y)) {
    zoomAtScreenPoint(state, game.map, input.mouse.x, input.mouse.y, wheel < 0 ? 1.16 : 0.86);
  }
  input.mouse.dragDx = 0;
  input.mouse.dragDy = 0;
  input.mouse.wheel = 0;

  clampWorldMap(state, game.map);
  state.hoverWorld = screenToWorldMap(state, game.map, input.mouse.x, input.mouse.y);
}

export function handleWorldMapClick(game, click) {
  const state = game.mapUi && game.mapUi.worldMap;
  if (!state || !state.open) {
    return false;
  }
  if (rectContains(CLOSE_BUTTON, click.x, click.y)) {
    closeWorldMapToPlayer(game);
    game.message = "关闭世界地图";
    return true;
  }
  if (rectContains(CLEAR_DEST_BUTTON, click.x, click.y)) {
    if (game.travelDestination) {
      game.travelDestination = null;
      clearUnitPath(game.player);
      game.message = "已清除目的地";
    } else {
      game.message = "当前没有目的地";
    }
    return true;
  }
  if (!rectContains(WORLD_MAP_RECT, click.x, click.y)) {
    closeWorldMapToPlayer(game);
    game.message = "关闭世界地图";
    return true;
  }
  if ((state.dragDistance || 0) > 8) {
    state.dragDistance = 0;
    return true;
  }
  const world = screenToWorldMap(state, game.map, click.x, click.y);
  clearUnitPath(game.player);
  game.travelDestination = world;
  game.message = "目的地已设立，返回主界面点击自动寻路";
  return true;
}

export function handleWorldMapDoubleClick(game, point) {
  const state = game.mapUi && game.mapUi.worldMap;
  if (!state || !state.open || !point) {
    return false;
  }
  centerWorldMapOn(state, game.map, game.player.x, game.player.y, false);
  focusCameraOn(game.camera, game.player.x, game.player.y, game.map, true);
  if (game.input && game.input.mouse) {
    game.input.mouse.clicked = false;
  }
  game.message = "定位到玩家";
  return true;
}

export function drawWorldMap(ctx, game) {
  const state = game.mapUi && game.mapUi.worldMap;
  if (!state || !state.open) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.76)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  drawPixelBackdrop(ctx);
  drawFrame(ctx);

  const rect = WORLD_MAP_RECT;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  ctx.fillStyle = "#02080d";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const terrain = getTerrainOverviewCanvas(game.map);
  const draw = getWorldMapDrawInfo(state, game.map);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    terrain,
    draw.sourceX / CONFIG.tileSize,
    draw.sourceY / CONFIG.tileSize,
    draw.sourceW / CONFIG.tileSize,
    draw.sourceH / CONFIG.tileSize,
    draw.destX,
    draw.destY,
    draw.destW,
    draw.destH
  );

  if (game.fog && game.fog.canvas) {
    ctx.drawImage(
      game.fog.canvas,
      draw.sourceX / CONFIG.tileSize,
      draw.sourceY / CONFIG.tileSize,
      draw.sourceW / CONFIG.tileSize,
      draw.sourceH / CONFIG.tileSize,
      draw.destX,
      draw.destY,
      draw.destW,
      draw.destH
    );
  }

  drawMapPixelOverlay(ctx, rect, state);
  drawWorldGrid(ctx, state);
  drawWorldDestinationLine(ctx, game, state);
  drawWorldEntities(ctx, game, state);
  drawPlayerLocatorBox(ctx, game, state);
  ctx.restore();

  drawTopBar(ctx, game, state);
  drawClearDestinationButton(ctx, game.input, Boolean(game.travelDestination));
  drawCloseButton(ctx, game.input);
  ctx.restore();
}

function drawFrame(ctx) {
  const rect = WORLD_MAP_RECT;
  ctx.save();
  const outer = { x: rect.x - 20, y: rect.y - 24, w: rect.w + 40, h: rect.h + 48 };
  ctx.shadowColor = "rgba(0,0,0,0.72)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#171615";
  ctx.fillRect(outer.x, outer.y, outer.w, outer.h);
  ctx.shadowBlur = 0;
  drawStoneSegments(ctx, outer);

  ctx.fillStyle = "#0d0c0b";
  ctx.fillRect(rect.x - 8, rect.y - 10, rect.w + 16, rect.h + 20);
  ctx.fillStyle = "#24211d";
  ctx.fillRect(rect.x - 5, rect.y - 7, rect.w + 10, rect.h + 14);
  ctx.strokeStyle = "#5c4b2a";
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x - 7.5, rect.y - 9.5, rect.w + 15, rect.h + 19);
  ctx.strokeStyle = "#a98743";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x - 2.5, rect.y - 4.5, rect.w + 5, rect.h + 9);
  ctx.strokeStyle = "rgba(122,160,168,0.38)";
  ctx.strokeRect(rect.x + 1.5, rect.y + 1.5, rect.w - 3, rect.h - 3);

  drawFrameCorner(ctx, outer.x, outer.y, 26, 1, 1);
  drawFrameCorner(ctx, outer.x + outer.w, outer.y, 26, -1, 1);
  drawFrameCorner(ctx, outer.x, outer.y + outer.h, 26, 1, -1);
  drawFrameCorner(ctx, outer.x + outer.w, outer.y + outer.h, 26, -1, -1);
  drawFrameRivets(ctx, outer);
  ctx.restore();
}

function drawStoneSegments(ctx, outer) {
  const block = 42;
  for (let x = outer.x; x < outer.x + outer.w; x += block) {
    const w = Math.min(block - 3, outer.x + outer.w - x);
    const shade = Math.floor((x - outer.x) / block) % 2 === 0 ? "#26231f" : "#1f1d1a";
    ctx.fillStyle = shade;
    ctx.fillRect(x + 2, outer.y + 2, w, 16);
    ctx.fillRect(x + 2, outer.y + outer.h - 18, w, 16);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(x + 4, outer.y + 4, Math.max(0, w - 4), 2);
  }
  for (let y = outer.y + 18; y < outer.y + outer.h - 18; y += 36) {
    const h = Math.min(33, outer.y + outer.h - 18 - y);
    const shade = Math.floor((y - outer.y) / 36) % 2 === 0 ? "#211f1c" : "#292620";
    ctx.fillStyle = shade;
    ctx.fillRect(outer.x + 2, y, 16, h);
    ctx.fillRect(outer.x + outer.w - 18, y, 16, h);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(outer.x + 15, y + 2, 2, Math.max(0, h - 4));
    ctx.fillRect(outer.x + outer.w - 18, y + 2, 2, Math.max(0, h - 4));
  }
}

function drawPixelBackdrop(ctx) {
  ctx.save();
  ctx.fillStyle = "rgba(84,224,255,0.045)";
  for (let x = 16; x < CONFIG.canvasWidth; x += 48) {
    ctx.fillRect(x, 0, 1, CONFIG.canvasHeight);
  }
  for (let y = 20; y < CONFIG.canvasHeight; y += 36) {
    ctx.fillRect(0, y, CONFIG.canvasWidth, 1);
  }
  ctx.fillStyle = "rgba(214,168,79,0.05)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, 3);
  ctx.fillRect(0, CONFIG.canvasHeight - 3, CONFIG.canvasWidth, 3);
  ctx.restore();
}

function drawFrameCorner(ctx, x, y, size, sx, sy) {
  ctx.fillStyle = "#3b352c";
  ctx.fillRect(Math.round(x), Math.round(y), size * sx, 6 * sy);
  ctx.fillRect(Math.round(x), Math.round(y), 6 * sx, size * sy);
  ctx.fillStyle = "#a98743";
  ctx.fillRect(Math.round(x + 7 * sx), Math.round(y + 7 * sy), 12 * sx, 3 * sy);
  ctx.fillRect(Math.round(x + 7 * sx), Math.round(y + 7 * sy), 3 * sx, 12 * sy);
}

function drawFrameRivets(ctx, outer) {
  ctx.fillStyle = "#b08a3d";
  const points = [
    [outer.x + 28, outer.y + 14],
    [outer.x + outer.w - 30, outer.y + 14],
    [outer.x + 28, outer.y + outer.h - 16],
    [outer.x + outer.w - 30, outer.y + outer.h - 16]
  ];
  for (const point of points) {
    ctx.fillRect(Math.round(point[0] - 3), Math.round(point[1] - 3), 6, 6);
    ctx.fillStyle = "#5c3f1d";
    ctx.fillRect(Math.round(point[0] - 1), Math.round(point[1] - 1), 2, 2);
    ctx.fillStyle = "#b08a3d";
  }
}

function drawCloseButton(ctx, input) {
  const hovered = Boolean(input && rectContains(CLOSE_BUTTON, input.mouse.x, input.mouse.y));
  ctx.save();
  ctx.shadowColor = hovered ? "rgba(255,213,106,0.55)" : "rgba(84,224,255,0.28)";
  ctx.shadowBlur = hovered ? 10 : 5;
  ctx.fillStyle = hovered ? "rgba(54,34,18,0.92)" : "rgba(7,12,15,0.9)";
  ctx.fillRect(CLOSE_BUTTON.x, CLOSE_BUTTON.y, CLOSE_BUTTON.w, CLOSE_BUTTON.h);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hovered ? "#ffd56a" : "#7df3ff";
  ctx.lineWidth = 1;
  ctx.strokeRect(CLOSE_BUTTON.x + 0.5, CLOSE_BUTTON.y + 0.5, CLOSE_BUTTON.w, CLOSE_BUTTON.h);
  ctx.fillStyle = "rgba(125,243,255,0.12)";
  ctx.fillRect(CLOSE_BUTTON.x + 3, CLOSE_BUTTON.y + 3, CLOSE_BUTTON.w - 6, 2);
  ctx.strokeStyle = "#f8e9bd";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CLOSE_BUTTON.x + 7, CLOSE_BUTTON.y + 7);
  ctx.lineTo(CLOSE_BUTTON.x + CLOSE_BUTTON.w - 7, CLOSE_BUTTON.y + CLOSE_BUTTON.h - 7);
  ctx.moveTo(CLOSE_BUTTON.x + CLOSE_BUTTON.w - 7, CLOSE_BUTTON.y + 7);
  ctx.lineTo(CLOSE_BUTTON.x + 7, CLOSE_BUTTON.y + CLOSE_BUTTON.h - 7);
  ctx.stroke();
  ctx.restore();
}

function drawClearDestinationButton(ctx, input, enabled) {
  const hovered = Boolean(enabled && input && rectContains(CLEAR_DEST_BUTTON, input.mouse.x, input.mouse.y));
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.48;
  ctx.fillStyle = hovered ? "rgba(54,34,18,0.94)" : "rgba(7,12,15,0.9)";
  ctx.fillRect(CLEAR_DEST_BUTTON.x, CLEAR_DEST_BUTTON.y, CLEAR_DEST_BUTTON.w, CLEAR_DEST_BUTTON.h);
  ctx.strokeStyle = hovered ? "#ffd56a" : "rgba(169,135,67,0.84)";
  ctx.lineWidth = 1;
  ctx.strokeRect(CLEAR_DEST_BUTTON.x + 0.5, CLEAR_DEST_BUTTON.y + 0.5, CLEAR_DEST_BUTTON.w, CLEAR_DEST_BUTTON.h);
  ctx.fillStyle = enabled ? "#f8e9bd" : "#7b6d54";
  ctx.font = "700 12px Microsoft YaHei UI, Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("清除目的地", CLEAR_DEST_BUTTON.x + CLEAR_DEST_BUTTON.w / 2, CLEAR_DEST_BUTTON.y + CLEAR_DEST_BUTTON.h / 2 + 1);
  ctx.restore();
}

function drawTopBar(ctx, game, state) {
  const rect = WORLD_MAP_RECT;
  ctx.save();
  ctx.fillStyle = "rgba(11,9,7,0.86)";
  ctx.fillRect(rect.x - 16, rect.y - 22, rect.w + 32, 28);
  ctx.fillStyle = "rgba(169,135,67,0.18)";
  ctx.fillRect(rect.x - 16, rect.y + 3, rect.w + 32, 2);
  ctx.fillStyle = "rgba(122,160,168,0.08)";
  for (let x = rect.x - 8; x < rect.x + rect.w - 58; x += 18) {
    ctx.fillRect(x, rect.y - 18, 8, 1);
  }
  ctx.fillStyle = "#15120d";
  ctx.fillRect(rect.x - 2, rect.y - 20, 92, 23);
  ctx.strokeStyle = "#a98743";
  ctx.strokeRect(rect.x - 1.5, rect.y - 19.5, 92, 23);
  ctx.fillStyle = "#f2d48a";
  ctx.font = "700 15px Microsoft YaHei UI, Microsoft YaHei, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("世界地图", rect.x + 10, rect.y - 16);
  ctx.fillStyle = "rgba(248,233,189,0.72)";
  ctx.font = "600 11px Microsoft YaHei UI, Microsoft YaHei, sans-serif";
  ctx.fillText("单击设目的地 / 拖拽 / 滚轮 / 双击定位 / ESC", rect.x + 96, rect.y - 13);

  const zoomText = Math.round(state.zoom * 100) + "%";
  const zoomW = 56;
  const zoomX = CLOSE_BUTTON.x - zoomW - 8;
  ctx.fillStyle = "rgba(6,12,16,0.9)";
  ctx.fillRect(zoomX, rect.y - 19, zoomW, 22);
  ctx.strokeStyle = "rgba(169,135,67,0.8)";
  ctx.strokeRect(zoomX + 0.5, rect.y - 18.5, zoomW, 22);
  ctx.fillStyle = "#f8e9bd";
  ctx.font = "700 12px Consolas, Microsoft YaHei UI, monospace";
  ctx.textAlign = "center";
  ctx.fillText(zoomText, zoomX + zoomW / 2, rect.y - 14);
  ctx.restore();
}

function drawMapPixelOverlay(ctx, rect, state) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let y = rect.y + 2; y < rect.y + rect.h; y += 4) {
    ctx.fillRect(rect.x, y, rect.w, 1);
  }
  ctx.fillStyle = "rgba(84,224,255,0.05)";
  const sweep = rect.x + ((Date.now() / 36 + state.x * 0.02) % rect.w);
  ctx.fillRect(Math.round(sweep), rect.y, 2, rect.h);
  ctx.restore();
}

function drawWorldGrid(ctx, state) {
  const rect = WORLD_MAP_RECT;
  const spacing = 512 * state.zoom;
  if (spacing < 24) {
    return;
  }
  ctx.strokeStyle = "rgba(84,224,255,0.13)";
  ctx.lineWidth = 1;
  const startX = rect.x - ((state.x * state.zoom) % spacing);
  const startY = rect.y - ((state.y * state.zoom) % spacing);
  for (let x = startX; x < rect.x + rect.w; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, rect.y);
    ctx.lineTo(Math.round(x) + 0.5, rect.y + rect.h);
    ctx.stroke();
  }
  for (let y = startY; y < rect.y + rect.h; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(rect.x, Math.round(y) + 0.5);
    ctx.lineTo(rect.x + rect.w, Math.round(y) + 0.5);
    ctx.stroke();
  }
}

function drawWorldEntities(ctx, game, state) {
  for (const town of game.map.towns || []) {
    if (!isWorldPointDiscovered(game.fog, town.x, town.y)) continue;
    const p = worldToScreenMap(state, game.map, town.x, town.y);
    if (!rectContains(WORLD_MAP_RECT, p.x, p.y)) continue;
    const color = getFactionColor(town.owner);
    drawWorldMapLabel(ctx, town.name, p.x, p.y - 24, color, 78);
    drawMapMarker(ctx, p.x, p.y, color, town.kind === "castle" ? 7 : 5, "square");
  }
  for (const resource of game.map.resources || []) {
    if (!isWorldPointDiscovered(game.fog, resource.x, resource.y)) continue;
    const p = worldToScreenMap(state, game.map, resource.x, resource.y);
    if (!rectContains(WORLD_MAP_RECT, p.x, p.y)) continue;
    const color = resource.owner === "player" ? "#32ff9a" : "#ffe06a";
    drawMapMarker(ctx, p.x, p.y, color, 5, "diamond");
    drawWorldMapLabel(ctx, resource.name, p.x, p.y + 12, color, 76);
  }
  for (const npc of game.npcs || []) {
    if (!isWorldPointDiscovered(game.fog, npc.x, npc.y)) continue;
    const p = worldToScreenMap(state, game.map, npc.x, npc.y);
    if (!rectContains(WORLD_MAP_RECT, p.x, p.y)) continue;
    const color = npc.faction === "wild" ? "#a0f403" : getFactionColor(npc.faction);
    const offset = getArmyMarkerOffset(npc);
    drawMapMarker(ctx, p.x + offset.x, p.y + offset.y, color, npc.stationed ? 4 : 5, "circle");
    if (npc.stationed) {
      drawStationPip(ctx, p.x + offset.x, p.y + offset.y, color);
    }
  }

  const player = worldToScreenMap(state, game.map, game.player.x, game.player.y);
  drawPlayer(ctx, player.x, player.y, getFacingAngle(game.player));
  if (game.travelDestination) {
    const destination = worldToScreenMap(state, game.map, game.travelDestination.x, game.travelDestination.y);
    if (rectContains(WORLD_MAP_RECT, destination.x, destination.y)) {
      drawDestinationMarker(ctx, destination.x, destination.y);
    }
  }
}

function drawPlayerLocatorBox(ctx, game, state) {
  const player = worldToScreenMap(state, game.map, game.player.x, game.player.y);
  const size = 26;
  const x = Math.round(player.x - size / 2);
  const y = Math.round(player.y - size / 2);
  ctx.save();
  ctx.fillStyle = "rgba(50,255,154,0.07)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size, size);
  ctx.strokeStyle = "rgba(50,255,154,0.68)";
  ctx.strokeRect(x - 2.5, y - 2.5, size + 5, size + 5);
  ctx.fillStyle = "#32ff9a";
  drawLocatorCorner(ctx, x - 3, y - 3, 8, 1, 1);
  drawLocatorCorner(ctx, x + size + 3, y - 3, 8, -1, 1);
  drawLocatorCorner(ctx, x - 3, y + size + 3, 8, 1, -1);
  drawLocatorCorner(ctx, x + size + 3, y + size + 3, 8, -1, -1);
  ctx.restore();
}

function drawLocatorCorner(ctx, x, y, length, sx, sy) {
  ctx.fillRect(Math.round(x), Math.round(y), length * sx, 2 * sy);
  ctx.fillRect(Math.round(x), Math.round(y), 2 * sx, length * sy);
}

function drawWorldDestinationLine(ctx, game, state) {
  if (!game.travelDestination) {
    return;
  }
  const a = worldToScreenMap(state, game.map, game.player.x, game.player.y);
  const b = worldToScreenMap(state, game.map, game.travelDestination.x, game.travelDestination.y);
  drawScreenDashedLine(ctx, a.x, a.y, b.x, b.y, WORLD_MAP_RECT, "rgba(255,213,106,0.75)", "rgba(0,0,0,0.72)", 10, 3);
}

function drawDestinationMarker(ctx, x, y) {
  const pulse = Math.sin(Date.now() / 260) * 0.28 + 0.72;
  ctx.save();
  ctx.strokeStyle = `rgba(255,213,106,${pulse})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(Math.round(x - 7.5), Math.round(y - 7.5), 15, 15);
  ctx.fillStyle = `rgba(255,213,106,${pulse * 0.28})`;
  ctx.fillRect(Math.round(x - 4), Math.round(y - 4), 8, 8);
  ctx.restore();
}

function drawScreenDashedLine(ctx, ax, ay, bx, by, clip, color, outline, step, size) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return;
  }
  ctx.save();
  for (const pass of [{ color: outline, size: size + 2 }, { color, size }]) {
    ctx.fillStyle = pass.color;
    for (let d = 0; d <= length; d += step) {
      if (Math.floor(d / step) % 2 !== 0) {
        continue;
      }
      const t = d / length;
      const x = Math.round(ax + dx * t);
      const y = Math.round(ay + dy * t);
      if (!rectContains(clip, x, y)) {
        continue;
      }
      ctx.fillRect(x - Math.floor(pass.size / 2), y - Math.floor(pass.size / 2), pass.size, pass.size);
    }
  }
  ctx.restore();
}

function drawMapMarker(ctx, x, y, color, size, shape) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.78)";
  ctx.lineWidth = 1;
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(x, y, size + 0.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(x, y - size - 0.5);
    ctx.lineTo(x + size + 0.5, y);
    ctx.lineTo(x, y + size + 0.5);
    ctx.lineTo(x - size - 0.5, y);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.strokeRect(Math.round(x - size - 0.5) + 0.5, Math.round(y - size - 0.5) + 0.5, size * 2 + 1, size * 2 + 1);
  }
  ctx.fillStyle = color;
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(Math.round(x - size), Math.round(y - size), size * 2, size * 2);
  }
  ctx.restore();
}

function drawWorldMapLabel(ctx, text, x, y, color, maxWidth) {
  const label = fitWorldMapLabel(ctx, text, maxWidth, 10);
  ctx.save();
  ctx.font = '700 10px "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const w = Math.ceil(ctx.measureText(label).width) + 12;
  const h = 15;
  const px = Math.round(x - w / 2);
  const py = Math.round(y);
  ctx.fillStyle = "rgba(3, 4, 5, 0.48)";
  ctx.fillRect(px, py, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(px + 2, py + 2, w - 4, 1);
  ctx.strokeStyle = "rgba(0,0,0,0.58)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, w, h);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.72;
  ctx.strokeRect(px + 2.5, py + 2.5, w - 4, h - 4);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.strokeText(label, Math.round(x), py + 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.strokeText(label, Math.round(x), py + 2);
  ctx.fillStyle = "#f8e9bd";
  ctx.fillText(label, Math.round(x), py + 2);
  ctx.restore();
}

function fitWorldMapLabel(ctx, text, maxWidth, size) {
  const value = String(text || "");
  ctx.save();
  ctx.font = `700 ${size}px "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif`;
  if (ctx.measureText(value).width <= maxWidth) {
    ctx.restore();
    return value;
  }
  let fitted = value;
  while (fitted.length > 1 && ctx.measureText(fitted + "...").width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  ctx.restore();
  return fitted + "...";
}

function drawStationPip(ctx, x, y, color) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.82)";
  ctx.fillRect(Math.round(x + 3), Math.round(y - 5), 7, 7);
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x + 4), Math.round(y - 4), 5, 5);
  ctx.restore();
}

function drawPlayer(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle || 0);
  ctx.shadowColor = "#32ff9a";
  ctx.shadowBlur = 10;
  ctx.strokeStyle = "rgba(0,0,0,0.86)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -8.4);
  ctx.lineTo(7.7, 7.7);
  ctx.lineTo(0, 4.2);
  ctx.lineTo(-7.7, 7.7);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = "#32ff9a";
  ctx.beginPath();
  ctx.moveTo(0, -7.7);
  ctx.lineTo(7, 7);
  ctx.lineTo(0, 3.5);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function getArmyMarkerOffset(npc) {
  if (!npc.stationed) {
    return { x: 0, y: 0 };
  }
  return { x: 10, y: -10 };
}

function getFacingAngle(unit) {
  if (typeof unit.facingAngle === "number") {
    return unit.facingAngle;
  }
  if (unit.facing === "right") return Math.PI / 2;
  if (unit.facing === "down") return Math.PI;
  if (unit.facing === "left") return -Math.PI / 2;
  return 0;
}

function zoomAtScreenPoint(state, map, sx, sy, factor) {
  const before = screenToWorldMap(state, map, sx, sy);
  state.targetZoom = clamp(state.targetZoom * factor, fitWorldZoom(map), 2.2);
  state.zoom = clamp(state.zoom, fitWorldZoom(map), 2.2);
  const after = screenToWorldMap(state, map, sx, sy);
  state.targetX += before.x - after.x;
  state.targetY += before.y - after.y;
}

function centerWorldMapOn(state, map, x, y, immediate) {
  state.targetX = x - WORLD_MAP_RECT.w / state.targetZoom / 2;
  state.targetY = y - WORLD_MAP_RECT.h / state.targetZoom / 2;
  clampWorldMap(state, map);
  if (immediate) {
    state.x = state.targetX;
    state.y = state.targetY;
  }
}

function clampWorldMap(state, map) {
  const visibleW = WORLD_MAP_RECT.w / Math.max(0.001, state.targetZoom);
  const visibleH = WORLD_MAP_RECT.h / Math.max(0.001, state.targetZoom);
  state.targetX = clamp(state.targetX, 0, Math.max(0, map.width - visibleW));
  state.targetY = clamp(state.targetY, 0, Math.max(0, map.height - visibleH));
  state.x = clamp(state.x, 0, Math.max(0, map.width - WORLD_MAP_RECT.w / Math.max(0.001, state.zoom)));
  state.y = clamp(state.y, 0, Math.max(0, map.height - WORLD_MAP_RECT.h / Math.max(0.001, state.zoom)));
}

function fitWorldZoom(map) {
  return Math.min(WORLD_MAP_RECT.w / map.width, WORLD_MAP_RECT.h / map.height);
}

function worldToScreenMap(state, map, x, y) {
  const draw = getWorldMapDrawInfo(state, map);
  return {
    x: draw.destX + (x - draw.sourceX) * state.zoom,
    y: draw.destY + (y - draw.sourceY) * state.zoom
  };
}

function screenToWorldMap(state, map, x, y) {
  const draw = getWorldMapDrawInfo(state, map);
  return {
    x: clamp(draw.sourceX + (x - draw.destX) / Math.max(0.001, state.zoom), 0, map.width),
    y: clamp(draw.sourceY + (y - draw.destY) / Math.max(0.001, state.zoom), 0, map.height)
  };
}

function getWorldMapDrawInfo(state, map) {
  const rect = WORLD_MAP_RECT;
  const zoom = Math.max(0.001, state.zoom);
  const scaledW = map.width * zoom;
  const scaledH = map.height * zoom;
  const fitsX = scaledW <= rect.w;
  const fitsY = scaledH <= rect.h;
  const sourceX = fitsX ? 0 : state.x;
  const sourceY = fitsY ? 0 : state.y;
  const sourceW = fitsX ? map.width : Math.min(map.width - sourceX, rect.w / zoom);
  const sourceH = fitsY ? map.height : Math.min(map.height - sourceY, rect.h / zoom);

  return {
    sourceX,
    sourceY,
    sourceW,
    sourceH,
    destX: fitsX ? rect.x + (rect.w - scaledW) / 2 : rect.x,
    destY: fitsY ? rect.y + (rect.h - scaledH) / 2 : rect.y,
    destW: sourceW * zoom,
    destH: sourceH * zoom
  };
}

function getFactionColor(faction) {
  return MINIMAP_FACTION_COLORS[faction]
    || (FACTIONS[faction] ? FACTIONS[faction].color : "#f0e0a6");
}
