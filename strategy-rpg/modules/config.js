import { TOWN_INCOME, RESOURCE_INCOME } from "../data/economy.js";
import { TROOP_TYPES_DATA } from "../data/units.js";

// 全局配置：集中管理尺寸、颜色、兵种、技能和初始城池，方便二次开发。
export const CONFIG = {
  canvasWidth: 960,
  canvasHeight: 540,
  tileSize: 32,
  mapCols: 192,
  mapRows: 192,
  playerSpeed: 118,
  cameraLerp: 0.12,
  clickArriveDistance: 6,
  autoSaveInterval: 14,
  wildSpawnInterval: 36,
  dayLength: 38,
  targetFps: {
    start: 24,
    world: 30,
    battle: 45,
    ui: 24
  },
  interactDistance: 54,
  battleWidth: 900,
  battleHeight: 360,
  saveKey: "iron-crown-lords-save-v1",
  colors: {
    ink: "#f8e9bd",
    muted: "#b9a77a",
    gold: "#d6a84f",
    goldBright: "#ffd56a",
    red: "#c94f3f",
    redDark: "#67251f",
    blue: "#4b7fc7",
    green: "#4f9b56",
    purple: "#8e5ab8",
    black: "#070604",
    panel: "rgba(20, 14, 8, 0.82)",
    panelStrong: "rgba(31, 21, 11, 0.94)",
    line: "#8f682e"
  }
};

export const TERRAIN = {
  grass: { id: 0, name: "草原", color: "#405d2a", passable: true, speed: 1 },
  water: { id: 1, name: "水域", color: "#1e405d", passable: false, speed: 0 },
  mountain: { id: 2, name: "山脉", color: "#334352", passable: false, speed: 0 },
  road: { id: 3, name: "道路", color: "#8a6b3d", passable: true, speed: 1.2 },
  forest: { id: 4, name: "森林", color: "#284727", passable: true, speed: 0.72 },
  hill: { id: 5, name: "丘陵", color: "#6a5b38", passable: true, speed: 0.82 }
};

export const FACTIONS = {
  player: { id: "player", name: "铁冠盟约", color: "#d6a84f" },
  neutral: { id: "neutral", name: "自由城邦", color: "#b9a77a" },
  red: { id: "red", name: "赤狼公国", color: "#c94f3f" },
  blue: { id: "blue", name: "苍鹰王庭", color: "#4b7fc7" },
  wild: { id: "wild", name: "荒野群落", color: "#7b8f44" }
};

export const MINIMAP_FACTION_COLORS = {
  player: "#ffd13a",
  neutral: "#ffeba2",
  red: "#ff1100",
  blue: "#0084ffbe",
  wild: "#a0f403"
};

export const MINIMAP_ICON_SETTINGS = {
  townScale: 0.7,
  playerScale: 0.7,
  mineScale: 0.5,
  farmScale: 0.5
};

export const MINIMAP_ICON_COLORS = {
  playerArrow: "#32ff6a",
  mineBody: "#7d756a",
  mineTop: "#d1c7b5",
  mineDoor: "#2b2724",
  mineAccent: "#ffe06a",
  farmSoil: "#8f6735",
  farmCrop: "#78e05f",
  farmBarn: "#ffe06a",
  ownedAccent: "#32ff6a"
};

export const TROOP_TYPES = TROOP_TYPES_DATA;

export const SKILLS = {
  warCry: {
    id: "warCry",
    name: "战吼",
    cooldown: 16,
    description: "提高我方士气并造成短暂伤害加成"
  },
  fireball: {
    id: "fireball",
    name: "火球术",
    cooldown: 7.5,
    description: "法师对目标周围造成范围伤害"
  },
  arrowRain: {
    id: "arrowRain",
    name: "箭雨",
    cooldown: 9,
    description: "弓箭手齐射，压低敌方前排血线"
  },
  charge: {
    id: "charge",
    name: "冲锋",
    cooldown: 11,
    description: "骑兵高速接敌，首次命中造成高额伤害"
  }
};

