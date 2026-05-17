import { CONFIG } from "../modules/config.js";

const FOG_UNKNOWN = 0;
const FOG_EXPLORED = 1;
const FOG_VISIBLE = 2;
const FOG_UPDATE_RADIUS = 6;
const FOG_REVEAL_RADIUS = 5;

export function createFogOfWar(map) {
  const cells = new Uint8Array(map.cols * map.rows);
  const canvas = createCanvas(map.cols, map.rows);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return {
    cols: map.cols,
    rows: map.rows,
    cells,
    canvas,
    ctx,
    lastCol: -999,
    lastRow: -999,
    exploredCount: 0,
    dirty: true,
    version: 0
  };
}

export function serializeFogOfWar(fog) {
  if (!fog || !fog.cells) {
    return null;
  }
  return {
    cols: fog.cols,
    rows: fog.rows,
    cells: Array.from(fog.cells)
  };
}

export function restoreFogOfWar(map, savedFog, player) {
  const fog = createFogOfWar(map);
  if (!savedFog || savedFog.cols !== map.cols || savedFog.rows !== map.rows || !Array.isArray(savedFog.cells)) {
    updateFogOfWar(fog, map, player, true);
    return fog;
  }

  const count = Math.min(fog.cells.length, savedFog.cells.length);
  for (let i = 0; i < count; i += 1) {
    const state = Number(savedFog.cells[i]) || FOG_UNKNOWN;
    fog.cells[i] = state === FOG_VISIBLE ? FOG_EXPLORED : Math.max(FOG_UNKNOWN, Math.min(FOG_EXPLORED, state));
  }
  fog.exploredCount = countDiscoveredCells(fog);
  updateFogCanvasRegion(fog, 0, 0, map.cols - 1, map.rows - 1);
  updateFogOfWar(fog, map, player, true);
  return fog;
}

export function resetFogOfWar(game) {
  game.fog = createFogOfWar(game.map);
  updateFogOfWar(game.fog, game.map, game.player, true);
}

export function updateFogOfWar(fog, map, player, force = false) {
  if (!fog || !player) {
    return false;
  }
  if (fog.cols !== map.cols || fog.rows !== map.rows) {
    return false;
  }
  if (typeof fog.exploredCount !== "number") {
    fog.exploredCount = countDiscoveredCells(fog);
  }

  const col = Math.floor(player.x / CONFIG.tileSize);
  const row = Math.floor(player.y / CONFIG.tileSize);
  if (!force && col === fog.lastCol && row === fog.lastRow) {
    return false;
  }

  const prevCol = fog.lastCol;
  const prevRow = fog.lastRow;
  fog.lastCol = col;
  fog.lastRow = row;

  const minCol = Math.max(0, Math.min(prevCol, col) - FOG_UPDATE_RADIUS - 1);
  const maxCol = Math.min(map.cols - 1, Math.max(prevCol, col) + FOG_UPDATE_RADIUS + 1);
  const minRow = Math.max(0, Math.min(prevRow, row) - FOG_UPDATE_RADIUS - 1);
  const maxRow = Math.min(map.rows - 1, Math.max(prevRow, row) + FOG_UPDATE_RADIUS + 1);

  for (let y = minRow; y <= maxRow; y += 1) {
    for (let x = minCol; x <= maxCol; x += 1) {
      const index = y * map.cols + x;
      if (fog.cells[index] === FOG_VISIBLE) {
        fog.cells[index] = FOG_EXPLORED;
      }
    }
  }

  const revealMinCol = Math.max(0, col - FOG_REVEAL_RADIUS);
  const revealMaxCol = Math.min(map.cols - 1, col + FOG_REVEAL_RADIUS);
  const revealMinRow = Math.max(0, row - FOG_REVEAL_RADIUS);
  const revealMaxRow = Math.min(map.rows - 1, row + FOG_REVEAL_RADIUS);

  for (let y = revealMinRow; y <= revealMaxRow; y += 1) {
    for (let x = revealMinCol; x <= revealMaxCol; x += 1) {
      const dx = x - col;
      const dy = y - row;
      const distance = Math.hypot(dx, dy);
      if (distance <= FOG_REVEAL_RADIUS + 0.35) {
        const index = y * map.cols + x;
        if (fog.cells[index] === FOG_UNKNOWN) {
          fog.exploredCount += 1;
        }
        fog.cells[index] = FOG_VISIBLE;
      }
    }
  }

  updateFogCanvasRegion(fog, minCol, minRow, maxCol, maxRow);
  updateFogCanvasRegion(fog, revealMinCol, revealMinRow, revealMaxCol, revealMaxRow);
  fog.dirty = true;
  fog.version += 1;
  return true;
}

export function drawFogOfWar(ctx, fog, camera) {
  if (!fog || !fog.canvas) {
    return;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    fog.canvas,
    camera.x / CONFIG.tileSize,
    camera.y / CONFIG.tileSize,
    camera.width / CONFIG.tileSize,
    camera.height / CONFIG.tileSize,
    0,
    0,
    camera.width,
    camera.height
  );
  ctx.restore();
}

export function getFogState(fog, worldX, worldY) {
  if (!fog) {
    return FOG_VISIBLE;
  }
  const col = Math.floor(worldX / CONFIG.tileSize);
  const row = Math.floor(worldY / CONFIG.tileSize);
  if (col < 0 || row < 0 || col >= fog.cols || row >= fog.rows) {
    return FOG_UNKNOWN;
  }
  return fog.cells[row * fog.cols + col];
}

export function isWorldPointDiscovered(fog, worldX, worldY) {
  return getFogState(fog, worldX, worldY) > FOG_UNKNOWN;
}

function countDiscoveredCells(fog) {
  let count = 0;
  for (let i = 0; i < fog.cells.length; i += 1) {
    if (fog.cells[i] > FOG_UNKNOWN) {
      count += 1;
    }
  }
  return count;
}

function updateFogCanvasRegion(fog, minCol, minRow, maxCol, maxRow) {
  const width = Math.max(0, maxCol - minCol + 1);
  const height = Math.max(0, maxRow - minRow + 1);
  if (!width || !height) {
    return;
  }
  const image = fog.ctx.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const state = fog.cells[(minRow + y) * fog.cols + minCol + x];
      const p = (y * width + x) * 4;
      image.data[p] = 0;
      image.data[p + 1] = 0;
      image.data[p + 2] = 0;
      image.data[p + 3] = state === FOG_UNKNOWN ? 255 : 0;
    }
  }
  fog.ctx.putImageData(image, minCol, minRow);
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export const FOG_STATES = {
  unknown: FOG_UNKNOWN,
  explored: FOG_EXPLORED,
  visible: FOG_VISIBLE
};
