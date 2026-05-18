import { CONFIG, FACTIONS, MINIMAP_ICON_COLORS, TERRAIN } from "../modules/config.js";
import { getTerrainById } from "../modules/map.js";
import { darkenColor, drawPixelText } from "../modules/utils.js";
import { drawFogOfWar } from "./fog.js";

const CHUNK_TILES = 16;
const chunkCaches = new WeakMap();
const terrainOverviewCaches = new WeakMap();

export function renderWorldScene(ctx, game) {
  drawMapLayer(ctx, game);
  drawObjectLayer(ctx, game);
  drawPlayerPath(ctx, game);
  drawUnitLayer(ctx, game);
  drawFogOfWar(ctx, game.fog, game.camera);
}

export function getTerrainOverviewCanvas(map) {
  const cached = terrainOverviewCaches.get(map);
  const key = getMapCacheKey(map);
  if (cached && cached.key === key) {
    return cached.canvas;
  }

  const canvas = createMapCanvas(map.cols, map.rows);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const image = ctx.createImageData(map.cols, map.rows);

  for (let row = 0; row < map.rows; row += 1) {
    for (let col = 0; col < map.cols; col += 1) {
      const terrain = getTerrainById(map.tiles[row][col]);
      const color = hexToRgb(getMiniTerrainColor(terrain.id));
      const p = (row * map.cols + col) * 4;
      image.data[p] = color.r;
      image.data[p + 1] = color.g;
      image.data[p + 2] = color.b;
      image.data[p + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  terrainOverviewCaches.set(map, { key, canvas });
  return canvas;
}

export function createMapCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawMapLayer(ctx, game) {
  const { map, camera } = game;
  const tileSize = CONFIG.tileSize;
  const startChunkX = Math.floor(camera.x / (tileSize * CHUNK_TILES));
  const endChunkX = Math.floor((camera.x + camera.width) / (tileSize * CHUNK_TILES));
  const startChunkY = Math.floor(camera.y / (tileSize * CHUNK_TILES));
  const endChunkY = Math.floor((camera.y + camera.height) / (tileSize * CHUNK_TILES));

  for (let cy = startChunkY; cy <= endChunkY; cy += 1) {
    for (let cx = startChunkX; cx <= endChunkX; cx += 1) {
      const chunk = getChunkCanvas(map, cx, cy);
      if (!chunk) continue;
      ctx.drawImage(
        chunk.canvas,
        Math.round(chunk.worldX - camera.x),
        Math.round(chunk.worldY - camera.y)
      );
    }
  }

  drawAnimatedWater(ctx, game);
}

function getChunkCanvas(map, chunkX, chunkY) {
  if (chunkX < 0 || chunkY < 0) {
    return null;
  }
  const startCol = chunkX * CHUNK_TILES;
  const startRow = chunkY * CHUNK_TILES;
  if (startCol >= map.cols || startRow >= map.rows) {
    return null;
  }

  const key = `${getMapCacheKey(map)}:${chunkX}:${chunkY}`;
  let cache = chunkCaches.get(map);
  if (!cache || cache.key !== getMapCacheKey(map)) {
    cache = { key: getMapCacheKey(map), chunks: new Map() };
    chunkCaches.set(map, cache);
  }
  if (cache.chunks.has(key)) {
    return cache.chunks.get(key);
  }

  const tileSize = CONFIG.tileSize;
  const cols = Math.min(CHUNK_TILES, map.cols - startCol);
  const rows = Math.min(CHUNK_TILES, map.rows - startRow);
  const canvas = createMapCanvas(cols * tileSize, rows * tileSize);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const mapCol = startCol + col;
      const mapRow = startRow + row;
      const terrain = getTerrainById(map.tiles[mapRow][mapCol]);
      drawCachedTile(ctx, map, terrain, col * tileSize, row * tileSize, tileSize, mapCol, mapRow);
    }
  }

  const chunk = {
    canvas,
    worldX: startCol * tileSize,
    worldY: startRow * tileSize
  };
  cache.chunks.set(key, chunk);
  return chunk;
}

function drawCachedTile(ctx, map, terrain, x, y, size, col, row) {
  ctx.fillStyle = terrain.color;
  ctx.fillRect(x, y, size, size);

  const speck = ((col * 31 + row * 17) % 11);
  const accent = ((col * 17 + row * 29) % 13);
  ctx.fillStyle = "rgba(255,255,255,0.055)";
  if (speck % 2 === 0) {
    ctx.fillRect(x + 4 + speck, y + 8, 7, 2);
  }
  ctx.fillStyle = "rgba(0,0,0,0.045)";
  ctx.fillRect(x + size - 1, y, 1, size);
  ctx.fillRect(x, y + size - 1, size, 1);
  drawTileGrain(ctx, x, y, size, col, row, terrain.id);

  if (terrain.id === TERRAIN.grass.id) {
    drawGrassTile(ctx, x, y, size, speck, accent);
  } else if (terrain.id === TERRAIN.forest.id) {
    drawForestTile(ctx, x, y, size, col, row);
  } else if (terrain.id === TERRAIN.hill.id) {
    drawHillTile(ctx, x, y, size, col, row);
  } else if (terrain.id === TERRAIN.mountain.id) {
    drawMountainTile(ctx, x, y, size, col, row);
  } else if (terrain.id === TERRAIN.water.id) {
    drawWaterTile(ctx, x, y, size, col, row);
  } else if (terrain.id === TERRAIN.road.id) {
    drawRoadTile(ctx, map, x, y, size, col, row);
  }

  drawTerrainTransitions(ctx, map, terrain, x, y, size, col, row);
}

function drawTileGrain(ctx, x, y, size, col, row, terrainId) {
  const seed = col * 928371 + row * 68917;
  const light = terrainId === TERRAIN.water.id ? "rgba(156,219,244,0.13)" : "rgba(255,244,196,0.075)";
  const dark = terrainId === TERRAIN.water.id ? "rgba(10,31,48,0.075)" : "rgba(24,20,12,0.052)";
  for (let i = 0; i < 3; i += 1) {
    const px = x + 3 + ((seed + i * 11) % (size - 7));
    const py = y + 4 + ((seed * 3 + i * 13) % (size - 8));
    ctx.fillStyle = i === 1 ? dark : light;
    ctx.fillRect(px, py, i === 2 ? 3 : 2, 1);
  }
}

function drawGrassTile(ctx, x, y, size, speck, accent) {
  ctx.fillStyle = "rgba(165,207,94,0.2)";
  ctx.fillRect(x + 3, y + 5 + speck, 10, 2);
  ctx.fillRect(x + 18, y + 18 - (speck % 6), 8, 2);
  ctx.fillStyle = "rgba(44,92,40,0.1)";
  ctx.fillRect(x + 6 + (accent % 6), y + 24, 5, 2);
  ctx.fillRect(x + 17, y + 10 + (accent % 4), 2, 5);
  ctx.fillRect(x + 20, y + 12 + (speck % 3), 2, 4);
  ctx.fillStyle = "rgba(255,231,143,0.11)";
  if (accent % 3 === 0) {
    ctx.fillRect(x + 21, y + 6 + (speck % 5), 2, 2);
  }
}

function drawForestTile(ctx, x, y, size, col, row) {
  ctx.fillStyle = "#2e5b2d";
  ctx.fillRect(x + 2, y + 3, size - 4, size - 6);
  ctx.fillStyle = "#4d8542";
  for (let i = 0; i < 4; i += 1) {
    const px = x + 4 + ((col * 13 + row * 7 + i * 9) % 22);
    const py = y + 5 + ((row * 11 + i * 6) % 19);
    ctx.fillRect(px, py, 5, 6);
    ctx.fillStyle = "#2a4d27";
    ctx.fillRect(px + 1, py + 5, 3, 5);
    ctx.fillStyle = "#5f984e";
  }
  ctx.fillStyle = "rgba(178,234,120,0.22)";
  ctx.fillRect(x + 6 + ((col + row) % 9), y + 4, 7, 2);
  ctx.fillStyle = "rgba(12,28,13,0.1)";
  ctx.fillRect(x + 3, y + size - 6, size - 6, 3);
}

function drawHillTile(ctx, x, y, size, col, row) {
  ctx.fillStyle = "#8d7a4a";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "rgba(255,238,170,0.14)";
  ctx.fillRect(x + 3, y + 7 + ((col + row) % 8), size - 8, 3);
  ctx.fillRect(x + 7, y + 13 + ((col * 2 + row) % 7), size - 14, 2);
  ctx.fillStyle = "rgba(58,43,21,0.08)";
  ctx.fillRect(x + 8, y + 20, size - 10, 4);
  ctx.fillStyle = "rgba(82,61,31,0.13)";
  ctx.fillRect(x + 4 + ((col * 5 + row) % 13), y + 25, 5, 2);
}

function drawMountainTile(ctx, x, y, size, col, row) {
  ctx.fillStyle = "#526d7a";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#3d5967";
  ctx.fillRect(x, y + size - 7, size, 7);

  const mainShift = ((col * 7 + row * 5) % 9) - 4;
  const leftShift = ((col * 5 + row * 11) % 5) - 2;
  const rightShift = ((col * 13 + row * 3) % 7) - 3;
  const mainPeakX = x + size / 2 + mainShift;
  const leftPeakX = x + 8 + leftShift;
  const rightPeakX = x + size - 8 + rightShift;

  ctx.fillStyle = "#344a58";
  ctx.beginPath();
  ctx.moveTo(x + 2, y + size);
  ctx.lineTo(leftPeakX, y + 10);
  ctx.lineTo(x + 18, y + size);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#405d6c";
  ctx.beginPath();
  ctx.moveTo(x + 13, y + size);
  ctx.lineTo(mainPeakX, y + 2);
  ctx.lineTo(x + size - 3, y + size);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#668596";
  ctx.beginPath();
  ctx.moveTo(x + 8, y + size - 1);
  ctx.lineTo(mainPeakX, y + 4);
  ctx.lineTo(x + 19, y + size - 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#314555";
  ctx.beginPath();
  ctx.moveTo(x + 19, y + size);
  ctx.lineTo(rightPeakX, y + 8);
  ctx.lineTo(x + size - 1, y + size);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#8ca9b8";
  ctx.beginPath();
  ctx.moveTo(Math.round(mainPeakX) - 1, y + 5);
  ctx.lineTo(Math.round(mainPeakX) + 5, y + 17);
  ctx.lineTo(Math.round(mainPeakX) + 1, y + 16);
  ctx.lineTo(Math.round(mainPeakX) - 5, y + 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#d0e1e7";
  ctx.fillRect(Math.round(mainPeakX) - 4, y + 4, 8, 2);
  ctx.fillRect(Math.round(mainPeakX) - 2, y + 7, 4, 2);
  ctx.fillRect(Math.round(leftPeakX) - 3, y + 11, 5, 2);

  ctx.fillStyle = "rgba(234,247,250,0.22)";
  ctx.fillRect(x + 6, y + size - 11, 7, 2);
  ctx.fillRect(x + 21, y + size - 14, 5, 2);
  ctx.fillStyle = "rgba(20,34,44,0.11)";
  ctx.fillRect(x + size - 6, y + 13, 3, size - 16);
  ctx.fillRect(x + 2, y + size - 4, size - 4, 3);
}

function drawWaterTile(ctx, x, y, size, col, row) {
  ctx.fillStyle = "#2d6e96";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "rgba(149,216,244,0.2)";
  ctx.fillRect(x + 2, y + 6 + ((col * 3 + row * 5) % 18), size - 4, 2);
  ctx.fillStyle = "rgba(14,54,82,0.12)";
  ctx.fillRect(x, y + size - 5, size, 5);
}

function drawRoadTile(ctx, map, x, y, size, col, row) {
  const north = getNeighborTerrain(map, col, row - 1) === TERRAIN.road.id;
  const south = getNeighborTerrain(map, col, row + 1) === TERRAIN.road.id;
  const west = getNeighborTerrain(map, col - 1, row) === TERRAIN.road.id;
  const east = getNeighborTerrain(map, col + 1, row) === TERRAIN.road.id;
  const hasConnection = north || south || west || east;
  const mid = Math.round(size / 2);

  ctx.fillStyle = "#6f8a45";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "rgba(174,210,96,0.17)";
  ctx.fillRect(x + 4, y + 5 + ((col + row) % 9), 8, 2);

  ctx.fillStyle = "#9f7542";
  ctx.fillRect(x + mid - 6, y + mid - 6, 12, 12);
  if (!hasConnection || north) ctx.fillRect(x + mid - 5, y, 10, mid);
  if (!hasConnection || south) ctx.fillRect(x + mid - 5, y + mid, 10, mid);
  if (!hasConnection || west) ctx.fillRect(x, y + mid - 5, mid, 10);
  if (!hasConnection || east) ctx.fillRect(x + mid, y + mid - 5, mid, 10);

  ctx.fillStyle = "#be9252";
  ctx.fillRect(x + mid - 4, y + mid - 4, 8, 8);
  if (!hasConnection || north) ctx.fillRect(x + mid - 3, y, 6, mid);
  if (!hasConnection || south) ctx.fillRect(x + mid - 3, y + mid, 6, mid);
  if (!hasConnection || west) ctx.fillRect(x, y + mid - 3, mid, 6);
  if (!hasConnection || east) ctx.fillRect(x + mid, y + mid - 3, mid, 6);

  ctx.fillStyle = "rgba(255,232,166,0.2)";
  ctx.fillRect(x + 3 + ((col + row) % 9), y + size / 2 - 2, 7, 2);
  ctx.fillStyle = "rgba(78,48,24,0.13)";
  for (let i = 0; i < 3; i += 1) {
    ctx.fillRect(x + 4 + ((col * 5 + row * 3 + i * 8) % 22), y + 9 + i * 6, 3, 2);
  }
}

function drawTerrainTransitions(ctx, map, terrain, x, y, size, col, row) {
  const north = getNeighborTerrain(map, col, row - 1);
  const south = getNeighborTerrain(map, col, row + 1);
  const west = getNeighborTerrain(map, col - 1, row);
  const east = getNeighborTerrain(map, col + 1, row);

  if (terrain.id !== TERRAIN.water.id && [north, south, west, east].includes(TERRAIN.water.id)) {
    ctx.fillStyle = "rgba(155,219,244,0.22)";
    if (north === TERRAIN.water.id) ctx.fillRect(x, y, size, 3);
    if (south === TERRAIN.water.id) ctx.fillRect(x, y + size - 3, size, 3);
    if (west === TERRAIN.water.id) ctx.fillRect(x, y, 3, size);
    if (east === TERRAIN.water.id) ctx.fillRect(x + size - 3, y, 3, size);
  }

  if (terrain.id !== TERRAIN.road.id && [north, south, west, east].includes(TERRAIN.road.id)) {
    ctx.fillStyle = "rgba(210,165,91,0.2)";
    if (north === TERRAIN.road.id) ctx.fillRect(x, y, size, 2);
    if (south === TERRAIN.road.id) ctx.fillRect(x, y + size - 2, size, 2);
    if (west === TERRAIN.road.id) ctx.fillRect(x, y, 2, size);
    if (east === TERRAIN.road.id) ctx.fillRect(x + size - 2, y, 2, size);
  }
}

function getNeighborTerrain(map, col, row) {
  if (!map.tiles[row] || typeof map.tiles[row][col] !== "number") {
    return null;
  }
  return map.tiles[row][col];
}

function drawAnimatedWater(ctx, game) {
  const { map, camera } = game;
  const tileSize = CONFIG.tileSize;
  const startCol = Math.max(0, Math.floor(camera.x / tileSize));
  const endCol = Math.min(map.cols - 1, Math.ceil((camera.x + camera.width) / tileSize));
  const startRow = Math.max(0, Math.floor(camera.y / tileSize));
  const endRow = Math.min(map.rows - 1, Math.ceil((camera.y + camera.height) / tileSize));
  const tick = Math.floor(Date.now() / 220);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      if (map.tiles[row][col] !== TERRAIN.water.id) continue;
      const x = Math.round(col * tileSize - camera.x);
      const y = Math.round(row * tileSize - camera.y);
      const waveY = (col * 5 + row * 3 + tick) % 24;
      ctx.fillStyle = "rgba(155,219,244,0.2)";
      ctx.fillRect(x + 4, y + waveY, tileSize - 8, 2);
    }
  }
  ctx.restore();
}

function drawObjectLayer(ctx, game) {
  const { map, camera } = game;

  for (const deco of map.decorations || []) {
    const sx = Math.round(deco.x - camera.x);
    const sy = Math.round(deco.y - camera.y);
    if (sx < -24 || sy < -24 || sx > camera.width + 24 || sy > camera.height + 24) continue;
    drawDecoration(ctx, deco, sx, sy);
  }

  for (const resource of map.resources || []) {
    drawResourceOnMap(ctx, game, resource);
  }

  for (const town of map.towns || []) {
    drawTownOnMap(ctx, game, town);
  }
}

function drawDecoration(ctx, deco, x, y) {
  if (deco.type === "tree") {
    ctx.fillStyle = "#4a3520";
    ctx.fillRect(x - 2, y + 1, 4, 10);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(x - 9, y + 9, 18, 4);
    ctx.fillStyle = "#172a17";
    ctx.fillRect(x - 9, y - 1, 18, 11);
    ctx.fillStyle = "#244f28";
    ctx.fillRect(x - 8, y - 7, 16, 11);
    ctx.fillStyle = "#36723a";
    ctx.fillRect(x - 5, y - 11, 10, 8);
    ctx.fillStyle = "rgba(137,214,102,0.34)";
    ctx.fillRect(x + 1, y - 9, 3, 3);
    ctx.fillRect(x - 5, y - 4, 2, 2);
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x - 5, y + 2, 10, 3);
    ctx.fillStyle = "#6d665d";
    ctx.fillRect(x - 4, y - 2, 8, 5);
    ctx.fillStyle = "#877d70";
    ctx.fillRect(x - 2, y - 3, 5, 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x - 3, y - 1, 2, 1);
  }
}

