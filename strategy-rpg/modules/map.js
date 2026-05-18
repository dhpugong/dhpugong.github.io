import { CONFIG, RESOURCE_TEMPLATES, TELEPORTER_TEMPLATES, TERRAIN, TOWN_TEMPLATES } from "./config.js";
import { applyRandomGeneralAttributes } from "./generals.js";
import { deepClone, distanceXY, rand, randInt } from "./utils.js";

const terrainList = [
  TERRAIN.grass,
  TERRAIN.water,
  TERRAIN.mountain,
  TERRAIN.road,
  TERRAIN.forest,
  TERRAIN.hill
];

// 创建大地图：二维数组保存 tile 数据，并用确定性噪声生成 6000+ 像素级大陆。
export function createWorldMap() {
  const tiles = [];
  const cols = CONFIG.mapCols;
  const rows = CONFIG.mapRows;

  for (let y = 0; y < rows; y += 1) {
    const row = [];
    for (let x = 0; x < cols; x += 1) {
      const edge = Math.min(x, y, cols - x - 1, rows - y - 1);
      let terrain = chooseTerrain(x, y, edge, cols, rows);

      row.push(terrain);
    }
    tiles.push(row);
  }

  carveRiver(tiles, 17, 8, 171, 182, 2);
  carveRiver(tiles, 180, 32, 30, 156, 1);
  carveLake(tiles, 128, 52, 10, 7);
  carveLake(tiles, 62, 142, 12, 8);

  const roadNodes = getRoadNodes();
  for (let i = 0; i < roadNodes.length - 1; i += 1) {
    carveRoad(tiles, roadNodes[i].x, roadNodes[i].y, roadNodes[i + 1].x, roadNodes[i + 1].y);
  }
  carveRoad(tiles, 20, 16, 38, 26);
  carveRoad(tiles, 54, 38, 91, 26);
  carveRoad(tiles, 91, 26, 141, 31);
  carveRoad(tiles, 83, 69, 40, 99);
  carveRoad(tiles, 118, 91, 159, 122);
  carveRoad(tiles, 78, 149, 156, 166);
  carveSafeArea(tiles, 13, 13, 4);
  carveRoad(tiles, 13, 13, 20, 16);

  // 让城池周围总是可通行，避免交互点刷在水里或山上。
  for (const point of [...TOWN_TEMPLATES, ...RESOURCE_TEMPLATES, ...TELEPORTER_TEMPLATES]) {
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
    mapData: tiles,
    tilesVersion: 2,
    towns: deepClone(TOWN_TEMPLATES).map((town) => {
      applyRandomGeneralAttributes(town.general);
      return town;
    }),
    resources: deepClone(RESOURCE_TEMPLATES),
    teleporters: deepClone(TELEPORTER_TEMPLATES),
    decorations: createDecorations(cols, rows, tiles)
  };
}

function chooseTerrain(x, y, edge, cols, rows) {
  const nx = x / cols - 0.5;
  const ny = y / rows - 0.5;
  const continent = 1 - Math.hypot(nx * 1.24, ny * 1.08);
  const ridge = Math.sin((x + y * 0.72) * 0.095) + Math.cos((x * 0.45 - y) * 0.12);
  const broad = valueNoise(x, y, 0.035, 41) * 0.68 + valueNoise(x, y, 0.082, 73) * 0.32;
  const detail = valueNoise(x, y, 0.21, 117);
  const basin = Math.sin(x * 0.055) * Math.cos(y * 0.048);

  if (edge < 2 || continent + broad * 0.2 < 0.36) {
    return TERRAIN.water.id;
  }
  if (edge < 5 && continent < 0.58) {
    return detail > 0.52 ? TERRAIN.water.id : TERRAIN.mountain.id;
  }
  if (ridge + broad * 1.8 > 2.05 || broad > 0.82 || (x > 142 && y < 58 && ridge > 1.18)) {
    return TERRAIN.mountain.id;
  }
  if (basin < -0.72 && broad < 0.45) {
    return TERRAIN.water.id;
  }
  if (broad > 0.58 || ridge > 1.1) {
    return TERRAIN.hill.id;
  }
  if (detail < 0.18 || (broad < 0.34 && ridge < -0.05 && detail < 0.32)) {
    return TERRAIN.forest.id;
  }
  return TERRAIN.grass.id;
}

