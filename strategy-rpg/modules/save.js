import { CONFIG, WEAPONS } from "./config.js";
import { TOWN_INCOME, RESOURCE_INCOME } from "../data/economy.js";
import { createInitialNpcs } from "./ai.js";
import { createWorldMap, ensurePassablePosition } from "./map.js";
import { applyRandomGeneralAttributes } from "./generals.js";
import { ensurePlayerGoods } from "./market.js";
import { createPlayer } from "./player.js";
import { normalizeReports } from "./reports.js";
import { deepClone } from "./utils.js";
import { serializeFogOfWar } from "../map/fog.js";

// 存档模块：使用 localStorage，支持自动存档、手动保存和读档。
const SAVE_SLOT_COUNT = 3;
const SAVE_SLOTS_KEY = CONFIG.saveKey + "-slots";
const RESUME_SAVE_KEY = CONFIG.saveKey + "-resume";

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

function createSaveData(game) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    player: deepClone(game.player),
    towns: deepClone(game.map.towns),
    resources: deepClone(game.map.resources || []),
    npcs: deepClone((game.npcs || []).filter((npc) => npc.alive)),
    log: deepClone(game.log.slice(0, 20)),
    reports: deepClone((game.reports || []).slice(0, 8)),
    fog: serializeFogOfWar(game.fog),
    elapsedDayTimer: game.elapsedDayTimer,
    wildSpawnTimer: game.wildSpawnTimer
  };
}

export function saveGame(game, slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SAVE_SLOT_COUNT) {
    return null;
  }
  const data = createSaveData(game);
  const slots = getStoredSaveSlots();
  slots[slotIndex] = data;
  localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots));
  return data;
}

export function deleteSaveSlot(slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SAVE_SLOT_COUNT) {
    return false;
  }
  const slots = getStoredSaveSlots();
  const hasStoredSlots = slots.some(Boolean);
  if (hasStoredSlots) {
    slots[slotIndex] = null;
    localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots));
    return true;
  }
  if (slotIndex === 0 && localStorage.getItem(CONFIG.saveKey)) {
    localStorage.removeItem(CONFIG.saveKey);
    return true;
  }
  return false;
}

export function saveResumeGame(game) {
  const data = createSaveData(game);
  localStorage.setItem(RESUME_SAVE_KEY, JSON.stringify(data));
  return data;
}

export function loadGameData(slotIndex) {
  if (typeof slotIndex === "number") {
    return getSaveSlots()[slotIndex] || null;
  }
  return getSaveSlots().find(Boolean) || null;
}

export function loadResumeGameData() {
  return loadSaveDataByKey(RESUME_SAVE_KEY) || loadLegacySaveData();
}

function loadLegacySaveData() {
  return loadSaveDataByKey(CONFIG.saveKey);
}

function loadSaveDataByKey(key) {
  const raw = localStorage.getItem(key);
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
  return getStoredSaveSlots().some(Boolean) || Boolean(localStorage.getItem(CONFIG.saveKey));
}

export function hasResumeGame() {
  return Boolean(localStorage.getItem(RESUME_SAVE_KEY) || localStorage.getItem(CONFIG.saveKey));
}

export function getSaveSlots() {
  const slots = getStoredSaveSlots();
  if (slots.some(Boolean)) {
    return slots;
  }
  const legacy = loadLegacySaveData();
  if (legacy) {
    slots[0] = legacy;
  }
  return slots;
}

function getStoredSaveSlots() {
  const slots = createEmptySaveSlots();
  const raw = localStorage.getItem(SAVE_SLOTS_KEY);
  if (!raw) {
    return slots;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return slots;
    }
    for (let i = 0; i < SAVE_SLOT_COUNT; i += 1) {
      if (parsed[i] && parsed[i].version === 1) {
        slots[i] = parsed[i];
      }
    }
    return slots;
  } catch (error) {
    console.warn("读取存档槽失败", error);
    return slots;
  }
}

function createEmptySaveSlots() {
  return new Array(SAVE_SLOT_COUNT).fill(null);
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
  if (!Array.isArray(game.player.usedPrivilegeCodes)) {
    game.player.usedPrivilegeCodes = [];
  }
  ensurePlayerGoods(game.player);
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
    saveResumeGame(game);
  }
}