function drawTownOnMap(ctx, game, town) {
  const sx = Math.round(town.x - game.camera.x);
  const sy = Math.round(town.y - game.camera.y);
  if (sx < -76 || sy < -76 || sx > game.camera.width + 76 || sy > game.camera.height + 76) return;

  const faction = FACTIONS[town.owner] || FACTIONS.neutral;
  const factionColor = town.owner === "player" ? MINIMAP_ICON_COLORS.playerArrow : faction.color;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(sx - 28, sy + 18, 56, 9);
  ctx.fillStyle = "rgba(214,168,79,0.13)";
  ctx.fillRect(sx - 23, sy + 15, 46, 3);
  drawTownBase(ctx, sx, sy, town.kind, factionColor);

  if (town.kind === "castle") {
    drawCastle(ctx, sx, sy, factionColor);
  } else if (town.kind === "tavern") {
    drawTavern(ctx, sx, sy, factionColor);
  } else {
    drawVillage(ctx, sx, sy, factionColor);
  }

  drawMapNameplate(ctx, town.name, sx, sy + 27, factionColor, 92);
  ctx.restore();
}

function drawTownBase(ctx, cx, cy, kind, color) {
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(cx - 35, cy + 11, 70, 14);
  ctx.fillStyle = kind === "castle" ? "rgba(105,101,88,0.36)" : "rgba(92,73,45,0.34)";
  ctx.fillRect(cx - 32, cy + 10, 64, 9);
  ctx.fillStyle = "rgba(255,238,180,0.12)";
  ctx.fillRect(cx - 27, cy + 12, 13, 2);
  ctx.fillRect(cx + 9, cy + 15, 18, 2);
  ctx.fillStyle = color;
  ctx.fillRect(cx - 33, cy + 9, 5, 3);
  ctx.fillRect(cx + 28, cy + 9, 5, 3);
}

