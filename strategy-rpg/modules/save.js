import { CONFIG, WEAPONS } from "./config.js";
import { TOWN_INCOME, RESOURCE_INCOME } from "../data/economy.js";
import { createInitialNpcs } from "./ai.js";
import { createWorldMap, ensurePassablePosition } from "./map.js";
import { applyRandomGeneralAttributes } from "./generals.js";
import { createPlayer } from "./player.js";
import { normalizeReports } from "./reports.js";
import { deepClone } from "./utils.js";

// 存档模块：使用 localStorage，支持自动存档、手动保存和读档。
export function createFreshGameData() {
  const map = createWorldMap();
  const player = createPlayer();
  ensurePassablePosition(map, player);
  return {
    map,
    player,
    npcs: null
  };
}

export function saveGame(game) {
  const data = {
    version: 1,
    savedAt: new Date().toISOString(),
    player: deepClone(game.player),
    towns: deepClone(game.map.towns),
    resources: deepClone(game.map.resources || []),
    npcs: deepClone(game.npcs.filter((npc) => npc.alive)),
    log: deepClone(game.log.slice(0, 20)),
    reports: deepClone((game.reports || []).slice(0, 8)),
    elapsedDayTimer: game.elapsedDayTimer,
    wildSpawnTimer: game.wildSpawnTimer
  };
  localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
  return data;
}

export function loadGameData() {
  const raw = localStorage.getItem(CONFIG.saveKey);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("读取存档失败", error);
    return null;
  }
}

export function hasSave() {
  return Boolean(localStorage.getItem(CONFIG.saveKey));
}

export function applySaveToGame(game, data) {
  if (!data || data.version !== 1) {
    return false;
  }

  const freshMap = createWorldMap();
  mergeTemplateItems(freshMap.towns, data.towns, ["owner", "defense", "garrison", "garrisonLevel", "general"]);
  freshMap.towns.forEach(function (town) {
    if (Object.prototype.hasOwnProperty.call(TOWN_INCOME, town.id)) {
      town.taxBase = TOWN_INCOME[town.id];
    }
    if (!town.garrisonLevel) {
      town.garrisonLevel = 1;
    }
    if (!town.general) {
      town.general = { name: town.name + "守将", faction: town.owner || "neutral", level: Math.max(1, town.garrisonLevel || 1), weapon: "ironSaber" };
    }
    applyRandomGeneralAttributes(town.general);
  });
  mergeTemplateItems(freshMap.resources, data.resources, ["owner"]);
  freshMap.resources.forEach(function (resource) {
    if (Object.prototype.hasOwnProperty.call(RESOURCE_INCOME, resource.id)) {
      resource.income = RESOURCE_INCOME[resource.id];
    }
  });
  game.map = freshMap;
  game.player = data.player || createPlayer();
  normalizeFacing(game.player);
  if (!game.player.general) {
    game.player.general = { name: "沈铁冠", faction: "player", level: Math.max(1, game.player.level || 1), weapon: "oldSword" };
  }
  if (!game.player.inventory) {
    game.player.inventory = [];
  }
  normalizePlayerEquipment(game.player);
  game.player.target = null;
  ensurePassablePosition(game.map, game.player);
  game.npcs = data.npcs || createInitialNpcs(game.map);
  game.npcs.forEach(function (npc) {
    if (!npc.general) {
      npc.general = { name: npc.name || "将领", faction: npc.faction || "neutral", level: Math.max(1, npc.level || 1), weapon: "ironSaber" };
    }
    applyRandomGeneralAttributes(npc.general);
    if (typeof npc.stationed !== "boolean") {
      npc.stationed = false;
    }
    if (!npc.growthTimer) {
      npc.growthTimer = 24;
    }
    normalizeFacing(npc);
  });
  game.log = data.log || [];
  game.reports = normalizeReports(data.reports);
  game.elapsedDayTimer = data.elapsedDayTimer || 0;
  game.wildSpawnTimer = data.wildSpawnTimer || CONFIG.wildSpawnInterval;
  game.state = "world";
  game.activeTown = null;
  game.battle = null;
  game.pendingEncounter = null;
  game.message = "读档完成";
  return true;
}

function normalizeFacing(entity) {
  if (!entity) {
    return;
  }
  if (!entity.facing) {
    entity.facing = "down";
  }
  if (typeof entity.facingAngle !== "number") {
    entity.facingAngle = entity.facing === "right"
      ? Math.PI / 2
      : entity.facing === "left"
        ? -Math.PI / 2
        : entity.facing === "up"
          ? 0
          : Math.PI;
  }
}

function normalizePlayerEquipment(player) {
  if (!player.equipment) {
    player.equipment = { weapon: getSavedWeaponName(player), armor: "未装备", trinket: "未装备" };
  }
  if (!player.equipment.weapon) {
    player.equipment.weapon = getSavedWeaponName(player);
  }
  if (!player.equipment.armor || player.equipment.armor === "旅人皮甲") {
    player.equipment.armor = "未装备";
  }
  if (!player.equipment.trinket || player.equipment.trinket === "铁冠纹章") {
    player.equipment.trinket = "未装备";
  }
}

function getSavedWeaponName(player) {
  const weaponId = player.general ? player.general.weapon : null;
  return weaponId && WEAPONS[weaponId] ? WEAPONS[weaponId].name : "未装备";
}

function mergeTemplateItems(targetItems, savedItems, savedFields) {
  if (!Array.isArray(savedItems)) {
    return;
  }
  const existingIds = new Set(targetItems.map((item) => item.id));
  for (const item of savedItems) {
    if (!existingIds.has(item.id)) {
      targetItems.push(item);
    }
  }
  for (let i = 0; i < targetItems.length; i += 1) {
    const saved = savedItems.find((item) => item.id === targetItems[i].id);
    if (saved) {
      const merged = { ...targetItems[i] };
      for (const field of savedFields || []) {
        if (Object.prototype.hasOwnProperty.call(saved, field)) {
          merged[field] = saved[field];
        }
      }
      targetItems[i] = merged;
    }
  }
}

export function autoSaveIfNeeded(game, dt) {
  game.autoSaveTimer -= dt;
  if (game.autoSaveTimer <= 0) {
    game.autoSaveTimer = CONFIG.autoSaveInterval;
    saveGame(game);
    game.log.unshift("自动存档完成");
  }
}
