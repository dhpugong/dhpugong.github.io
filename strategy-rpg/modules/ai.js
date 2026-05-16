import { FACTIONS } from "./config.js";
import { FACTION_GROWTH_RANGES } from "../data/factionGrowth.js";
import { applyRandomGeneralAttributes } from "./generals.js";
import { findNearestTown, findOpenPosition, isPassable } from "./map.js";
import { addWarReport } from "./reports.js";
import { createArmy, createWildArmy, getArmyPower } from "./troop.js";
import { distanceXY, moveToward, pick, rand, randInt } from "./utils.js";

// AI 模块：NPC 游荡、野怪巡逻、索敌和攻城行为都集中在这里。
export function createInitialNpcs(map) {
  const npcs = [];
  const seeds = [
    { name: "赤狼巡骑", faction: "red", level: 1, x: 1560, y: 980, homeTownId: "redspire", general: { name: "赫连牙", faction: "red", level: 1, weapon: "wolfAxe" }, army: [{ type: "cavalry", count: 5, level: 1, xp: 0, morale: 72 }, { type: "infantry", count: 10, level: 1, xp: 0, morale: 70 }] },
    { name: "苍鹰弓队", faction: "blue", level: 1, x: 880, y: 1160, homeTownId: "blueharbor", general: { name: "岑青羽", faction: "blue", level: 1, weapon: "eagleBow" }, army: [{ type: "archer", count: 14, level: 1, xp: 0, morale: 72 }, { type: "infantry", count: 8, level: 1, xp: 0, morale: 68 }] },
    { name: "佣兵队长", faction: "neutral", level: 1, x: 1340, y: 520, homeTownId: "graykeep", general: { name: "罗恩", faction: "neutral", level: 1, weapon: "ironSaber" }, army: [{ type: "pikeman", count: 10, level: 1, xp: 0, morale: 68 }, { type: "archer", count: 5, level: 1, xp: 0, morale: 66 }] },
    { name: "黑旗法师", faction: "red", level: 2, x: 2030, y: 640, homeTownId: "stormgate", general: { name: "邢黑旗", faction: "red", level: 2, weapon: "runedStaff" }, army: [{ type: "mage", count: 4, level: 1, xp: 0, morale: 68 }, { type: "infantry", count: 12, level: 1, xp: 0, morale: 70 }] },
    { name: "北望守军", faction: "blue", level: 2, x: 2700, y: 520, homeTownId: "northwatch", stationed: true, general: { name: "孟遥", faction: "blue", level: 2, weapon: "eagleBow" }, army: [{ type: "infantry", count: 18, level: 2, xp: 0, morale: 74 }, { type: "archer", count: 10, level: 2, xp: 0, morale: 72 }] },
    { name: "风门铁骑", faction: "red", level: 3, x: 3120, y: 1080, homeTownId: "stormgate", stationed: true, general: { name: "拓跋铮", faction: "red", level: 3, weapon: "goldHalberd" }, army: [{ type: "cavalry", count: 12, level: 2, xp: 0, morale: 78 }, { type: "pikeman", count: 16, level: 2, xp: 0, morale: 76 }] }
  ];

  for (const seed of seeds) {
    npcs.push(createNpc(seed, map));
  }

  for (let i = 0; i < 5; i += 1) {
    npcs.push(createWildBand(map, 1 + (i % 2)));
  }
  return npcs;
}

function createNpc(seed, map) {
  const npc = {
    id: `npc-${seed.name}-${Math.random().toString(16).slice(2)}`,
    name: seed.name,
    faction: seed.faction,
    level: seed.level,
    x: seed.x,
    y: seed.y,
    target: null,
    state: "patrol",
    thinkTimer: rand(1, 4),
    siegeTimer: 0,
    growthTimer: rand(16, 34),
    homeTownId: seed.homeTownId || null,
    stationed: !!seed.stationed,
    general: applyRandomGeneralAttributes(seed.general),
    army: createArmy(seed.army),
    alive: true,
    kind: "lord"
  };
  if (!isPassable(map, npc.x, npc.y)) {
    const pos = findOpenPosition(map);
    npc.x = pos.x;
    npc.y = pos.y;
  }
  return npc;
}