function drawCastle(ctx, cx, cy, color) {
  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.fillRect(cx - 30, cy + 8, 60, 8);
  ctx.fillStyle = "#22201e";
  ctx.fillRect(cx - 26, cy - 14, 52, 25);
  ctx.fillStyle = "#302d29";
  for (let i = -22; i <= 18; i += 10) {
    ctx.fillRect(cx + i, cy - 11, 6, 2);
    ctx.fillRect(cx + i + 3, cy + 1, 7, 2);
  }
  ctx.fillStyle = "#4a4540";
  ctx.fillRect(cx - 23, cy - 19, 13, 30);
  ctx.fillRect(cx + 10, cy - 19, 13, 30);
  ctx.fillRect(cx - 10, cy - 32, 20, 43);
  ctx.fillStyle = "#716a61";
  ctx.fillRect(cx - 6, cy - 25, 5, 2);
  ctx.fillRect(cx + 2, cy - 16, 6, 2);
  ctx.fillRect(cx - 19, cy - 7, 6, 2);
  ctx.fillRect(cx + 13, cy - 5, 6, 2);
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  ctx.fillRect(cx - 21, cy - 17, 4, 24);
  ctx.fillRect(cx - 8, cy - 30, 5, 36);
  ctx.fillStyle = color;
  ctx.fillRect(cx - 27, cy - 21, 54, 7);
  ctx.fillRect(cx - 13, cy - 36, 26, 8);
  for (let x = -25; x <= 21; x += 9) {
    ctx.fillRect(cx + x, cy - 26, 5, 7);
  }
  ctx.fillStyle = "#130c07";
  ctx.fillRect(cx - 6, cy - 4, 12, 15);
  ctx.fillStyle = "#5f3f17";
  ctx.fillRect(cx - 4, cy, 3, 11);
  ctx.fillRect(cx + 1, cy, 3, 11);
  ctx.fillStyle = "#ffd56a";
  ctx.fillRect(cx - 18, cy - 9, 4, 5);
  ctx.fillRect(cx + 14, cy - 9, 4, 5);
  ctx.fillStyle = "rgba(255,213,106,0.18)";
  ctx.fillRect(cx - 20, cy - 11, 8, 9);
  ctx.fillRect(cx + 12, cy - 11, 8, 9);
  ctx.fillStyle = "#d6a84f";
  ctx.fillRect(cx - 1, cy - 48, 2, 14);
  ctx.fillStyle = color;
  ctx.fillRect(cx + 1, cy - 48, 15, 8);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(cx + 3, cy - 47, 3, 6);
}

