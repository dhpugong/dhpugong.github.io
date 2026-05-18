import { CONFIG, FACTIONS, MINIMAP_FACTION_COLORS, MINIMAP_ICON_COLORS } from "../modules/config.js";
import { rectContains, clamp, lerp } from "../modules/utils.js";
import { panCameraTo } from "./camera.js";
import { isWorldPointDiscovered } from "./fog.js";
import { getTerrainOverviewCanvas } from "./mapRenderer.js";
import { openWorldMap } from "./worldmap.js";

const MINI_LOCAL_WORLD_W = 2400;
const MINI_LOCAL_WORLD_H = 1800;

export function createMiniMapState() {
  return {
    scale: 1,
    hoverWorld: null,
    pulse: 0
  };
}

export function drawMiniMap(ctx, game) {
  if (!game.mapUi) {
    return;
  }
  const state = game.mapUi.miniMap || createMiniMapState();
  game.mapUi.miniMap = state;
  const layout = getMiniMapLayout();
  const interactive = game.state === "world";
  const hovered = interactive && rectContains(layout, game.input.mouse.x, game.input.mouse.y);
  state.scale = lerp(state.scale || 1, hovered ? 1.045 : 1, 0.18);
  state.pulse += 0.035;

  ctx.save();
  ctx.translate(layout.x + layout.w / 2, layout.y + layout.h / 2);
  ctx.scale(state.scale, state.scale);
  ctx.translate(-layout.x - layout.w / 2, -layout.y - layout.h / 2);

  drawTechFrame(ctx, layout, hovered, state.pulse);

  const content = getMiniMapContentRect(layout);
  const view = getMiniMapWorldView(game.map, game.player);
  ctx.save();
  ctx.beginPath();
  ctx.rect(content.x, content.y, content.w, content.h);
  ctx.clip();

  const terrain = getTerrainOverviewCanvas(game.map);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    terrain,
    view.x / CONFIG.tileSize,
    view.y / CONFIG.tileSize,
    view.w / CONFIG.tileSize,
    view.h / CONFIG.tileSize,
    content.x,
    content.y,
    content.w,
    content.h
  );

  if (game.fog && game.fog.canvas) {
    ctx.drawImage(
      game.fog.canvas,
      view.x / CONFIG.tileSize,
      view.y / CONFIG.tileSize,
      view.w / CONFIG.tileSize,
      view.h / CONFIG.tileSize,
      content.x,
      content.y,
      content.w,
      content.h
    );
  }

  drawMiniMapDestinationLine(ctx, game, content, view);
  drawMiniMapMarkers(ctx, game, content, view);
  drawMiniMapCameraRect(ctx, game, content, view);
  drawHoverProbe(ctx, game, state, content, view, hovered);
  ctx.restore();

  drawMiniMapLegend(ctx, layout);
  ctx.restore();
}

export function handleMiniMapClick(game, click) {
  if (!game.mapUi || game.state !== "world") {
    return false;
  }
  const layout = getMiniMapLayout();
  if (!rectContains(layout, click.x, click.y)) {
    return false;
  }

  const content = getMiniMapContentRect(layout);
  const view = getMiniMapWorldView(game.map, game.player);
  const world = miniMapToWorld(click, content, view);
  panCameraTo(game.camera, world.x, world.y, game.map);
  openWorldMap(game.mapUi.worldMap, game.map, world);
  game.message = "打开世界地图";
  return true;
}

export function updateMiniMapHover(game) {
  if (!game.mapUi || game.state !== "world") {
    return;
  }
  const state = game.mapUi.miniMap || createMiniMapState();
  game.mapUi.miniMap = state;
  const layout = getMiniMapLayout();
  const content = getMiniMapContentRect(layout);
  if (!rectContains(content, game.input.mouse.x, game.input.mouse.y)) {
    state.hoverWorld = null;
    return;
  }
  state.hoverWorld = miniMapToWorld(game.input.mouse, content, getMiniMapWorldView(game.map, game.player));
}