function valueNoise(x, y, scale, seed) {
  const x0 = Math.floor(x * scale);
  const y0 = Math.floor(y * scale);
  const fx = smoothStep(x * scale - x0);
  const fy = smoothStep(y * scale - y0);
  const a = hashNoise(x0, y0, seed);
  const b = hashNoise(x0 + 1, y0, seed);
  const c = hashNoise(x0, y0 + 1, seed);
  const d = hashNoise(x0 + 1, y0 + 1, seed);
  return lerpNoise(lerpNoise(a, b, fx), lerpNoise(c, d, fx), fy);
}

function hashNoise(x, y, seed) {
  let n = x * 374761393 + y * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function lerpNoise(a, b, t) {
  return a + (b - a) * t;
}

function getRoadNodes() {
  return [
    { x: 13, y: 13 },
    { x: 20, y: 16 },
    { x: 38, y: 26 },
    { x: 54, y: 38 },
    { x: 83, y: 69 },
    { x: 118, y: 91 },
    { x: 159, y: 122 },
    { x: 171, y: 166 }
  ];
}

function carveRoad(tiles, sx, sy, ex, ey) {
  let x = sx;
  let y = sy;
  let guard = 0;
  while (x !== ex || y !== ey) {
    carveRoadCell(tiles, x, y);
    if (x !== ex && (y === ey || Math.abs(ex - x) >= Math.abs(ey - y) || pseudoBool(x, y, ex + ey))) {
      x += Math.sign(ex - x);
    } else if (y !== ey) {
      y += Math.sign(ey - y);
    }
    if (pseudoBool(x, y, sx + sy) && x !== ex && y !== ey) {
      if (Math.abs(ex - x) > Math.abs(ey - y)) {
        y += Math.sign(ey - y);
      } else {
        x += Math.sign(ex - x);
      }
    }
    carveRoadCell(tiles, x, y);
    guard += 1;
    if (guard > 1200) break;
  }
}

function carveRoadCell(tiles, x, y) {
  setTile(tiles, x, y, TERRAIN.road.id);
  if (pseudoBool(x, y, 19)) {
    setTile(tiles, x + 1, y, TERRAIN.road.id);
  }
  if (pseudoBool(x, y, 23)) {
    setTile(tiles, x, y + 1, TERRAIN.road.id);
  }
}

function carveRiver(tiles, sx, sy, ex, ey, radius) {
  let x = sx;
  let y = sy;
  let guard = 0;
  while (x !== ex || y !== ey) {
    carveBlob(tiles, x, y, radius, TERRAIN.water.id);
    const bend = Math.sin((x + y) * 0.17) + valueNoise(x, y, 0.12, 311) - 0.5;
    if (x !== ex && (Math.abs(ex - x) > Math.abs(ey - y) || bend > 0.1)) {
      x += Math.sign(ex - x);
    }
    if (y !== ey && (Math.abs(ey - y) >= Math.abs(ex - x) || bend < 0.45)) {
      y += Math.sign(ey - y);
    }
    guard += 1;
    if (guard > 1400) break;
  }
}

function carveLake(tiles, cx, cy, rx, ry) {
  for (let y = cy - ry - 2; y <= cy + ry + 2; y += 1) {
    for (let x = cx - rx - 2; x <= cx + rx + 2; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const noise = valueNoise(x, y, 0.2, 503) * 0.22;
      if (dx * dx + dy * dy < 1 + noise) {
        setTile(tiles, x, y, TERRAIN.water.id);
      }
    }
  }
}

function carveBlob(tiles, cx, cy, radius, id) {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (distanceXY(cx, cy, x, y) <= radius + valueNoise(x, y, 0.31, 211)) {
        setTile(tiles, x, y, id);
      }
    }
  }
}

function pseudoBool(x, y, seed) {
  return hashNoise(x, y, seed) > 0.5;
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
  for (let i = 0; i < 1300; i += 1) {
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

export function findNearestTeleporter(map, x, y, maxDistance = Infinity) {
  let best = null;
  let bestDistance = maxDistance;
  for (const teleporter of map.teleporters || []) {
    const d = distanceXY(x, y, teleporter.x, teleporter.y);
    if (d < bestDistance) {
      best = teleporter;
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