function drawTavern(ctx, cx, cy, color) {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(cx - 23, cy + 10, 46, 7);
  ctx.fillStyle = "#2b1b10";
  ctx.fillRect(cx - 20, cy - 11, 40, 23);
  ctx.fillStyle = "#7a5030";
  ctx.fillRect(cx - 16, cy - 8, 32, 20);
  ctx.fillStyle = "#5a3620";
  for (let y = -6; y <= 8; y += 6) {
    ctx.fillRect(cx - 15, cy + y, 30, 1);
  }
  ctx.fillStyle = "rgba(255,238,190,0.12)";
  ctx.fillRect(cx - 14, cy - 6, 28, 2);
  ctx.fillRect(cx - 13, cy + 2, 26, 2);
  ctx.fillStyle = color;
  ctx.fillRect(cx - 22, cy - 21, 44, 9);
  ctx.fillRect(cx - 18, cy - 26, 36, 8);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let x = -18; x < 18; x += 8) {
    ctx.fillRect(cx + x + 6, cy - 24, 2, 11);
  }
  ctx.fillStyle = "#170d07";
  ctx.fillRect(cx - 4, cy, 8, 12);
  ctx.fillStyle = "#ffd56a";
  ctx.fillRect(cx - 13, cy - 5, 6, 5);
  ctx.fillRect(cx + 7, cy - 5, 6, 5);
  ctx.fillStyle = "#d6a84f";
  ctx.fillRect(cx + 17, cy - 17, 3, 20);
  ctx.fillRect(cx + 14, cy - 26, 14, 8);
  ctx.fillStyle = "#3d2512";
  ctx.fillRect(cx + 9, cy - 31, 6, 12);
  ctx.fillStyle = "rgba(185,167,122,0.45)";
  ctx.fillRect(cx + 13, cy - 36, 5, 3);
  ctx.fillStyle = "rgba(185,167,122,0.22)";
  ctx.fillRect(cx + 15, cy - 40, 4, 2);
}