function drawTechFrame(ctx, layout, hovered, pulse) {
  ctx.save();
  ctx.shadowColor = hovered ? "rgba(84,224,255,0.72)" : "rgba(84,224,255,0.38)";
  ctx.shadowBlur = hovered ? 18 : 10;
  ctx.fillStyle = "rgba(3, 12, 19, 0.72)";
  ctx.fillRect(layout.x, layout.y, layout.w, layout.h);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = hovered ? "#7df3ff" : "#35c8ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(layout.x + 0.5, layout.y + 0.5, layout.w, layout.h);
  ctx.strokeStyle = "rgba(87,227,255,0.32)";
  ctx.lineWidth = 1;
  ctx.strokeRect(layout.x + 5.5, layout.y + 5.5, layout.w - 11, layout.h - 11);

  ctx.fillStyle = `rgba(84,224,255,${0.08 + Math.sin(pulse) * 0.03})`;
  for (let x = layout.x + 12; x < layout.x + layout.w - 12; x += 16) {
    ctx.fillRect(x, layout.y + 10, 1, layout.h - 20);
  }
  for (let y = layout.y + 14; y < layout.y + layout.h - 12; y += 16) {
    ctx.fillRect(layout.x + 10, y, layout.w - 20, 1);
  }

  ctx.fillStyle = "#7df3ff";
  drawCorner(ctx, layout.x, layout.y, 10, 1);
  drawCorner(ctx, layout.x + layout.w, layout.y, -10, 1);
  drawCorner(ctx, layout.x, layout.y + layout.h, 10, -1);
  drawCorner(ctx, layout.x + layout.w, layout.y + layout.h, -10, -1);
  ctx.restore();
}

function drawCorner(ctx, x, y, dx, dy) {
  ctx.fillRect(x, y, dx, 2 * dy);
  ctx.fillRect(x, y, 2 * dx / Math.abs(dx), 10 * dy);
}

function drawMiniMapMarkers(ctx, game, content, view) {
  const labels = [];
  for (const town of game.map.towns || []) {
    if (!worldInView(town, view, 80)) continue;
    if (!isWorldPointDiscovered(game.fog, town.x, town.y)) continue;
    const p = worldToMiniMap(town.x, town.y, content, view);
    const color = getFactionColor(town.owner);
    drawMarker(ctx, p.x, p.y, color, town.kind === "castle" ? 5 : 4, "square");
    labels.push({ text: town.name, x: p.x, y: p.y - 17, color, maxWidth: 58 });
  }

  for (const resource of game.map.resources || []) {
    if (!worldInView(resource, view, 60)) continue;
    if (!isWorldPointDiscovered(game.fog, resource.x, resource.y)) continue;
    const p = worldToMiniMap(resource.x, resource.y, content, view);
    const color = resource.owner === "player" ? "#32ff9a" : "#ffe06a";
    drawMarker(ctx, p.x, p.y, color, 3, "diamond");
    labels.push({ text: resource.name, x: p.x, y: p.y + 7, color, maxWidth: 54 });
  }

  for (const npc of game.npcs || []) {
    if (!worldInView(npc, view, npc.stationed ? 82 : 50)) continue;
    if (!isWorldPointDiscovered(game.fog, npc.x, npc.y)) continue;
    const p = worldToMiniMap(npc.x, npc.y, content, view);
    const color = npc.faction === "wild" ? "#a0f403" : getFactionColor(npc.faction);
    const offset = getArmyMarkerOffset(npc);
    drawMarker(ctx, p.x + offset.x, p.y + offset.y, color, npc.stationed ? 3 : npc.kind === "wild" ? 3 : 4, "circle");
    if (npc.stationed) {
      drawStationPip(ctx, p.x + offset.x, p.y + offset.y, color);
    }
  }

  const player = worldToMiniMap(game.player.x, game.player.y, content, view);
  drawPlayerMarker(ctx, player.x, player.y, getFacingAngle(game.player));
  if (game.travelDestination && worldInView(game.travelDestination, view, 80)) {
    const destination = worldToMiniMap(game.travelDestination.x, game.travelDestination.y, content, view);
    drawMiniMapDestinationMarker(ctx, destination.x, destination.y);
  }
  for (const label of labels) {
    drawMiniMapLabel(ctx, label.text, label.x, label.y, label.color, label.maxWidth, content);
  }
}