export const WEAPONS = {
  oldSword: {
    id: "oldSword",
    name: "旧王短剑",
    quality: "common",
    attack: 8,
    defense: 2,
    range: 34,
    crit: 0.05,
    dropChance: 0,
    color: "#d8d2c6"
  },
  ironSaber: {
    id: "ironSaber",
    name: "铁脊军刀",
    quality: "uncommon",
    attack: 12,
    defense: 3,
    range: 36,
    crit: 0.07,
    dropChance: 0.28,
    color: "#d8d2c6"
  },
  guardSpear: {
    id: "guardSpear",
    name: "城卫长矛",
    quality: "common",
    attack: 10,
    defense: 4,
    range: 58,
    crit: 0.04,
    dropChance: 0.12,
    color: "#c9c2ad"
  },
  rangerKnife: {
    id: "rangerKnife",
    name: "游侠短刀",
    quality: "uncommon",
    attack: 11,
    defense: 1,
    range: 32,
    crit: 0.16,
    dropChance: 0.14,
    color: "#9fd6a0"
  },
  wolfAxe: {
    id: "wolfAxe",
    name: "赤狼战斧",
    quality: "rare",
    attack: 16,
    defense: 2,
    range: 38,
    crit: 0.1,
    dropChance: 0.32,
    color: "#d66a4a"
  },
  blackPike: {
    id: "blackPike",
    name: "玄铁长枪",
    quality: "rare",
    attack: 15,
    defense: 4,
    range: 68,
    crit: 0.08,
    dropChance: 0.18,
    color: "#8ea0aa"
  },
  eagleBow: {
    id: "eagleBow",
    name: "苍鹰长弓",
    quality: "rare",
    attack: 13,
    defense: 1,
    range: 130,
    crit: 0.14,
    dropChance: 0.3,
    color: "#9ed2f0"
  },
  moonCrossbow: {
    id: "moonCrossbow",
    name: "月井弩",
    quality: "rare",
    attack: 15,
    defense: 2,
    range: 108,
    crit: 0.18,
    dropChance: 0.16,
    color: "#b7c9ff"
  },
  runedStaff: {
    id: "runedStaff",
    name: "符文法杖",
    quality: "epic",
    attack: 18,
    defense: 1,
    range: 118,
    crit: 0.12,
    dropChance: 0.24,
    color: "#c79bff"
  },
  frostMace: {
    id: "frostMace",
    name: "霜铁战锤",
    quality: "epic",
    attack: 19,
    defense: 6,
    range: 40,
    crit: 0.06,
    dropChance: 0.12,
    color: "#9edfff"
  },
  emberBlade: {
    id: "emberBlade",
    name: "烬火弯刃",
    quality: "epic",
    attack: 20,
    defense: 2,
    range: 38,
    crit: 0.17,
    dropChance: 0.12,
    color: "#ff8a5c"
  },
  goldHalberd: {
    id: "goldHalberd",
    name: "金纹戟",
    quality: "legendary",
    attack: 21,
    defense: 5,
    range: 46,
    crit: 0.11,
    dropChance: 0.22,
    color: "#ffd56a"
  }
};

export const PLAYER_TEMPLATE = {
  name: "流亡领主",
  level: 1,
  exp: 0,
  skillPoints: 0,
  gold: 240,
  x: 420,
  y: 420,
  facing: "down",
  facingAngle: Math.PI,
  attributes: {
    strength: 6,
    agility: 5,
    intelligence: 4,
    leadership: 7
  },
  equipment: {
    weapon: "旧王短剑",
    armor: "未装备",
    trinket: "未装备"
  },
  general: {
    name: "沈铁冠",
    faction: "player",
    level: 1,
    weapon: "oldSword"
  }
};

export const STARTING_ARMY = [
  { type: "infantry", count: 14, level: 1, xp: 0, morale: 78 },
  { type: "archer", count: 6, level: 1, xp: 0, morale: 72 }
];

