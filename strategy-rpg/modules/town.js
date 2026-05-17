import { FACTIONS, TROOP_TYPES } from "./config.js";
import { addPlayerExp, getTownDailyIncome, refreshOwnedTowns } from "./player.js";
import { createArmy, getArmyPower, isArmyMoraleFull, mergeArmy, recruitUnit, restoreMorale } from "./troop.js";

// 城池模块：负责占领、税收基础、驻军和招募交互。
export function resetTownUi(game) {
  if (!game || !game.ui) {
    return;
  }
  game.ui.townView = "home";
  game.ui.selectedMarketItem = null;
}

export function enterTown(game, town) {
  game.state = "town";
  game.activeTown = town;
  resetTownUi(game);
  game.message = `${town.name}：${FACTIONS[town.owner].name}`;
}

export function leaveTown(game) {
  game.state = "world";
  game.activeTown = null;
  resetTownUi(game);
  game.message = "回到大地图";
}

export function restAtTown(game) {
  const cost = Math.max(8, Math.round(getArmyPower(game.player.army) * 0.015));
  if (isArmyMoraleFull(game.player.army)) {
    game.message = "士气已满，无需整补";
    game.notice = {
      title: "士气已满",
      lines: ["部队士气已经达到上限"],
      timer: 1.6,
      duration: 1.6,
      kind: "gold"
    };
    return;
  }
  if (game.player.gold < cost) {
    game.message = "金币不足，无法整补";
    return;
  }
  game.player.gold -= cost;
  restoreMorale(game.player.army, 18);
  game.message = `整补完成，士气恢复，花费 ${cost} 金`;
}

export function improveDefense(game) {
  const town = game.activeTown;
  if (!town || town.owner !== "player") {
    game.message = "只有己方城池可以修筑城防";
    return;
  }
  const cost = 45;
  if (game.player.gold < cost) {
    game.message = "金币不足，无法修筑城防";
    return;
  }
  game.player.gold -= cost;
  town.defense = Math.min(160, town.defense + 12);
  game.message = `${town.name} 城防提升至 ${town.defense}`;
}

export function getGarrisonUpgradeCost(town) {
  const level = town && town.garrisonLevel ? Math.floor(town.garrisonLevel) : 1;
  return 80 + (level - 1) * 45;
}

export function getTownDevelopmentCost(town) {
  return 45 + getGarrisonUpgradeCost(town);
}

export function developTown(game) {
  const town = game.activeTown;
  if (!town || town.owner !== "player") {
    game.message = "只有己方城镇可以发展";
    return;
  }

  const cost = getTownDevelopmentCost(town);
  if (game.player.gold < cost) {
    game.message = "金币不足，无法发展城市";
    return;
  }

  const nextLevel = (town.garrisonLevel || 1) + 1;
  const cappedLevel = Math.min(6, nextLevel);
  const bonus = [
    { type: "infantry", count: 4 + cappedLevel * 2, level: Math.min(5, cappedLevel), xp: 0, morale: 76 },
    { type: "archer", count: 2 + Math.floor(cappedLevel * 1.4), level: Math.min(5, cappedLevel), xp: 0, morale: 74 }
  ];

  if (cappedLevel >= 3) {
    bonus.push({ type: "pikeman", count: 2 + cappedLevel, level: Math.min(5, cappedLevel - 1), xp: 0, morale: 74 });
  }
  if (cappedLevel >= 5) {
    bonus.push({ type: "cavalry", count: 1 + Math.floor(cappedLevel / 2), level: Math.min(5, cappedLevel - 2), xp: 0, morale: 76 });
  }

  game.player.gold -= cost;
  town.garrisonLevel = nextLevel;
  town.defense = Math.min(240, town.defense + 22 + cappedLevel * 2);
  town.garrison = mergeArmy([...(town.garrison || []), ...bonus]);
  game.message = `${town.name} 发展完成，城防提升至 ${town.defense}`;
  game.notice = {
    title: "城市发展",
    lines: [
      town.name + " 城防与守军提升",
      "城防提升至 " + town.defense
    ],
    timer: 2,
    duration: 2,
    kind: "gold"
  };
}

export function upgradeGarrison(game) {
  const town = game.activeTown;
  if (!town || town.owner !== "player") {
    game.message = "只有己方城镇可以升级守军";
    return;
  }

  const cost = getGarrisonUpgradeCost(town);
  if (game.player.gold < cost) {
    game.message = "金币不足，无法升级守军";
    return;
  }

  const nextLevel = (town.garrisonLevel || 1) + 1;
  const cappedLevel = Math.min(6, nextLevel);
  const bonus = [
    { type: "infantry", count: 4 + cappedLevel * 2, level: Math.min(5, cappedLevel), xp: 0, morale: 76 },
    { type: "archer", count: 2 + Math.floor(cappedLevel * 1.4), level: Math.min(5, cappedLevel), xp: 0, morale: 74 }
  ];

  if (cappedLevel >= 3) {
    bonus.push({ type: "pikeman", count: 2 + cappedLevel, level: Math.min(5, cappedLevel - 1), xp: 0, morale: 74 });
  }
  if (cappedLevel >= 5) {
    bonus.push({ type: "cavalry", count: 1 + Math.floor(cappedLevel / 2), level: Math.min(5, cappedLevel - 2), xp: 0, morale: 76 });
  }

  game.player.gold -= cost;
  town.garrisonLevel = nextLevel;
  town.defense = Math.min(220, town.defense + 10 + cappedLevel * 2);
  town.garrison = mergeArmy([...(town.garrison || []), ...bonus]);
  game.message = `${town.name} 守军升级，城防提升至 ${town.defense}`;
  game.notice = {
    title: "守军升级",
    lines: [
      town.name + " 驻军扩编",
      "城防提升至 " + town.defense
    ],
    timer: 2,
    duration: 2,
    kind: "gold"
  };
}

export function recruitFromTown(game, typeId, count = 3) {
  const town = game.activeTown;
  if (!town || !town.recruits.includes(typeId)) {
    game.message = "此地无法招募该兵种";
    return;
  }
  const result = recruitUnit(game.player, typeId, count);
  game.message = result.message;
}

export function occupyTown(game, town) {
  town.owner = "player";
  if (town.general) {
    town.general.faction = "player";
  }
  town.defense = Math.max(32, Math.round(town.defense * 0.58));
  town.garrison = createArmy([
    { type: "infantry", count: 8, level: 1, xp: 0, morale: 70 },
    { type: "archer", count: 4, level: 1, xp: 0, morale: 68 }
  ]);
  const levelMessages = addPlayerExp(game.player, 65);
  refreshOwnedTowns(game.player, game.map.towns);
  game.message = `${town.name} 已归入铁冠盟约`;
  game.log.unshift(`占领 ${town.name}，城防受损，留下基础驻军`);
  for (const msg of levelMessages) {
    game.log.unshift(msg);
  }
}

export function getTownActionText(town) {
  if (!town) {
    return [];
  }
  const owner = FACTIONS[town.owner].name;
  const recruits = town.recruits.map((id) => TROOP_TYPES[id].name).join("、");
  return [
    `${town.name} / ${owner}`,
    `类型：${town.kind === "castle" ? "城池" : town.kind === "tavern" ? "酒馆" : "村庄"}`,
    `城防：${town.defense}`,
    `收益：${getTownDailyIncome(town)}`,
    `可招募：${recruits}`
  ];
}
