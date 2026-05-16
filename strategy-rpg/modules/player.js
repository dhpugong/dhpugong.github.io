import { PLAYER_TEMPLATE } from "./config.js";
import { createArmy, getMaxArmySize, payUpkeep } from "./troop.js";
import { deepClone } from "./utils.js";

// 主角模块：管理等级、属性、金币、装备槽和技能点。
export function createPlayer() {
  const player = deepClone(PLAYER_TEMPLATE);
  player.army = createArmy();
  player.target = null;
  player.ownedTowns = [];
  player.ownedResources = [];
  player.inventory = [];
  player.day = 1;
  player.unified = false;
  return player;
}

export function expToNextLevel(player) {
  return 90 + player.level * 55;
}

export function addPlayerExp(player, amount) {
  player.exp += Math.floor(amount);
  const messages = [];
  while (player.exp >= expToNextLevel(player)) {
    player.exp -= expToNextLevel(player);
    player.level += 1;
    player.skillPoints += 2;
    player.attributes.strength += 1;
    if (player.level % 2 === 0) {
      player.attributes.leadership += 1;
    }
    messages.push(`升级至 Lv.${player.level}，获得 2 技能点`);
  }
  return messages;
}

export function spendSkillPoint(player, attr) {
  if (player.skillPoints <= 0 || !Object.prototype.hasOwnProperty.call(player.attributes, attr)) {
    return false;
  }
  player.skillPoints -= 1;
  player.attributes[attr] += 1;
  return true;
}

export function getPlayerBattleBonus(player) {
  if (player.general) {
    player.general.attributes = { ...player.attributes };
  }
  return {
    attack: 1 + player.attributes.strength * 0.018,
    speed: 1 + player.attributes.agility * 0.012,
    magic: 1 + player.attributes.intelligence * 0.02,
    morale: player.attributes.leadership * 0.8
  };
}

export function processNewDay(player, towns, resources = []) {
  player.day += 1;
  const income = collectTax(player, towns);
  const resourceIncome = collectResourceIncome(player, resources);
  const upkeep = payUpkeep(player);
  return {
    day: player.day,
    income: income + resourceIncome,
    townIncome: income,
    resourceIncome,
    upkeep: upkeep.amount,
    upkeepMessage: upkeep.message,
    message: `第 ${player.day} 日：城镇 ${income} 金，资源 ${resourceIncome} 金，${upkeep.message}`
  };
}

export function collectTax(player, towns) {
  const owned = towns.filter((town) => town.owner === "player");
  const income = owned.reduce((sum, town) => sum + getTownDailyIncome(town), 0);
  player.gold += income;
  player.ownedTowns = owned.map((town) => town.id);
  return income;
}

export function getTownDailyIncome(town) {
  return Math.round(town.taxBase * 1.55 * (town.defense / 100 + 0.75));
}

export function refreshOwnedTowns(player, towns) {
  player.ownedTowns = towns.filter((town) => town.owner === "player").map((town) => town.id);
  player.unified = towns.every((town) => town.owner === "player");
}

export function refreshOwnedResources(player, resources) {
  player.ownedResources = (resources || []).filter((resource) => resource.owner === "player").map((resource) => resource.id);
}

export function collectResourceIncome(player, resources) {
  const income = (resources || [])
    .filter((resource) => resource.owner === "player")
    .reduce((sum, resource) => sum + Math.round(resource.income || 0), 0);
  player.gold += income;
  return income;
}

export function getPlayerSummary(player) {
  return [
    `Lv.${player.level} ${player.name}`,
    `金币 ${player.gold}`,
    `经验 ${player.exp}/${expToNextLevel(player)}`,
    `技能点 ${player.skillPoints}`,
    `带兵 ${player.army.reduce((sum, unit) => sum + unit.count, 0)}/${getMaxArmySize(player)}`
  ];
}