function drawVillage(ctx, cx, cy, color) {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(cx - 27, cy + 14, 54, 8);
  ctx.fillStyle = "rgba(126,177,83,0.18)";
  for (let i = -26; i <= 21; i += 7) {
    ctx.fillRect(cx + i, cy + 12, 5, 2);
  }
  drawHut(ctx, cx - 14, cy, 15, 13, color);
  drawHut(ctx, cx + 7, cy + 1, 17, 12, darkenColor(color, 0.12));
  drawHut(ctx, cx - 1, cy - 10, 13, 11, "#8a6b3d");
  ctx.fillStyle = "rgba(214,168,79,0.18)";
  for (let i = 0; i < 4; i += 1) {
    ctx.fillRect(cx + 14 + i * 4, cy + 5 + (i % 2), 2, 10);
  }
  ctx.fillStyle = "#8a6e50";
  for (let i = -22; i <= 20; i += 7) {
    ctx.fillRect(cx + i, cy + 15, 2, 7);
  }
  ctx.fillRect(cx - 24, cy + 17, 50, 2);
  ctx.fillStyle = "#5a5249";
  ctx.fillRect(cx - 5, cy + 8, 10, 5);
  ctx.fillStyle = "#263d57";
  ctx.fillRect(cx - 2, cy + 9, 5, 2);
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
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  ctx.fillRect(x - Math.floor(w / 2) + 2, y - h + 4, w - 5, 2);
}

function drawResourceOnMap(ctx, game, resource) {
  const sx = Math.round(resource.x - game.camera.x);
  const sy = Math.round(resource.y - game.camera.y);
  if (sx < -54 || sy < -54 || sx > game.camera.width + 54 || sy > game.camera.height + 54) return;

  const owned = resource.owner === "player";
  const color = owned ? MINIMAP_ICON_COLORS.playerArrow : "#ffd56a";
  const pulse = Math.sin(Date.now() / 520 + resource.x * 0.01) * 0.5 + 0.5;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(sx - 15, sy + 13, 30, 5);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(sx - 23, sy + 9, 46, 5);
  ctx.fillStyle = owned ? `rgba(50,255,154,${0.08 + pulse * 0.1})` : `rgba(255,213,106,${0.06 + pulse * 0.08})`;
  ctx.fillRect(sx - 20, sy - 18, 40, 34);
  if (resource.kind === "mine") {
    ctx.fillStyle = "#4a4540";
    ctx.fillRect(sx - 15, sy - 3, 30, 16);
    ctx.fillStyle = "#756d62";
    ctx.fillRect(sx - 11, sy - 10, 22, 10);
    ctx.fillStyle = "#211d1a";
    ctx.fillRect(sx - 5, sy + 1, 10, 13);
    ctx.fillStyle = "#9d9488";
    ctx.fillRect(sx - 9, sy - 8, 5, 2);
    ctx.fillRect(sx + 4, sy - 6, 5, 2);
    ctx.fillStyle = color;
    ctx.fillRect(sx - 13, sy - 5, 4, 4);
    ctx.fillRect(sx + 9, sy - 4, 4, 3);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(sx - 12, sy - 4, 2, 1);
    ctx.fillStyle = "#5f3f17";
    ctx.fillRect(sx + 12, sy + 4, 12, 2);
    ctx.fillStyle = "#a88d62";
    ctx.fillRect(sx + 20, sy, 3, 10);
    ctx.fillRect(sx + 17, sy + 1, 8, 2);
  } else {
    ctx.fillStyle = "#7a5a30";
    ctx.fillRect(sx - 16, sy - 6, 32, 20);
    ctx.fillStyle = "#5fa34c";
    for (let i = -14; i <= 12; i += 6) {
      ctx.fillRect(sx + i, sy - 4, 3, 17);
    }
    ctx.fillStyle = color;
    ctx.fillRect(sx - 5, sy - 15, 10, 8);
    ctx.fillStyle = "#8b2f28";
    ctx.fillRect(sx - 2, sy - 12, 4, 5);
    ctx.fillStyle = "rgba(255,226,160,0.18)";
    ctx.fillRect(sx - 14, sy + 8, 28, 2);
    ctx.fillStyle = "#d6a84f";
    for (let i = -13; i <= 11; i += 6) {
      ctx.fillRect(sx + i, sy - 8, 2, 4);
    }
  }
  drawMapNameplate(ctx, resource.name, sx, sy + 20, color, 86);
}

