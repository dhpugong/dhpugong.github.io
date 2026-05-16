import { CONFIG, RESOURCE_TEMPLATES, TERRAIN, TOWN_TEMPLATES } from "./config.js";
import { applyRandomGeneralAttributes } from "./generals.js";
import { deepClone, distanceXY, rand, randInt } from "./utils.js";

const terrainList = [
  TERRAIN.grass,
  TERRAIN.forest,
  TERRAIN.hill,
  TERRAIN.mountain,
  TERRAIN.water,
  TERRAIN.road
];

// 创建大地图：使用确定性三角函数混合，让静态项目也能拥有稳定的大陆形状。
export function createWorldMap() {
  const tiles = [];
  const cols = CONFIG.mapCols;
  const rows = CONFIG.mapRows;

  for (let y = 0; y < rows; y += 1) {
    const row = [];
    for (let x = 0; x < cols; x += 1) {
      const edge = Math.min(x, y, cols - x - 1, rows - y - 1);
      const wave = Math.sin(x * 0.31) + Math.cos(y * 0.27) + Math.sin((x + y) * 0.13);
      let terrain = TERRAIN.grass.id;

      if (edge < 2 || wave < -1.72 || wave > 1.62) {
        terrain = TERRAIN.mountain.id;
      } else if (wave > 0.94) {
        terrain = TERRAIN.hill.id;
      } else if (wave < -0.48) {
        terrain = TERRAIN.forest.id;
      }

      row.push(terrain);
    }
    tiles.push(row);
  }

  carveRoad(tiles, 8, 11, 94, 52);
  carveRoad(tiles, 20, 39, 96, 7);
  carveRoad(tiles, 12, 16, 104, 48);
  carveRoad(tiles, 54, 16, 104, 32);
  carveSafeArea(tiles, 13, 11, 3);
  carveRoad(tiles, 13, 11, 18, 14);

  // 让城池周围总是可通行，避免交互点刷在水里或山上。
  for (const point of [...TOWN_TEMPLATES, ...RESOURCE_TEMPLATES]) {
    carveSafeArea(
      tiles,
      Math.floor(point.x / CONFIG.tileSize),
      Math.floor(point.y / CONFIG.tileSize),
      1
    );
  }

  return {
    cols,
    rows,
    width: cols * CONFIG.tileSize,
    height: rows * CONFIG.tileSize,
    tiles,
    towns: deepClone(TOWN_TEMPLATES).map((town) => {
      applyRandomGeneralAttributes(town.general);
      return town;
    }),
    resources: deepClone(RESOURCE_TEMPLATES),
    decorations: createDecorations(cols, rows, tiles)
  };
}

function carveRoad(tiles, sx, sy, ex, ey) {
  let x = sx;
  let y = sy;
  while (x !== ex || y !== ey) {
    setTile(tiles, x, y, TERRAIN.road.id);
    if (Math.random() > 0.35 && x !== ex) {
      x += Math.sign(ex - x);
    } else if (y !== ey) {
      y += Math.sign(ey - y);
    }
    setTile(tiles, x, y, TERRAIN.road.id);
  }
}

function setTile(tiles, x, y, id) {
  if (tiles[y] && typeof tiles[y][x] === "number") {
    tiles[y][x] = id;
  }
}

function carveSafeArea(tiles, cx, cy, radius) {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      setTile(tiles, x, y, TERRAIN.grass.id);
    }
  }
}

function createDecorations(cols, rows, tiles) {
  const decorations = [];
  for (let i = 0; i < 260; i += 1) {
    const x = randInt(2, cols - 3);
    const y = randInt(2, rows - 3);
    const terrain = getTerrainById(tiles[y][x]);
    if (terrain.passable && terrain.id !== TERRAIN.road.id) {
      decorations.push({
        x: x * CONFIG.tileSize + rand(4, 26),
        y: y * CONFIG.tileSize + rand(4, 26),
        type: terrain.id === TERRAIN.forest.id ? "tree" : "stone",
        tint: rand(0.8, 1.2)
      });
    }
  }
  return decorations;
}

export function getTerrainById(id) {
  return terrainList.find((terrain) => terrain.id === id) || TERRAIN.grass;
}

export function getTile(map, worldX, worldY) {
  const tx = Math.floor(worldX / CONFIG.tileSize);
  const ty = Math.floor(worldY / CONFIG.tileSize);
  if (!map.tiles[ty] || typeof map.tiles[ty][tx] !== "number") {
    return TERRAIN.mountain;
  }
  return getTerrainById(map.tiles[ty][tx]);
}

export function isPassable(map, worldX, worldY) {
  return getTile(map, worldX, worldY).passable;
}

export function ensurePassablePosition(map, entity) {
  if (isPassable(map, entity.x, entity.y)) {
    return false;
  }

  const fixed = findNearestPassablePosition(map, entity.x, entity.y);
  entity.x = fixed.x;
  entity.y = fixed.y;
  entity.target = null;
  return true;
}

export function findNearestPassablePosition(map, worldX, worldY) {
  const originCol = Math.floor(worldX / CONFIG.tileSize);
  const originRow = Math.floor(worldY / CONFIG.tileSize);

  for (let radius = 0; radius < Math.max(map.cols, map.rows); radius += 1) {
    for (let row = originRow - radius; row <= originRow + radius; row += 1) {
      for (let col = originCol - radius; col <= originCol + radius; col += 1) {
        const onRing = row === originRow - radius || row === originRow + radius || col === originCol - radius || col === originCol + radius;
        if (!onRing) continue;

        const x = col * CONFIG.tileSize + CONFIG.tileSize / 2;
        const y = row * CONFIG.tileSize + CONFIG.tileSize / 2;
        if (isPassable(map, x, y)) {
          return { x, y };
        }
      }
    }
  }

  return findOpenPosition(map);
}

export function findSafeStep(map, fromX, fromY, toX, toY) {
  if (isPassable(map, toX, toY)) {
    return { x: toX, y: toY };
  }

  const dx = toX - fromX;
  const dy = toY - fromY;
  const candidates = [
    { x: fromX + dx, y: fromY },
    { x: fromX, y: fromY + dy },
    { x: fromX + dx * 0.5, y: fromY + dy * 0.5 },
    { x: fromX, y: fromY }
  ];

  for (const point of candidates) {
    if (isPassable(map, point.x, point.y)) {
      return point;
    }
  }

  return findNearestPassablePosition(map, fromX, fromY);
}

export function clampToMap(map, entity) {
  entity.x = Math.max(12, Math.min(map.width - 12, entity.x));
  entity.y = Math.max(12, Math.min(map.height - 12, entity.y));
}

export function findNearestTown(map, x, y, maxDistance = Infinity) {
  let best = null;
  let bestDistance = maxDistance;
  for (const town of map.towns) {
    const d = distanceXY(x, y, town.x, town.y);
    if (d < bestDistance) {
      best = town;
      bestDistance = d;
    }
  }
  return best;
}

export function findNearestResource(map, x, y, maxDistance = Infinity) {
  let best = null;
  let bestDistance = maxDistance;
  for (const resource of map.resources || []) {
    const d = distanceXY(x, y, resource.x, resource.y);
    if (d < bestDistance) {
      best = resource;
      bestDistance = d;
    }
  }
  return best;
}

export function findOpenPosition(map) {
  for (let tries = 0; tries < 400; tries += 1) {
    const x = rand(120, map.width - 120);
    const y = rand(120, map.height - 120);
    if (isPassable(map, x, y) && !findNearestTown(map, x, y, 90)) {
      return { x, y };
    }
  }
  return { x: 420, y: 420 };
}
