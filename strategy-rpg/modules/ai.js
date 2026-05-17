import { FACTIONS } from "./config.js";
import { FACTION_GROWTH_RANGES } from "../data/factionGrowth.js";
import { applyRandomGeneralAttributes } from "./generals.js";
import { findNearestTown, findOpenPosition, isPassable } from "./map.js";
import { addWarReport } from "./reports.js";
import { createArmy, createWildArmy, getArmyPower, upgradeArmyByBudget } from "./troop.js";
import { distanceXY, moveToward, pick, rand, randInt } from "./utils.js";

// AI 模块：NPC 游荡、野怪巡逻、索敌和攻城行为都集中在这里。
export function createInitialNpcs(map) {
  const npcs = [];
  const seeds = [
    { name: "赤狼巡骑", faction: "red", level: 1, x: 1560, y: 980, homeTownId: "redspire", general: { name: "赫连牙", faction: "red", level: 1, weapon: "wolfAxe" }, army: [{ type: "cavalry", count: 5, level: 1, xp: 0, morale: 72 }, { type: "infantry", count: 10, level: 1, xp: 0, morale: 70 }] },
    { name: "苍鹰弓队", faction: "blue", level: 1, x: 1180, y: 1980, homeTownId: "blueharbor", general: { name: "岑青羽", faction: "blue", level: 1, weapon: "eagleBow" }, army: [{ type: "archer", count: 14, level: 1, xp: 0, morale: 72 }, { type: "infantry", count: 8, level: 1, xp: 0, morale: 68 }] },
    { name: "佣兵队长", faction: "neutral", level: 1, x: 1340, y: 520, homeTownId: "graykeep", general: { name: "罗恩", faction: "neutral", level: 1, weapon: "ironSaber" }, army: [{ type: "pikeman", count: 10, level: 1, xp: 0, morale: 68 }, { type: "archer", count: 5, level: 1, xp: 0, morale: 66 }] },
    { name: "黑旗法师", faction: "red", level: 2, x: 4860, y: 2480, homeTownId: "ironpass", general: { name: "邢黑旗", faction: "red", level: 2, weapon: "runedStaff" }, army: [{ type: "mage", count: 4, level: 1, xp: 0, morale: 68 }, { type: "infantry", count: 12, level: 1, xp: 0, morale: 70 }] },
    { name: "北望守军", faction: "blue", level: 2, x: 4520, y: 980, homeTownId: "northwatch", stationed: true, general: { name: "孟遥", faction: "blue", level: 2, weapon: "eagleBow" }, army: [{ type: "infantry", count: 18, level: 2, xp: 0, morale: 74 }, { type: "archer", count: 10, level: 2, xp: 0, morale: 72 }] },
    { name: "风门铁骑", faction: "red", level: 3, x: 5050, y: 3900, homeTownId: "stormgate", stationed: true, general: { name: "拓跋铮", faction: "red", level: 3, weapon: "goldHalberd" }, army: [{ type: "cavalry", count: 12, level: 2, xp: 0, morale: 78 }, { type: "pikeman", count: 16, level: 2, xp: 0, morale: 76 }] },
    { name: "曦望星骑", faction: "blue", level: 2, x: 4380, y: 1640, homeTownId: "dawnwatch", stationed: true, general: { name: "卫流星", faction: "blue", level: 2, weapon: "eagleBow" }, army: [{ type: "cavalry", count: 7, level: 2, xp: 0, morale: 76 }, { type: "archer", count: 12, level: 2, xp: 0, morale: 74 }] },
    { name: "烬落斧卫", faction: "red", level: 2, x: 2670, y: 3180, homeTownId: "emberfall", stationed: true, general: { name: "燕火卫", faction: "red", level: 2, weapon: "wolfAxe" }, army: [{ type: "infantry", count: 18, level: 2, xp: 0, morale: 76 }, { type: "pikeman", count: 12, level: 2, xp: 0, morale: 74 }] },
    { name: "霜渡游哨", faction: "blue", level: 2, x: 1320, y: 3060, homeTownId: "frostford", general: { name: "岑寒哨", faction: "blue", level: 2, weapon: "eagleBow" }, army: [{ type: "archer", count: 12, level: 2, xp: 0, morale: 74 }, { type: "pikeman", count: 8, level: 1, xp: 0, morale: 70 }] },
    { name: "玄岩斥候", faction: "red", level: 2, x: 3440, y: 5480, homeTownId: "ravenrock", stationed: true, general: { name: "狄黑羽", faction: "red", level: 2, weapon: "wolfAxe" }, army: [{ type: "cavalry", count: 6, level: 2, xp: 0, morale: 74 }, { type: "infantry", count: 12, level: 2, xp: 0, morale: 72 }] }
  ];

  for (const seed of seeds) {
    npcs.push(createNpc(seed, map));
  }

  for (let i = 0; i < 9; i += 1) {
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
    kind: "lord",
    facing: seed.facing || "down",
    facingAngle: Math.PI
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
    kind: "wild",
    facing: "down",
    facingAngle: Math.PI
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
    if (Math.random() < curve.upgradeChance) {
      town.garrison = upgradeArmyByBudget(town.garrison, Math.max(1, Math.floor(curve.upgradeBudget * scale))).army;
    }
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
  if (Math.random() < curve.upgradeChance) {
    npc.army = upgradeArmyByBudget(npc.army, curve.upgradeBudget).army;
  }

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
    upgradeChance: rand(data.upgradeChance.min, data.upgradeChance.max),
    upgradeBudget: randInt(data.upgradeBudget.min, data.upgradeBudget.max),
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

  if (npc.faction !== "neutral" && playerDistance < 260) {
    if (npcPower < playerPower) {
      retreatFromPlayer(npc, game);
      return;
    }
    if (npcPower > playerPower * 1.08) {
      npc.state = "chase";
      npc.target = { x: game.player.x, y: game.player.y };
      return;
    }
  }

  const enemyTown = findSiegeTarget(npc, game.map.towns);
  if (enemyTown && npc.kind === "lord" && Math.random() < 0.34) {
    const attackPower = getArmyPower(npc.army);
    const defensePower = getTownDefensePower(enemyTown);
    if (attackPower < defensePower * 0.9) {
      npc.state = "patrol";
      npc.targetTownId = null;
      npc.reportedSiegeTarget = null;
      return;
    }
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

function retreatFromPlayer(npc, game) {
  const dx = npc.x - game.player.x;
  const dy = npc.y - game.player.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  npc.state = "retreat";
  npc.targetTownId = null;
  npc.reportedSiegeTarget = null;
  npc.target = {
    x: npc.x + (dx / len) * rand(180, 320),
    y: npc.y + (dy / len) * rand(180, 320)
  };
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
  updateFacing(npc, npc.target.x - npc.x, npc.target.y - npc.y);
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

function updateFacing(entity, dx, dy) {
  if (Math.hypot(dx, dy) < 0.01) {
    return;
  }
  entity.facingAngle = Math.atan2(dy, dx) + Math.PI / 2;
  if (Math.abs(dx) > Math.abs(dy)) {
    entity.facing = dx > 0 ? "right" : "left";
  } else {
    entity.facing = dy > 0 ? "down" : "up";
  }
  entity.lastMoveAt = performance.now();
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
  const attackPower = getArmyPower(npc.army);
  const defensePower = getTownDefensePower(town);
  if (attackPower < defensePower * 0.88) {
    npc.siegeTimer = 0;
    npc.state = "patrol";
    npc.targetTownId = null;
    npc.reportedSiegeTarget = null;
    npc.army = applySiegeLosses(npc.army, 0.08);
    addWarReport(game, FACTIONS[npc.faction].name + " 进攻 " + town.name + " 失败", town.owner === "player" ? "good" : "neutral");
    if (!npc.army.length) {
      npc.alive = false;
    }
    return;
  }

  town.defense = Math.max(12, town.defense - dt * Math.max(0.25, attackPower / Math.max(1, defensePower)) * 0.9);
  if (npc.siegeTimer > 9 && resolveSiegeByPower(attackPower, defensePower)) {
    const oldOwner = town.owner;
    town.owner = npc.faction;
    town.defense = Math.max(34, Math.round(town.defense * 0.72));
    npc.siegeTimer = 0;
    npc.state = "patrol";
    npc.targetTownId = null;
    npc.reportedSiegeTarget = null;
    game.log.unshift(`${FACTIONS[npc.faction].name} 占领 ${town.name}，原归属 ${FACTIONS[oldOwner].name}`);
    addWarReport(game, FACTIONS[npc.faction].name + " 攻下 " + town.name, oldOwner === "player" ? "bad" : "neutral");
  } else if (npc.siegeTimer > 9) {
    npc.siegeTimer = 0;
    npc.state = "patrol";
    npc.targetTownId = null;
    npc.reportedSiegeTarget = null;
    npc.army = applySiegeLosses(npc.army, 0.12);
    addWarReport(game, FACTIONS[npc.faction].name + " 进攻 " + town.name + " 被击退", town.owner === "player" ? "good" : "neutral");
    if (!npc.army.length) {
      npc.alive = false;
    }
  }
}

function getTownDefensePower(town) {
  return getArmyPower(town.garrison || []) + Math.max(0, town.defense || 0) * 18;
}

function resolveSiegeByPower(attackPower, defensePower) {
  const ratio = attackPower / Math.max(1, defensePower);
  if (ratio >= 1.25) {
    return true;
  }
  if (ratio <= 0.92) {
    return false;
  }
  return Math.random() < (ratio - 0.92) / 0.33;
}

function applySiegeLosses(army, rate) {
  return createArmy((army || []).map(function (unit) {
    const lost = Math.max(1, Math.floor(unit.count * rate));
    return { ...unit, count: Math.max(0, unit.count - lost), morale: Math.max(25, unit.morale - 8) };
  }));
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