function drawMiniMapDestinationLine(ctx, game, content, view) {
  if (!game.travelDestination) {
    return;
  }
  const a = worldToMiniMap(game.player.x, game.player.y, content, view);
  const b = worldToMiniMap(game.travelDestination.x, game.travelDestination.y, content, view);
  drawMiniDashedLine(ctx, a.x, a.y, b.x, b.y, content);
}

function drawMiniMapDestinationMarker(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = "#ffd56a";
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x - 4.5), Math.round(y - 4.5), 9, 9);
  ctx.fillStyle = "rgba(255,213,106,0.24)";
  ctx.fillRect(Math.round(x - 2), Math.round(y - 2), 4, 4);
  ctx.restore();
}

function drawMiniDashedLine(ctx, ax, ay, bx, by, content) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return;
  }
  ctx.save();
  for (const pass of [{ color: "rgba(0,0,0,0.76)", size: 4 }, { color: "rgba(255,213,106,0.82)", size: 2 }]) {
    ctx.fillStyle = pass.color;
    for (let d = 0; d <= length; d += 8) {
      if (Math.floor(d / 8) % 2 !== 0) {
        continue;
      }
      const t = d / length;
      const x = Math.round(ax + dx * t);
      const y = Math.round(ay + dy * t);
      if (!rectContains(content, x, y)) {
        continue;
      }
      ctx.fillRect(x - Math.floor(pass.size / 2), y - Math.floor(pass.size / 2), pass.size, pass.size);
    }
  }
  ctx.restore();
}

function drawMiniMapCameraRect(ctx, game, content, view) {
  const x1 = worldToMiniMap(game.camera.x, game.camera.y, content, view);
  const x2 = worldToMiniMap(game.camera.x + game.camera.width, game.camera.y + game.camera.height, content, view);
  const x = clamp(Math.min(x1.x, x2.x), content.x, content.x + content.w);
  const y = clamp(Math.min(x1.y, x2.y), content.y, content.y + content.h);
  const w = clamp(Math.abs(x2.x - x1.x), 4, content.w);
  const h = clamp(Math.abs(x2.y - x1.y), 4, content.h);
  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.strokeStyle = "rgba(84,224,255,0.48)";
  ctx.strokeRect(x - 1.5, y - 1.5, w + 4, h + 4);
}

function drawHoverProbe(ctx, game, state, content, view, hovered) {
  if (!hovered || !state.hoverWorld) {
    return;
  }
  const p = worldToMiniMap(state.hoverWorld.x, state.hoverWorld.y, content, view);
  ctx.strokeStyle = "rgba(125,243,255,0.72)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(content.x, p.y + 0.5);
  ctx.lineTo(content.x + content.w, p.y + 0.5);
  ctx.moveTo(p.x + 0.5, content.y);
  ctx.lineTo(p.x + 0.5, content.y + content.h);
  ctx.stroke();
}

function drawMiniMapLegend(ctx, layout) {
  const y = layout.y + 8;
  const x = layout.x + 12;
  ctx.fillStyle = MINIMAP_ICON_COLORS.playerArrow;
  ctx.fillRect(x, y, 6, 6);
  ctx.fillStyle = "#ff4d43";
  ctx.fillRect(x + 18, y, 6, 6);
  ctx.fillStyle = "#7df3ff";
  ctx.fillRect(x + 36, y, 6, 6);
}

