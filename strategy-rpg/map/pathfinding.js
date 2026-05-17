import { CONFIG, TERRAIN } from "../modules/config.js";
import { getTerrainById } from "../modules/map.js";

const DIRS_4 = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 }
];

export function clearUnitPath(unit) {
  unit.path = null;
  unit.pathIndex = 0;
  unit.pathDestination = null;
  unit.pathMode = null;
  unit.pathAdjusted = false;
  unit.pathUsesRoads = false;
  unit.target = null;
}

export function assignUnitPath(unit, result, mode = "road") {
  if (!result || !Array.isArray(result.path) || result.path.length === 0) {
    clearUnitPath(unit);
    return false;
  }
  unit.path = result.path.slice();
  unit.pathIndex = 0;
  unit.pathDestination = unit.path[unit.path.length - 1];
  unit.pathMode = mode;
  unit.pathAdjusted = Boolean(result.adjusted);
  unit.pathUsesRoads = Boolean(result.usedRoads);
  unit.target = unit.path[0];
  return true;
}

export function getUnitPathDestination(unit) {
  if (unit && unit.pathDestination) {
    return unit.pathDestination;
  }
  if (unit && Array.isArray(unit.path) && unit.path.length > 0) {
    return unit.path[unit.path.length - 1];
  }
  return null;
}

export function buildRoadPreferredPath(map, from, to) {
  const startTile = worldToTile(map, from.x, from.y);
  const rawTargetTile = worldToTile(map, to.x, to.y);
  const targetTile = isTilePassable(map, rawTargetTile.col, rawTargetTile.row)
    ? rawTargetTile
    : findNearestTile(map, rawTargetTile, (tile) => isTilePassable(map, tile.col, tile.row));

  if (!targetTile || !isTilePassable(map, startTile.col, startTile.row)) {
    return createEmptyResult(to, true);
  }

  const startRoad = findNearestTile(map, startTile, (tile) => isRoadTile(map, tile.col, tile.row));
  const targetRoad = findNearestTile(map, targetTile, (tile) => isRoadTile(map, tile.col, tile.row));
  let tilePath = null;
  let usedRoads = false;

  if (startRoad && targetRoad) {
    const legToRoad = findTilePath(map, startTile, startRoad, { roadOnly: false });
    const roadLeg = findTilePath(map, startRoad, targetRoad, { roadOnly: true });
    const legFromRoad = findTilePath(map, targetRoad, targetTile, { roadOnly: false });
    if (legToRoad && roadLeg && legFromRoad) {
      tilePath = joinTilePaths([legToRoad, roadLeg, legFromRoad]);
      usedRoads = roadLeg.length > 2;
    }
  }

  if (!tilePath) {
    tilePath = findTilePath(map, startTile, targetTile, { roadOnly: false });
  }

  if (!tilePath) {
    return createEmptyResult(tileToWorld(targetTile), rawTargetTile !== targetTile);
  }

  const compressed = compressTilePath(tilePath);
  const worldPath = compressed.map(tileToWorld);
  pruneInitialPoint(worldPath, from);

  return {
    path: worldPath,
    adjustedTarget: tileToWorld(targetTile),
    adjusted: rawTargetTile.col !== targetTile.col || rawTargetTile.row !== targetTile.row,
    usedRoads,
    partial: false
  };
}

export function worldToTile(map, x, y) {
  return {
    col: clampInt(Math.floor(x / CONFIG.tileSize), 0, map.cols - 1),
    row: clampInt(Math.floor(y / CONFIG.tileSize), 0, map.rows - 1)
  };
}

export function tileToWorld(tile) {
  return {
    x: tile.col * CONFIG.tileSize + CONFIG.tileSize / 2,
    y: tile.row * CONFIG.tileSize + CONFIG.tileSize / 2
  };
}

function createEmptyResult(target, adjusted) {
  return {
    path: [],
    adjustedTarget: target,
    adjusted: Boolean(adjusted),
    usedRoads: false,
    partial: true
  };
}

function isTileInside(map, col, row) {
  return row >= 0 && col >= 0 && row < map.rows && col < map.cols;
}

function isTilePassable(map, col, row) {
  if (!isTileInside(map, col, row)) {
    return false;
  }
  return getTerrainById(map.tiles[row][col]).passable;
}

function isRoadTile(map, col, row) {
  return isTileInside(map, col, row) && map.tiles[row][col] === TERRAIN.road.id;
}

function findNearestTile(map, origin, predicate) {
  const maxRadius = Math.max(map.cols, map.rows);
  for (let radius = 0; radius < maxRadius; radius += 1) {
    for (let row = origin.row - radius; row <= origin.row + radius; row += 1) {
      for (let col = origin.col - radius; col <= origin.col + radius; col += 1) {
        const onRing = row === origin.row - radius || row === origin.row + radius || col === origin.col - radius || col === origin.col + radius;
        if (!onRing || !isTileInside(map, col, row)) {
          continue;
        }
        const tile = { col, row };
        if (predicate(tile)) {
          return tile;
        }
      }
    }
  }
  return null;
}