export const TOWN_TEMPLATES = [
  {
    id: "graykeep",
    name: "灰石堡",
    kind: "castle",
    x: 650,
    y: 520,
    owner: "neutral",
    defense: 86,
    taxBase: TOWN_INCOME.graykeep,
    recruits: ["infantry", "pikeman", "archer"],
    garrison: [
      { type: "infantry", count: 20, level: 1, xp: 0, morale: 72 },
      { type: "archer", count: 10, level: 1, xp: 0, morale: 68 }
    ],
    general: { name: "陆灰岩", faction: "neutral", level: 1, weapon: "ironSaber" }
  },
  {
    id: "sunford",
    name: "日渡村",
    kind: "village",
    x: 1180,
    y: 840,
    owner: "neutral",
    defense: 38,
    taxBase: TOWN_INCOME.sunford,
    recruits: ["infantry", "archer"],
    garrison: [{ type: "infantry", count: 12, level: 1, xp: 0, morale: 66 }],
    general: { name: "林渡", faction: "neutral", level: 1, weapon: "ironSaber" }
  },
  {
    id: "oakhall",
    name: "橡木酒馆",
    kind: "tavern",
    x: 1720,
    y: 430,
    owner: "neutral",
    defense: 24,
    taxBase: TOWN_INCOME.oakhall,
    recruits: ["cavalry", "mage", "pikeman"],
    garrison: [{ type: "pikeman", count: 8, level: 1, xp: 0, morale: 64 }],
    general: { name: "柏恩", faction: "neutral", level: 1, weapon: "eagleBow" }
  },
  {
    id: "redspire",
    name: "赤脊城",
    kind: "castle",
    x: 1860,
    y: 1150,
    owner: "red",
    defense: 118,
    taxBase: TOWN_INCOME.redspire,
    recruits: ["infantry", "pikeman", "cavalry"],
    garrison: [
      { type: "infantry", count: 24, level: 2, xp: 0, morale: 76 },
      { type: "cavalry", count: 8, level: 1, xp: 0, morale: 78 }
    ],
    general: { name: "赫连赤脊", faction: "red", level: 2, weapon: "wolfAxe" }
  },
  {
    id: "blueharbor",
    name: "蓝港城",
    kind: "castle",
    x: 1120,
    y: 2050,
    owner: "blue",
    defense: 112,
    taxBase: TOWN_INCOME.blueharbor,
    recruits: ["archer", "mage", "infantry"],
    garrison: [
      { type: "archer", count: 18, level: 2, xp: 0, morale: 74 },
      { type: "mage", count: 6, level: 1, xp: 0, morale: 70 }
    ],
    general: { name: "岑蓝港", faction: "blue", level: 2, weapon: "runedStaff" }
  },
  {
    id: "crowmine",
    name: "鸦矿镇",
    kind: "village",
    x: 2920,
    y: 860,
    owner: "red",
    defense: 54,
    taxBase: TOWN_INCOME.crowmine,
    recruits: ["infantry", "pikeman"],
    garrison: [
      { type: "pikeman", count: 14, level: 1, xp: 0, morale: 70 },
      { type: "infantry", count: 8, level: 1, xp: 0, morale: 70 }
    ],
    general: { name: "狄鸦矿", faction: "red", level: 2, weapon: "wolfAxe" }
  },
  {
    id: "northwatch",
    name: "北望寨",
    kind: "castle",
    x: 4520,
    y: 980,
    owner: "blue",
    defense: 96,
    taxBase: TOWN_INCOME.northwatch,
    recruits: ["infantry", "archer", "cavalry"],
    garrison: [
      { type: "infantry", count: 18, level: 2, xp: 0, morale: 74 },
      { type: "archer", count: 14, level: 2, xp: 0, morale: 72 }
    ],
    general: { name: "孟北望", faction: "blue", level: 2, weapon: "eagleBow" }
  },
  {
    id: "goldenfield",
    name: "金穗镇",
    kind: "village",
    x: 3800,
    y: 2850,
    owner: "neutral",
    defense: 44,
    taxBase: TOWN_INCOME.goldenfield,
    recruits: ["infantry", "pikeman"],
    garrison: [
      { type: "infantry", count: 12, level: 1, xp: 0, morale: 68 },
      { type: "pikeman", count: 6, level: 1, xp: 0, morale: 66 }
    ],
    general: { name: "田金穗", faction: "neutral", level: 1, weapon: "goldHalberd" }
  },
  {
    id: "stormgate",
    name: "风暴关",
    kind: "castle",
    x: 5050,
    y: 3900,
    owner: "red",
    defense: 132,
    taxBase: TOWN_INCOME.stormgate,
    recruits: ["pikeman", "cavalry", "mage"],
    garrison: [
      { type: "pikeman", count: 22, level: 2, xp: 0, morale: 76 },
      { type: "cavalry", count: 10, level: 2, xp: 0, morale: 78 }
    ],
    general: { name: "拓跋风门", faction: "red", level: 3, weapon: "goldHalberd" }
  },
  {
    id: "mistport",
    name: "雾港",
    kind: "tavern",
    x: 5460,
    y: 5300,
    owner: "blue",
    defense: 52,
    taxBase: TOWN_INCOME.mistport,
    recruits: ["archer", "mage", "cavalry"],
    garrison: [
      { type: "archer", count: 14, level: 2, xp: 0, morale: 72 },
      { type: "mage", count: 4, level: 2, xp: 0, morale: 70 }
    ],
    general: { name: "苏雾港", faction: "blue", level: 2, weapon: "runedStaff" }
  },
  {
    id: "dawnwatch",
    name: "曦望堡",
    kind: "castle",
    x: 4380,
    y: 1640,
    owner: "blue",
    defense: 104,
    taxBase: TOWN_INCOME.dawnwatch,
    recruits: ["infantry", "archer", "mage"],
    garrison: [
      { type: "infantry", count: 18, level: 2, xp: 0, morale: 74 },
      { type: "mage", count: 5, level: 2, xp: 0, morale: 70 }
    ],
    general: { name: "卫曦望", faction: "blue", level: 2, weapon: "runedStaff" }
  },
  {
    id: "emberfall",
    name: "烬落城",
    kind: "castle",
    x: 2670,
    y: 3180,
    owner: "red",
    defense: 124,
    taxBase: TOWN_INCOME.emberfall,
    recruits: ["infantry", "pikeman", "cavalry"],
    garrison: [
      { type: "pikeman", count: 20, level: 2, xp: 0, morale: 76 },
      { type: "cavalry", count: 8, level: 2, xp: 0, morale: 78 }
    ],
    general: { name: "燕烬落", faction: "red", level: 3, weapon: "wolfAxe" }
  },
  {
    id: "moonwell",
    name: "月井镇",
    kind: "village",
    x: 1900,
    y: 4480,
    owner: "neutral",
    defense: 58,
    taxBase: TOWN_INCOME.moonwell,
    recruits: ["archer", "mage"],
    garrison: [
      { type: "archer", count: 14, level: 2, xp: 0, morale: 72 },
      { type: "infantry", count: 8, level: 1, xp: 0, morale: 68 }
    ],
    general: { name: "闻月井", faction: "neutral", level: 2, weapon: "eagleBow" }
  },
  {
    id: "ironpass",
    name: "铁隘关",
    kind: "castle",
    x: 4870,
    y: 2360,
    owner: "red",
    defense: 136,
    taxBase: TOWN_INCOME.ironpass,
    recruits: ["pikeman", "cavalry", "infantry"],
    garrison: [
      { type: "pikeman", count: 24, level: 2, xp: 0, morale: 78 },
      { type: "infantry", count: 20, level: 2, xp: 0, morale: 76 }
    ],
    general: { name: "武铁隘", faction: "red", level: 3, weapon: "goldHalberd" }
  },
  {
    id: "jadecross",
    name: "青岚驿",
    kind: "tavern",
    x: 2540,
    y: 4960,
    owner: "neutral",
    defense: 44,
    taxBase: TOWN_INCOME.jadecross,
    recruits: ["cavalry", "archer", "mage"],
    garrison: [
      { type: "archer", count: 10, level: 1, xp: 0, morale: 68 },
      { type: "cavalry", count: 4, level: 1, xp: 0, morale: 70 }
    ],
    general: { name: "裴青岚", faction: "neutral", level: 2, weapon: "eagleBow" }
  },
  {
    id: "frostford",
    name: "霜渡营",
    kind: "castle",
    x: 1240,
    y: 3160,
    owner: "blue",
    defense: 108,
    taxBase: TOWN_INCOME.frostford,
    recruits: ["infantry", "archer", "pikeman"],
    garrison: [
      { type: "infantry", count: 18, level: 2, xp: 0, morale: 74 },
      { type: "archer", count: 12, level: 2, xp: 0, morale: 72 }
    ],
    general: { name: "岑霜渡", faction: "blue", level: 2, weapon: "eagleBow" }
  },
  {
    id: "starhaven",
    name: "星坞",
    kind: "village",
    x: 5240,
    y: 1420,
    owner: "neutral",
    defense: 48,
    taxBase: TOWN_INCOME.starhaven,
    recruits: ["infantry", "mage"],
    garrison: [
      { type: "infantry", count: 12, level: 1, xp: 0, morale: 68 },
      { type: "mage", count: 3, level: 1, xp: 0, morale: 66 }
    ],
    general: { name: "洛星坞", faction: "neutral", level: 1, weapon: "runedStaff" }
  },
  {
    id: "ravenrock",
    name: "玄岩寨",
    kind: "castle",
    x: 3440,
    y: 5480,
    owner: "red",
    defense: 114,
    taxBase: TOWN_INCOME.ravenrock,
    recruits: ["pikeman", "infantry", "cavalry"],
    garrison: [
      { type: "pikeman", count: 20, level: 2, xp: 0, morale: 74 },
      { type: "cavalry", count: 7, level: 2, xp: 0, morale: 76 }
    ],
    general: { name: "狄玄岩", faction: "red", level: 2, weapon: "wolfAxe" }
  }
];

