import { CONFIG, STARTING_ARMY, TROOP_TYPES } from "./config.js";
import { BATTLE_REWARD_RANGES } from "../data/battleRewards.js";
import { TROOP_LEVEL_STATS } from "../data/units.js";
import { deepClone, rand } from "./utils.js";

// 部队模块：处理兵种数据、招募、升级、伤亡和维护费。
export function createArmy(template = STARTING_ARMY) {
  return mergeArmy(deepClone(template));
}

export function mergeArmy(units) {
  const merged = [];
  for (const unit of units) {
    if (!unit || unit.count <= 0 || !TROOP_TYPES[unit.type]) {
      continue;
    }
    const existing = merged.find((item) => item.type === unit.type && item.level === unit.level);
    if (existing) {
      existing.count += Math.floor(unit.count);
      existing.xp += unit.xp || 0;
      existing.morale = Math.round((existing.morale + (unit.morale || 70)) / 2);
    } else {
      merged.push({
        type: unit.type,
        count: Math.floor(unit.count),
        level: unit.level || 1,
        xp: unit.xp || 0,
        morale: typeof unit.morale === "number" ? unit.morale : TROOP_TYPES[unit.type].morale
      });
    }
  }
  return merged;
}

export function getArmySize(army) {
  return army.reduce((sum, unit) => sum + unit.count, 0);
}

export function getMaxArmySize(player) {
  return 24 + player.attributes.leadership * 8 + player.level * 4;
}

export function getArmyPower(army) {
  return army.reduce((sum, unit) => {
    const stats = getTroopLevelStats(unit.type, unit.level);
    const moraleBonus = 0.75 + unit.morale / 220;
    return sum + unit.count * (stats.attack + stats.defense * 1.35 + stats.hp / 7 + stats.range / 70 + stats.speed / 18) * moraleBonus;
  }, 0);
}

export function getUpkeep(army) {
  return army.reduce((sum, unit) => sum + getTroopLevelStats(unit.type, unit.level).upkeep * unit.count, 0);
}

export function recruitUnit(player, typeId, count = 1) {
  const type = TROOP_TYPES[typeId];
  if (!type) {
    return { ok: false, message: "未知兵种" };
  }

  const current = getArmySize(player.army);
  const max = getMaxArmySize(player);
  const allowed = Math.max(0, Math.min(count, max - current));
  if (allowed <= 0) {
    return { ok: false, message: "统御不足，无法继续扩军" };
  }

  const cost = allowed * type.cost;
  if (player.gold < cost) {
    return { ok: false, message: "金币不足" };
  }

  player.gold -= cost;
  player.army = mergeArmy([
    ...player.army,
    { type: typeId, count: allowed, level: 1, xp: 0, morale: type.morale }
  ]);
  return { ok: true, message: `招募 ${type.name} x${allowed}` };
}

export function addArmyExperience(army, exp) {
  for (const unit of army) {
    unit.xp += Math.floor(exp * Math.max(1, unit.count / 8));
    while (unit.level < getMaxTroopLevel(unit.type) && unit.xp >= xpForTroopLevel(unit.level)) {
      unit.xp -= xpForTroopLevel(unit.level);
      unit.level += 1;
      unit.morale = Math.min(100, unit.morale + 5);
    }
    if (unit.level >= getMaxTroopLevel(unit.type)) {
      unit.xp = 0;
    }
  }
}

export function xpForTroopLevel(level) {
  return 28 + level * 18;
}

export function getMaxTroopLevel(typeId) {
  const table = TROOP_LEVEL_STATS[typeId] && TROOP_LEVEL_STATS[typeId].levels;
  if (!table) {
    return 5;
  }
  return Math.max(...Object.keys(table).map(Number));
}

export function getTroopLevelStats(typeId, level = 1) {
  const base = TROOP_TYPES[typeId];
  const table = TROOP_LEVEL_STATS[typeId] && TROOP_LEVEL_STATS[typeId].levels;
  if (!base) {
    return {};
  }
  const safeLevel = Math.max(1, Math.min(getMaxTroopLevel(typeId), Math.floor(level || 1)));
  const levelStats = table && table[safeLevel] ? table[safeLevel] : {};
  return { ...base, ...levelStats, level: safeLevel };
}

export function getTroopUpgradeCost(unit) {
  if (!unit || unit.level >= getMaxTroopLevel(unit.type)) {
    return 0;
  }
  const nextStats = getTroopLevelStats(unit.type, unit.level + 1);
  return Math.max(0, Math.round((nextStats.upgradeCost || 0) * unit.count));
}

export function upgradeArmyStack(player, stackIndex) {
  const index = Number(stackIndex);
  const unit = player.army[index];
  if (!unit) {
    return { ok: false, message: "没有这支部队" };
  }
  if (unit.level >= getMaxTroopLevel(unit.type)) {
    return { ok: false, message: "该部队已满级" };
  }
  const cost = getTroopUpgradeCost(unit);
  if (player.gold < cost) {
    return { ok: false, message: "金币不足" };
  }
  player.gold -= cost;
  unit.level += 1;
  unit.xp = 0;
  unit.morale = Math.min(100, unit.morale + 4);
  player.army = mergeArmy(player.army);
  const type = TROOP_TYPES[unit.type];
  return { ok: true, message: `${type.name} 升至 Lv.${unit.level}，花费 ${cost} 金` };
}