export function createWildBand(map, level = 1) {
  const pos = findOpenPosition(map);
  return {
    id: `wild-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: pick(["荒原盗匪", "林地狼群", "旧军残部", "山道劫掠者"]),
    faction: "wild",
    level,
    x: pos.x,
    y: pos.y,
    target: null,
    state: "patrol",
    thinkTimer: rand(0.5, 2),
    siegeTimer: 0,
    growthTimer: rand(20, 36),
    homeTownId: null,
    stationed: false,
    general: applyRandomGeneralAttributes({
      name: pick(["石牙", "断刃", "枯木", "黑砂"]),
      faction: "wild",
      level,
      weapon: "ironSaber"
    }),
    army: createWildArmy(level),
    alive: true,
    kind: "wild"
  };
}

export function updateNpcs(game, dt) {
  for (const npc of game.npcs) {
    if (!npc.alive) {
      continue;
    }
    updateNpcGrowth(npc, game, dt);
    npc.thinkTimer -= dt;
    if (npc.thinkTimer <= 0) {
      think(npc, game);
      npc.thinkTimer = rand(1.2, 3.5);
    }
    moveNpc(npc, game.map, dt);
    handleNpcInteractions(npc, game, dt);
  }
  game.npcs = game.npcs.filter((npc) => npc.alive);
}

export function growFactionTowns(game) {
  for (const town of game.map.towns) {
    if (town.owner === "player") {
      continue;
    }

    const curve = getGrowthCurve(town.owner, "lord");
    const level = town.garrisonLevel || Math.max(1, Math.round(town.general ? town.general.level || 1 : 1));
    const nextLevel = level + (town.kind === "castle" ? 0.22 : 0.14);
    const troopLevel = Math.max(1, Math.min(5, Math.floor(nextLevel)));
    const scale = town.kind === "castle" ? 1.1 : 0.7;

    town.garrisonLevel = nextLevel;
    town.defense = Math.min(240, Math.round(town.defense + (town.kind === "castle" ? 3 : 2)));
    town.garrison = createArmy([
      ...(town.garrison || []),
      { type: curve.primary, count: Math.ceil((curve.primaryCount + nextLevel * curve.scale) * scale), level: troopLevel, xp: 0, morale: curve.morale },
      { type: curve.secondary, count: Math.ceil((curve.secondaryCount + nextLevel * curve.scale * 0.5) * scale), level: troopLevel, xp: 0, morale: curve.morale - 2 }
    ]);
    if (town.general) {
      town.general.level = Math.max(town.general.level || 1, Math.floor(nextLevel));
      town.general.faction = town.owner;
    }
  }
}

function updateNpcGrowth(npc, game, dt) {
  npc.growthTimer -= dt;
  if (npc.growthTimer > 0) {
    return;
  }

  const curve = getGrowthCurve(npc.faction, npc.kind);
  npc.growthTimer = curve.interval;
  npc.level += curve.levelGain;
  if (npc.general) {
    npc.general.level = Math.max(npc.general.level || 1, npc.level);
  }

  const troopLevel = Math.max(1, Math.min(5, Math.floor(npc.level)));
  const additions = [
    { type: curve.primary, count: curve.primaryCount + npc.level * curve.scale, level: troopLevel, xp: 0, morale: curve.morale },
    { type: curve.secondary, count: curve.secondaryCount + Math.floor(npc.level * curve.scale * 0.6), level: troopLevel, xp: 0, morale: curve.morale - 2 }
  ];
  npc.army = createArmy([...(npc.army || []), ...additions]);

  if (npc.stationed && Math.random() < curve.mobilizeChance) {
    npc.stationed = false;
    const town = game.map.towns.find((item) => item.id === npc.homeTownId);
    if (town) {
      npc.x = town.x + rand(-28, 28);
      npc.y = town.y + rand(-28, 28);
    }
    addWarReport(game, FACTIONS[npc.faction].name + " 的 " + npc.name + " 出城集结", "bad");
  }
}

function getGrowthCurve(faction, kind) {
  const data = kind === "wild"
    ? FACTION_GROWTH_RANGES.wild
    : FACTION_GROWTH_RANGES[faction] || FACTION_GROWTH_RANGES.neutral;
  return {
    interval: rand(data.interval.min, data.interval.max),
    levelGain: rand(data.levelGain.min, data.levelGain.max),
    primary: data.primary,
    secondary: data.secondary,
    primaryCount: randInt(data.primaryCount.min, data.primaryCount.max),
    secondaryCount: randInt(data.secondaryCount.min, data.secondaryCount.max),
    scale: rand(data.scale.min, data.scale.max),
    morale: randInt(data.morale.min, data.morale.max),
    mobilizeChance: rand(data.mobilizeChance.min, data.mobilizeChance.max)
  };
}

function think(npc, game) {
  if (npc.stationed) {
    const town = game.map.towns.find((item) => item.id === npc.homeTownId);
    if (town && town.owner === npc.faction && Math.random() > 0.18) {
      npc.x = town.x;
      npc.y = town.y;
      npc.target = null;
      npc.state = "garrison";
      return;
    }
    npc.stationed = false;
  }

  const playerDistance = distanceXY(npc.x, npc.y, game.player.x, game.player.y);
  const npcPower = getArmyPower(npc.army);
  const playerPower = getArmyPower(game.player.army);

  if (npc.faction !== "neutral" && playerDistance < 240 && npcPower > playerPower * 0.55) {
    npc.state = "chase";
    npc.target = { x: game.player.x, y: game.player.y };
    return;
  }

  const enemyTown = findSiegeTarget(npc, game.map.towns);
  if (enemyTown && npc.kind === "lord" && Math.random() < 0.34) {
    npc.state = "siege";
    npc.targetTownId = enemyTown.id;
    npc.target = { x: enemyTown.x, y: enemyTown.y };
    if (npc.reportedSiegeTarget !== enemyTown.id) {
      addWarReport(game, enemyTown.name + " 正在被 " + FACTIONS[npc.faction].name + " 攻击", enemyTown.owner === "player" ? "bad" : "neutral");
      npc.reportedSiegeTarget = enemyTown.id;
    }
    return;
  }

  if (!npc.target || Math.random() < 0.45) {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(80, 260);
    npc.target = {
      x: npc.x + Math.cos(angle) * radius,
      y: npc.y + Math.sin(angle) * radius
    };
    npc.state = "patrol";
  }
}

function findSiegeTarget(npc, towns) {
  const candidates = towns.filter((town) => town.owner !== npc.faction && town.owner !== "wild");
  if (!candidates.length) {
    return null;
  }
  candidates.sort((a, b) => distanceXY(npc.x, npc.y, a.x, a.y) - distanceXY(npc.x, npc.y, b.x, b.y));
  return candidates[0];
}

function moveNpc(npc, map, dt) {
  if (npc.stationed) {
    return;
  }
  if (!npc.target) {
    return;
  }
  const speed = npc.kind === "wild" ? 34 : 46;
  const oldX = npc.x;
  const oldY = npc.y;
  const arrived = moveToward(npc, npc.target.x, npc.target.y, speed, dt);
  if (!isPassable(map, npc.x, npc.y)) {
    npc.x = oldX;
    npc.y = oldY;
    npc.target = null;
  }
  if (arrived) {
    npc.target = null;
  }
}

function handleNpcInteractions(npc, game, dt) {
  if (npc.stationed) {
    return;
  }

  const playerDistance = distanceXY(npc.x, npc.y, game.player.x, game.player.y);
  if (playerDistance < 34 && npc.faction !== "neutral" && game.state === "world") {
    game.pendingEncounter = npc;
    return;
  }

  if (npc.state !== "siege" || !npc.targetTownId) {
    return;
  }
  const town = game.map.towns.find((item) => item.id === npc.targetTownId);
  if (!town || town.owner === npc.faction) {
    npc.state = "patrol";
    npc.targetTownId = null;
    npc.reportedSiegeTarget = null;
    return;
  }
  if (distanceXY(npc.x, npc.y, town.x, town.y) > 44) {
    return;
  }

  npc.siegeTimer += dt;
  town.defense = Math.max(12, town.defense - dt * 1.5);
  if (npc.siegeTimer > 9 || getArmyPower(npc.army) > getArmyPower(town.garrison) + town.defense * 2.2) {
    const oldOwner = town.owner;
    town.owner = npc.faction;
    town.defense = Math.max(34, Math.round(town.defense * 0.72));
    npc.siegeTimer = 0;
    npc.state = "patrol";
    npc.targetTownId = null;
    npc.reportedSiegeTarget = null;
    game.log.unshift(`${FACTIONS[npc.faction].name} 占领 ${town.name}，原归属 ${FACTIONS[oldOwner].name}`);
    addWarReport(game, FACTIONS[npc.faction].name + " 攻下 " + town.name, oldOwner === "player" ? "bad" : "neutral");
  }
}

export function spawnWildIfNeeded(game, dt) {
  game.wildSpawnTimer -= dt;
  if (game.wildSpawnTimer > 0) {
    return;
  }
  game.wildSpawnTimer = 22;
  const wildCount = game.npcs.filter((npc) => npc.kind === "wild").length;
  if (wildCount < 7) {
    const level = randInt(1, Math.max(1, Math.min(4, game.player.level)));
    const wild = createWildBand(game.map, level);
    game.npcs.push(wild);
    game.log.unshift(`${wild.name} 出现在边境`);
  }
}