export const RESOURCE_TEMPLATES = [
  { id: "northmine", name: "北岭矿山", kind: "mine", x: 520, y: 250, owner: "neutral", income: RESOURCE_INCOME.northmine, captureTime: 3.5 },
  { id: "southfarm", name: "南谷农场", kind: "farm", x: 1040, y: 670, owner: "neutral", income: RESOURCE_INCOME.southfarm, captureTime: 2.6 },
  { id: "silverpit", name: "银砂矿场", kind: "mine", x: 1460, y: 1010, owner: "neutral", income: RESOURCE_INCOME.silverpit, captureTime: 4 },
  { id: "riverfarm", name: "河湾农庄", kind: "farm", x: 2080, y: 760, owner: "neutral", income: RESOURCE_INCOME.riverfarm, captureTime: 2.8 },
  { id: "westmine", name: "西脊矿坑", kind: "mine", x: 3300, y: 1320, owner: "neutral", income: RESOURCE_INCOME.westmine, captureTime: 4.2 },
  { id: "eastfarm", name: "东原农庄", kind: "farm", x: 4140, y: 2420, owner: "neutral", income: RESOURCE_INCOME.eastfarm, captureTime: 3 },
  { id: "mistmine", name: "雾港银井", kind: "mine", x: 5520, y: 4980, owner: "neutral", income: RESOURCE_INCOME.mistmine, captureTime: 4.4 },
  { id: "dawnfarm", name: "曦光麦田", kind: "farm", x: 4240, y: 1840, owner: "neutral", income: RESOURCE_INCOME.dawnfarm, captureTime: 3 },
  { id: "ambermine", name: "琥珀矿脉", kind: "mine", x: 2860, y: 3460, owner: "neutral", income: RESOURCE_INCOME.ambermine, captureTime: 4.6 },
  { id: "moonorchard", name: "月井果园", kind: "farm", x: 1760, y: 4240, owner: "neutral", income: RESOURCE_INCOME.moonorchard, captureTime: 3.1 },
  { id: "frostmine", name: "霜铁矿井", kind: "mine", x: 940, y: 3460, owner: "neutral", income: RESOURCE_INCOME.frostmine, captureTime: 4.3 },
  { id: "jadefarm", name: "青岚牧场", kind: "farm", x: 2360, y: 5180, owner: "neutral", income: RESOURCE_INCOME.jadefarm, captureTime: 3.2 },
  { id: "ravenquarry", name: "玄岩采石场", kind: "mine", x: 3600, y: 5260, owner: "neutral", income: RESOURCE_INCOME.ravenquarry, captureTime: 4.5 }
];