export function upgradeArmyByBudget(army, budget = 1) {
  let remaining = Math.max(0, Math.floor(budget));
  let upgraded = 0;
  const nextArmy = [...army];
  while (remaining > 0) {
    const candidates = nextArmy
      .map((unit, index) => ({ unit, index }))
      .filter((item) => item.unit.level < getMaxTroopLevel(item.unit.type));
    if (!candidates.length) {
      break;
    }
    candidates.sort((a, b) => (a.unit.level - b.unit.level) || (b.unit.count - a.unit.count));
    const pick = candidates[0];
    pick.unit.level += 1;
    pick.unit.xp = 0;
    pick.unit.morale = Math.min(100, pick.unit.morale + 3);
    upgraded += 1;
    remaining -= 1;
  }
  return { army: mergeArmy(nextArmy), upgraded };
}

export function applyCasualties(army, casualtyMap) {
  for (const unit of army) {
    const key = getArmyStackKey(unit);
    const dead = casualtyMap[key] || casualtyMap[unit.type] || 0;
    if (dead > 0) {
      unit.count = Math.max(0, unit.count - dead);
      unit.morale = Math.max(20, unit.morale - Math.ceil(dead / Math.max(1, unit.count + dead) * 35));
    }
  }
  return mergeArmy(army.filter((unit) => unit.count > 0));
}

function getArmyStackKey(unit) {
  return unit.type + ":" + Math.max(1, Math.floor(unit.level || 1));
}

export function restoreMorale(army, amount) {
  for (const unit of army) {
    unit.morale = Math.min(100, unit.morale + amount);
  }
}

export function isArmyMoraleFull(army) {
  return army.length === 0 || army.every((unit) => unit.morale >= 100);
}

export function createWildArmy(level = 1) {
  const size = 8 + level * 4;
  if (level % 3 === 0) {
    return createArmy([
      { type: "cavalry", count: 3 + level, level, xp: 0, morale: 66 },
      { type: "infantry", count: size, level, xp: 0, morale: 62 }
    ]);
  }
  if (level % 2 === 0) {
    return createArmy([
      { type: "pikeman", count: size, level, xp: 0, morale: 64 },
      { type: "archer", count: 4 + level, level, xp: 0, morale: 62 }
    ]);
  }
  return createArmy([
    { type: "infantry", count: size, level, xp: 0, morale: 60 },
    { type: "archer", count: 2 + level, level, xp: 0, morale: 58 }
  ]);
}

export function payUpkeep(player) {
  const upkeep = getUpkeep(player.army);
  player.gold -= upkeep;
  let message = `支付维护费 ${upkeep} 金`;
  if (player.gold < 0) {
    const debt = Math.abs(player.gold);
    player.gold = 0;
    for (const unit of player.army) {
      unit.morale = Math.max(10, unit.morale - 8);
    }
    message += `，欠饷 ${debt}，士气下降`;
  }
  return { amount: upkeep, message };
}

export function describeArmy(army) {
  if (!army.length) {
    return "无部队";
  }
  return army.map((unit) => `${TROOP_TYPES[unit.type].name}${unit.count}`).join(" / ");
}

export function getRosterLines(army) {
  return army.map((unit) => {
    const type = TROOP_TYPES[unit.type];
    const stats = getTroopLevelStats(unit.type, unit.level);
    return `${type.name} Lv.${unit.level} x${unit.count} 攻${stats.attack} 防${stats.defense} 士气${unit.morale}`;
  });
}

export function getRecruitOptions(town) {
  return town.recruits.map((typeId) => TROOP_TYPES[typeId]).filter(Boolean);
}

export function getVictoryRewards(enemyArmy, isSiege = false) {
  const power = getArmyPower(enemyArmy);
  const range = isSiege ? BATTLE_REWARD_RANGES.siege : BATTLE_REWARD_RANGES.encounter;
  return {
    gold: Math.round(rand(range.goldBase.min, range.goldBase.max) + power * rand(range.goldPowerRate.min, range.goldPowerRate.max)),
    exp: Math.round(rand(range.expBase.min, range.expBase.max) + power * rand(range.expPowerRate.min, range.expPowerRate.max))
  };
}

export function hasArmy(army) {
  return getArmySize(army) > 0;
}

export function capMoraleAfterBattle(army, won) {
  for (const unit of army) {
    unit.morale = Math.max(10, Math.min(100, unit.morale + (won ? 6 : -12)));
  }
}

export function getTroopBattleStats(unit) {
  const type = getTroopLevelStats(unit.type, unit.level);
  const moraleMul = 0.82 + unit.morale / 280;
  return {
    hp: Math.round(type.hp),
    attack: Math.round(type.attack * moraleMul),
    defense: Math.round(type.defense),
    range: type.range,
    speed: type.speed,
    crit: type.crit,
    color: type.color,
    name: type.name,
    icon: type.icon,
    skill: unit.type === "mage" ? "fireball" : unit.type === "archer" ? "arrowRain" : unit.type === "cavalry" ? "charge" : "warCry"
  };
}

export function canRecruitMore(player) {
  return getArmySize(player.army) < getMaxArmySize(player);
}

export function getDisbandCountForDebt(player) {
  if (player.gold >= 0) {
    return 0;
  }
  return Math.ceil(Math.abs(player.gold) / CONFIG.dayLength);
}