function drawMarker(ctx, x, y, color, size, shape) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.strokeStyle = "rgba(0,0,0,0.72)";
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

function drawMiniMapLabel(ctx, text, x, y, color, maxWidth, content) {
  const label = fitMiniMapLabel(ctx, text, maxWidth, 8);
  if (!label) {
    return;
  }
  ctx.save();
  ctx.font = '700 8px "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const w = Math.ceil(ctx.measureText(label).width) + 6;
  const h = 11;
  const px = Math.round(clamp(x - w / 2, content.x + 1, content.x + content.w - w - 1));
  const py = Math.round(clamp(y, content.y + 1, content.y + content.h - h - 1));
  ctx.fillStyle = "rgba(3, 4, 5, 0.38)";
  ctx.fillRect(px, py, w, h);
  ctx.strokeStyle = "rgba(0,0,0,0.42)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, w, h);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.62;
  ctx.strokeRect(px + 1.5, py + 1.5, w - 2, h - 2);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.78)";
  ctx.strokeText(label, px + w / 2, py + 2);
  ctx.fillStyle = "#f8e9bd";
  ctx.fillText(label, px + w / 2, py + 2);
  ctx.restore();
}

function fitMiniMapLabel(ctx, text, maxWidth, size) {
  const value = String(text || "");
  if (!value) {
    return "";
  }
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
  ctx.fillStyle = "rgba(0,0,0,0.78)";
  ctx.fillRect(Math.round(x + 2), Math.round(y - 4), 5, 5);
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x + 3), Math.round(y - 3), 3, 3);
  ctx.restore();
}

function drawPlayerMarker(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle || 0);
  ctx.shadowColor = "#32ff9a";
  ctx.shadowBlur = 7;
  ctx.strokeStyle = "rgba(0,0,0,0.84)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -6.3);
  ctx.lineTo(5.6, 5.6);
  ctx.lineTo(0, 3.5);
  ctx.lineTo(-5.6, 5.6);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = "#32ff9a";
  ctx.beginPath();
  ctx.moveTo(0, -5.6);
  ctx.lineTo(4.9, 4.9);
  ctx.lineTo(0, 2.8);
  ctx.lineTo(-4.9, 4.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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

function getMiniMapWorldView(map, player) {
  const w = Math.min(map.width, MINI_LOCAL_WORLD_W);
  const h = Math.min(map.height, MINI_LOCAL_WORLD_H);
  return {
    x: clamp(player.x - w / 2, 0, Math.max(0, map.width - w)),
    y: clamp(player.y - h / 2, 0, Math.max(0, map.height - h)),
    w,
    h
  };
}

function worldToMiniMap(x, y, content, view) {
  return {
    x: content.x + ((x - view.x) / view.w) * content.w,
    y: content.y + ((y - view.y) / view.h) * content.h
  };
}

function miniMapToWorld(point, content, view) {
  return {
    x: clamp(view.x + ((point.x - content.x) / content.w) * view.w, view.x, view.x + view.w),
    y: clamp(view.y + ((point.y - content.y) / content.h) * view.h, view.y, view.y + view.h)
  };
}

function worldInView(point, view, pad = 0) {
  return point.x >= view.x - pad
    && point.x <= view.x + view.w + pad
    && point.y >= view.y - pad
    && point.y <= view.y + view.h + pad;
}

function getArmyMarkerOffset(npc) {
  if (!npc.stationed) {
    return { x: 0, y: 0 };
  }
  return { x: 7, y: -7 };
}

function getFactionColor(faction) {
  return MINIMAP_FACTION_COLORS[faction]
    || (FACTIONS[faction] ? FACTIONS[faction].color : "#f0e0a6");
}

function getMiniMapLayout() {
  return { x: 14, y: 348, w: 200, h: 162 };
}

function getMiniMapContentRect(layout) {
  return { x: layout.x + 12, y: layout.y + 22, w: layout.w - 24, h: layout.h - 34 };
}