function findTilePath(map, start, goal, options) {
  if (sameTile(start, goal)) {
    return [start];
  }

  const roadOnly = Boolean(options && options.roadOnly);
  const total = map.cols * map.rows;
  const gScore = new Float32Array(total);
  const cameFrom = new Int32Array(total);
  const closed = new Uint8Array(total);
  gScore.fill(Infinity);
  cameFrom.fill(-1);

  const startIndex = tileIndex(map, start);
  const goalIndex = tileIndex(map, goal);
  const open = new BinaryHeap();
  gScore[startIndex] = 0;
  open.push({ index: startIndex, tile: start, f: heuristic(start, goal) });

  while (open.size > 0) {
    const current = open.pop();
    if (closed[current.index]) {
      continue;
    }
    if (current.index === goalIndex) {
      return reconstructPath(map, cameFrom, current.index);
    }
    closed[current.index] = 1;

    for (const dir of DIRS_4) {
      const next = { col: current.tile.col + dir.dc, row: current.tile.row + dir.dr };
      if (!isTileInside(map, next.col, next.row)) {
        continue;
      }
      if (roadOnly ? !isRoadTile(map, next.col, next.row) : !isTilePassable(map, next.col, next.row)) {
        continue;
      }
      const nextIndex = tileIndex(map, next);
      if (closed[nextIndex]) {
        continue;
      }

      const terrain = getTerrainById(map.tiles[next.row][next.col]);
      const stepCost = roadOnly ? 1 : 1 / Math.max(0.2, terrain.speed || 1);
      const tentative = gScore[current.index] + stepCost;
      if (tentative >= gScore[nextIndex]) {
        continue;
      }

      cameFrom[nextIndex] = current.index;
      gScore[nextIndex] = tentative;
      open.push({
        index: nextIndex,
        tile: next,
        f: tentative + heuristic(next, goal)
      });
    }
  }

  return null;
}

function reconstructPath(map, cameFrom, endIndex) {
  const path = [];
  let index = endIndex;
  while (index >= 0) {
    path.push(indexToTile(map, index));
    index = cameFrom[index];
  }
  path.reverse();
  return path;
}

function joinTilePaths(paths) {
  const joined = [];
  for (const path of paths) {
    for (let i = 0; i < path.length; i += 1) {
      const tile = path[i];
      const last = joined[joined.length - 1];
      if (last && sameTile(last, tile)) {
        continue;
      }
      joined.push(tile);
    }
  }
  return joined;
}

function compressTilePath(path) {
  if (path.length <= 2) {
    return path.slice();
  }
  const compressed = [path[0]];
  let lastDir = getDir(path[0], path[1]);
  for (let i = 1; i < path.length - 1; i += 1) {
    const nextDir = getDir(path[i], path[i + 1]);
    if (nextDir.dc !== lastDir.dc || nextDir.dr !== lastDir.dr) {
      compressed.push(path[i]);
    }
    lastDir = nextDir;
  }
  compressed.push(path[path.length - 1]);
  return compressed;
}

function pruneInitialPoint(points, from) {
  while (points.length > 1) {
    const first = points[0];
    if (Math.hypot(first.x - from.x, first.y - from.y) > CONFIG.clickArriveDistance * 1.5) {
      break;
    }
    points.shift();
  }
}

function getDir(a, b) {
  return {
    dc: Math.sign(b.col - a.col),
    dr: Math.sign(b.row - a.row)
  };
}

function heuristic(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function sameTile(a, b) {
  return a && b && a.col === b.col && a.row === b.row;
}

function tileIndex(map, tile) {
  return tile.row * map.cols + tile.col;
}

function indexToTile(map, index) {
  return {
    col: index % map.cols,
    row: Math.floor(index / map.cols)
  };
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

class BinaryHeap {
  constructor() {
    this.items = [];
    this.size = 0;
  }

  push(item) {
    this.items.push(item);
    this.size = this.items.length;
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    this.size = this.items.length;
    return first;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].f <= this.items[index].f) {
        break;
      }
      this.swap(parent, index);
      index = parent;
    }
  }

  sinkDown(index) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.items.length && this.items[left].f < this.items[smallest].f) {
        smallest = left;
      }
      if (right < this.items.length && this.items[right].f < this.items[smallest].f) {
        smallest = right;
      }
      if (smallest === index) {
        break;
      }
      this.swap(smallest, index);
      index = smallest;
    }
  }

  swap(a, b) {
    const temp = this.items[a];
    this.items[a] = this.items[b];
    this.items[b] = temp;
  }
}