function drawMapNameplate(ctx, text, x, y, color, maxWidth) {
  const label = fitMapLabel(ctx, text, maxWidth, 11);
  ctx.save();
  ctx.font = '800 11px "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const py = Math.round(y);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.86)";
  ctx.strokeText(label, Math.round(x), py + 3);
  ctx.lineWidth = 1;
  ctx.strokeStyle = color;
  ctx.strokeText(label, Math.round(x), py + 3);
  ctx.fillStyle = "#f8e9bd";
  ctx.fillText(label, Math.round(x), py + 3);
  ctx.restore();
}

function fitMapLabel(ctx, text, maxWidth, size) {
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

function drawUnitLayer(ctx, game) {
  for (const npc of game.npcs || []) {
    if (npc.stationed) continue;
    const color = FACTIONS[npc.faction] ? FACTIONS[npc.faction].color : "#b9a77a";
    drawMapParty(ctx, game, npc, color, npc.name, false);
  }
  drawMapParty(ctx, game, game.player, "#ffd56a", "领主", true);

  const destination = getPlayerPathDestination(game.player) || game.player.target;
  if (destination || game.travelDestination) {
    const marker = destination || game.travelDestination;
    const tx = Math.round(marker.x - game.camera.x);
    const ty = Math.round(marker.y - game.camera.y);
    const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(255,213,106,${pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(tx - 7.5, ty - 7.5, 15, 15);
    ctx.fillStyle = `rgba(255,213,106,${pulse * 0.18})`;
    ctx.fillRect(tx - 5, ty - 5, 10, 10);
  }
}

function drawPlayerPath(ctx, game) {
  const player = game.player;
  if (!player || !Array.isArray(player.path) || player.path.length === 0 || !player.target) {
    return;
  }
  const points = [{ x: player.x, y: player.y }];
  const startIndex = Math.max(0, player.pathIndex || 0);
  for (let i = startIndex; i < player.path.length; i += 1) {
    points.push(player.path[i]);
  }

  ctx.save();
  ctx.fillStyle = "rgba(4,7,10,0.72)";
  for (let i = 0; i < points.length - 1; i += 1) {
    drawPathSegment(ctx, game.camera, points[i], points[i + 1], true);
  }
  ctx.fillStyle = "rgba(84,224,255,0.82)";
  for (let i = 0; i < points.length - 1; i += 1) {
    drawPathSegment(ctx, game.camera, points[i], points[i + 1], false);
  }
  ctx.restore();
}

function drawPathSegment(ctx, camera, a, b, outline, customStep, customSize) {
  const ax = a.x - camera.x;
  const ay = a.y - camera.y;
  const bx = b.x - camera.x;
  const by = b.y - camera.y;
  if (!segmentNearView(ax, ay, bx, by, camera)) {
    return;
  }
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return;
  }
  const step = customStep || 11;
  const size = customSize || (outline ? 5 : 3);
  for (let d = 0; d <= length; d += step) {
    if (Math.floor(d / step) % 2 !== 0) {
      continue;
    }
    const t = d / length;
    const x = Math.round(ax + dx * t);
    const y = Math.round(ay + dy * t);
    if (x < -8 || y < -8 || x > camera.width + 8 || y > camera.height + 8) {
      continue;
    }
    ctx.fillRect(x - Math.floor(size / 2), y - Math.floor(size / 2), size, size);
  }
}

function segmentNearView(ax, ay, bx, by, camera) {
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  return maxX >= -24 && minX <= camera.width + 24 && maxY >= -24 && minY <= camera.height + 24;
}

function getPlayerPathDestination(player) {
  if (player && player.pathDestination) {
    return player.pathDestination;
  }
  if (player && Array.isArray(player.path) && player.path.length > 0) {
    return player.path[player.path.length - 1];
  }
  return null;
}

function drawMapParty(ctx, game, unit, color, label, isPlayer) {
  const sx = Math.round(unit.x - game.camera.x);
  const sy = Math.round(unit.y - game.camera.y);
  if (sx < -44 || sy < -44 || sx > game.camera.width + 44 || sy > game.camera.height + 44) return;

  const facing = unit.facing || "down";
  const side = facing === "left" ? -1 : facing === "right" ? 1 : 0;
  const now = Date.now();
  const moving = Date.now() - (unit.lastMoveAt || 0) < 180;
  const gait = moving ? Math.sin(now / 92 + unit.x * 0.04 + unit.y * 0.025) : 0;
  const armSwing = Math.round(gait * 3);
  const legSwing = Math.round(gait * 3);
  const bob = moving ? Math.round(Math.abs(gait) * 2) : 0;
  const wave = Math.round(Math.sin(now / 420 + unit.x) * 1.5);
  const bodyW = facing === "up" ? 14 : facing === "down" ? 16 : 13;
  const bodyX = sx - Math.floor(bodyW / 2);
  const palette = getPartyPalette(unit, color, isPlayer);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.fillRect(sx - 14, sy + 13, 28, 6);

  ctx.fillStyle = "#5f3f17";
  ctx.fillRect(sx - 2 - side * 4, sy - 25 + bob, 2, 26);
  ctx.fillStyle = palette.flag;
  ctx.fillRect(sx + wave - side * 4, sy - 27 + bob, 13, 8);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(sx + wave + 2 - side * 4, sy - 26 + bob, 5, 2);

  drawDirectionCape(ctx, sx, sy, bob, facing, side, palette, isPlayer, gait);
  drawWalkingLegs(ctx, sx, sy, bob, facing, side, legSwing, palette);

  ctx.fillStyle = palette.back;
  ctx.fillRect(sx - 9, sy - 10 + bob, 18, 19);
  ctx.fillStyle = "#1a1008";
  ctx.fillRect(bodyX - 1, sy - 10 + bob, bodyW + 2, 19);
  ctx.fillStyle = palette.body;
  ctx.fillRect(bodyX, sy - 9 + bob, bodyW, 16);
  ctx.fillStyle = facing === "up" ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.12)";
  ctx.fillRect(bodyX + (side > 0 ? bodyW - 5 : 2), sy - 8 + bob, 4, 12);
  ctx.fillStyle = palette.trim;
  ctx.fillRect(bodyX - 1, sy + 1 + bob, bodyW + 2, 2);
  if (facing === "down") {
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(sx - 4, sy - 6 + bob, 8, 9);
    ctx.fillStyle = palette.trim;
    ctx.fillRect(sx - 5, sy - 2 + bob, 10, 2);
  } else if (facing === "up") {
    ctx.fillStyle = palette.back;
    ctx.fillRect(sx - 6, sy - 8 + bob, 12, 13);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(sx - 4, sy - 2 + bob, 8, 2);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(sx + side * 2 - (side < 0 ? 5 : 0), sy - 7 + bob, 5, 10);
  }

  drawWalkingArms(ctx, sx, sy, bob, facing, side, armSwing, palette);

  ctx.fillStyle = "#d9c2a0";
  ctx.fillRect(sx - 5 + side * 2, sy - 17 + bob, 10, 9);
  ctx.fillStyle = palette.helm;
  if (facing === "up") {
    ctx.fillRect(sx - 7, sy - 22 + bob, 14, 8);
    ctx.fillRect(sx - 5, sy - 25 + bob, 10, 4);
  } else if (side !== 0) {
    ctx.fillRect(sx - 7 + side * 2, sy - 22 + bob, 14, 8);
    ctx.fillRect(sx - 5 + side * 2, sy - 25 + bob, 10, 4);
    ctx.fillStyle = palette.trim;
    ctx.fillRect(sx + side * 3, sy - 23 + bob, side * 7, 2);
  } else {
    ctx.fillRect(sx - 7, sy - 22 + bob, 14, 8);
    ctx.fillRect(sx - 5, sy - 25 + bob, 10, 4);
    ctx.fillStyle = palette.trim;
    ctx.fillRect(sx - 5, sy - 23 + bob, 10, 2);
  }
  ctx.fillStyle = "#0a0603";
  if (facing === "up") {
    ctx.fillRect(sx - 4, sy - 20 + bob, 8, 2);
  } else if (side !== 0) {
    ctx.fillRect(sx + side * 3, sy - 16 + bob, 2, 2);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(sx - side, sy - 17 + bob, side * 5, 1);
  } else {
    ctx.fillRect(sx - 3, sy - 16 + bob, 2, 2);
    ctx.fillRect(sx + 2, sy - 16 + bob, 2, 2);
    ctx.fillStyle = "#7f2f27";
    ctx.fillRect(sx - 2, sy - 12 + bob, 4, 1);
  }

  drawDirectionAccent(ctx, sx, sy, bob, facing, side, palette, isPlayer);

  drawPixelText(ctx, label, sx, sy + 18, isPlayer ? "#ffd56a" : "#f8e9bd", isPlayer ? 11 : 10, "center");
  ctx.restore();
}

function getPartyPalette(unit, color, isPlayer) {
  if (isPlayer) {
    return {
      body: "#d6a84f",
      back: "#7f2f27",
      cape: "#25d878",
      capeDark: "#0f6c43",
      helm: "#ffd56a",
      trim: MINIMAP_ICON_COLORS.playerArrow,
      flag: MINIMAP_ICON_COLORS.playerArrow
    };
  }
  if (unit.faction === "wild") {
    return {
      body: "#4f6f32",
      back: "#23351f",
      cape: "#1b331d",
      capeDark: "#102012",
      helm: "#62784a",
      trim: "#a0f403",
      flag: "#7b8f44"
    };
  }
  if (unit.faction === "neutral") {
    return {
      body: "#b9a77a",
      back: "#5f4326",
      cape: "#6d4c2a",
      capeDark: "#3d2919",
      helm: "#8d7850",
      trim: "#f8e9bd",
      flag: "#b9a77a"
    };
  }
  return {
    body: color,
    back: darkenColor(color, 0.42),
    cape: darkenColor(color, 0.32),
    capeDark: darkenColor(color, 0.56),
    helm: darkenColor(color, 0.16),
    trim: "#f8e9bd",
    flag: color
  };
}

function drawDirectionCape(ctx, sx, sy, bob, facing, side, palette, isPlayer, gait) {
  const sway = Math.round(gait * 2);
  const cape = isPlayer ? "#25d878" : palette.cape;
  const capeDark = isPlayer ? "#0f6c43" : palette.capeDark;
  const trim = isPlayer ? "#8affc1" : palette.trim;
  ctx.fillStyle = cape;
  if (facing === "up") {
    ctx.fillRect(sx - 8, sy - 10 + bob, 16, 18);
    ctx.fillStyle = capeDark;
    ctx.fillRect(sx - 5, sy + 3 + bob, 10, 5);
    ctx.fillStyle = trim;
    ctx.fillRect(sx - 6, sy - 10 + bob, 12, 2);
  } else if (facing === "down") {
    ctx.fillRect(sx - 10, sy - 9 + bob, 5, 14);
    ctx.fillRect(sx + 5, sy - 9 + bob, 5, 14);
    ctx.fillStyle = trim;
    ctx.fillRect(sx - 9, sy - 9 + bob, 3, 2);
    ctx.fillRect(sx + 6, sy - 9 + bob, 3, 2);
  } else if (side > 0) {
    ctx.fillRect(sx - 13 - sway, sy - 10 + bob, 8, 18);
    ctx.fillRect(sx - 17 - sway, sy - 5 + bob, 5, 12);
    ctx.fillStyle = capeDark;
    ctx.fillRect(sx - 15 - sway, sy + 4 + bob, 8, 5);
    ctx.fillStyle = trim;
    ctx.fillRect(sx - 12 - sway, sy - 10 + bob, 2, 15);
  } else {
    ctx.fillRect(sx + 5 - sway, sy - 10 + bob, 8, 18);
    ctx.fillRect(sx + 12 - sway, sy - 5 + bob, 5, 12);
    ctx.fillStyle = capeDark;
    ctx.fillRect(sx + 7 - sway, sy + 4 + bob, 8, 5);
    ctx.fillStyle = trim;
    ctx.fillRect(sx + 10 - sway, sy - 10 + bob, 2, 15);
  }
}

function drawWalkingLegs(ctx, sx, sy, bob, facing, side, swing, palette) {
  const leftStep = clampNumber(swing, -2, 3);
  const rightStep = clampNumber(-swing, -2, 3);
  const pants = darkenColor(palette.body, 0.48);
  ctx.fillStyle = pants;
  ctx.fillRect(sx - 6, sy + 4 + bob, 4, 9 + leftStep);
  ctx.fillRect(sx + 2, sy + 4 + bob, 4, 9 + rightStep);
  ctx.fillStyle = "#1b120a";
  if (side !== 0) {
    drawDirectionalRect(ctx, sx - 5 + side * Math.max(0, leftStep), sy + 13 + bob + leftStep, 7, 3, side);
    drawDirectionalRect(ctx, sx + 3 + side * Math.max(0, rightStep), sy + 13 + bob + rightStep, 7, 3, side);
  } else {
    ctx.fillRect(sx - 7, sy + 13 + leftStep + bob, 6, 3);
    ctx.fillRect(sx + 1, sy + 13 + rightStep + bob, 6, 3);
  }
  if (facing === "up") {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(sx - 5, sy + 5 + bob, 10, 2);
  }
}

function drawWalkingArms(ctx, sx, sy, bob, facing, side, swing, palette) {
  const sleeve = darkenColor(palette.body, 0.16);
  const hand = "#d9c2a0";
  ctx.fillStyle = sleeve;
  if (side !== 0) {
    const frontY = sy - 5 + bob + swing;
    const backY = sy - 5 + bob - swing;
    drawDirectionalRect(ctx, sx + side * 6, frontY, 5, 9, side);
    drawDirectionalRect(ctx, sx - side * 5, backY, 4, 9, -side);
    ctx.fillStyle = hand;
    drawDirectionalRect(ctx, sx + side * 10, frontY + 8, 3, 3, side);
    drawDirectionalRect(ctx, sx - side * 8, backY + 8, 3, 3, -side);
    return;
  }
  ctx.fillRect(sx - 10, sy - 6 + bob + swing, 4, 11);
  ctx.fillRect(sx + 6, sy - 6 + bob - swing, 4, 11);
  ctx.fillStyle = hand;
  ctx.fillRect(sx - 10, sy + 4 + bob + swing, 4, 3);
  ctx.fillRect(sx + 6, sy + 4 + bob - swing, 4, 3);
}

function drawDirectionalRect(ctx, x, y, w, h, side) {
  if (side < 0) {
    ctx.fillRect(Math.round(x - w), Math.round(y), w, h);
  } else {
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawDirectionAccent(ctx, sx, sy, bob, facing, side, palette, isPlayer) {
  ctx.fillStyle = isPlayer ? MINIMAP_ICON_COLORS.playerArrow : palette.trim;
  if (facing === "up") {
    ctx.fillRect(sx - 2, sy - 29 + bob, 4, 3);
    ctx.fillRect(sx - 1, sy - 31 + bob, 2, 2);
  } else if (facing === "down") {
    ctx.fillRect(sx - 4, sy - 24 + bob, 8, 2);
    ctx.fillRect(sx - 6, sy - 8 + bob, 3, 11);
    ctx.fillRect(sx + 3, sy - 8 + bob, 3, 11);
  } else {
    ctx.fillRect(sx + side * 8 - (side < 0 ? 3 : 0), sy - 19 + bob, 3, 4);
    ctx.fillRect(sx + side * 6 - (side < 0 ? 6 : 0), sy - 8 + bob, 6, 3);
  }
}

function getMiniTerrainColor(id) {
  if (id === TERRAIN.water.id) return "#337ba3";
  if (id === TERRAIN.mountain.id) return "#7593a0";
  if (id === TERRAIN.road.id) return "#c19152";
  if (id === TERRAIN.forest.id) return "#43823d";
  if (id === TERRAIN.hill.id) return "#9a854d";
  return "#65a447";
}

function getMapCacheKey(map) {
  return `${map.cols}:${map.rows}:${map.width}:${map.height}:${map.tilesVersion || 0}`;
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

