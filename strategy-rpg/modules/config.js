import { TOWN_INCOME, RESOURCE_INCOME } from "../data/economy.js";
import { TROOP_TYPES_DATA } from "../data/units.js";

// 全局配置：集中管理尺寸、颜色、兵种、技能和初始城池，方便二次开发。
export const CONFIG = {
  canvasWidth: 960,
  canvasHeight: 540,
  tileSize: 32,
  mapCols: 112,
  mapRows: 66,
  playerSpeed: 118,
  cameraLerp: 0.12,
  clickArriveDistance: 6,
  autoSaveInterval: 14,
  wildSpawnInterval: 22,
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
  forest: { id: 1, name: "森林", color: "#284727", passable: true, speed: 0.72 },
  hill: { id: 2, name: "丘陵", color: "#6a5b38", passable: true, speed: 0.82 },
  mountain: { id: 3, name: "山脉", color: "#34312d", passable: false, speed: 0 },
  water: { id: 4, name: "水域", color: "#1e405d", passable: false, speed: 0 },
  road: { id: 5, name: "道路", color: "#8a6b3d", passable: true, speed: 1.2 }
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
  y: 360,
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
    x: 720,
    y: 1310,
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
    x: 2080,
    y: 250,
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
    x: 2700,
    y: 520,
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
    x: 2440,
    y: 1460,
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
    x: 3120,
    y: 1080,
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
    x: 3300,
    y: 1700,
    owner: "blue",
    defense: 52,
    taxBase: TOWN_INCOME.mistport,
    recruits: ["archer", "mage", "cavalry"],
    garrison: [
      { type: "archer", count: 14, level: 2, xp: 0, morale: 72 },
      { type: "mage", count: 4, level: 2, xp: 0, morale: 70 }
    ],
    general: { name: "苏雾港", faction: "blue", level: 2, weapon: "runedStaff" }
  }
];

export const RESOURCE_TEMPLATES = [
  { id: "northmine", name: "北岭矿山", kind: "mine", x: 520, y: 250, owner: "neutral", income: RESOURCE_INCOME.northmine, captureTime: 3.5 },
  { id: "southfarm", name: "南谷农场", kind: "farm", x: 1040, y: 670, owner: "neutral", income: RESOURCE_INCOME.southfarm, captureTime: 2.6 },
  { id: "silverpit", name: "银砂矿场", kind: "mine", x: 1460, y: 1010, owner: "neutral", income: RESOURCE_INCOME.silverpit, captureTime: 4 },
  { id: "riverfarm", name: "河湾农庄", kind: "farm", x: 2080, y: 760, owner: "neutral", income: RESOURCE_INCOME.riverfarm, captureTime: 2.8 },
  { id: "westmine", name: "西脊矿坑", kind: "mine", x: 2780, y: 860, owner: "neutral", income: RESOURCE_INCOME.westmine, captureTime: 4.2 },
  { id: "eastfarm", name: "东原农庄", kind: "farm", x: 3040, y: 1450, owner: "neutral", income: RESOURCE_INCOME.eastfarm, captureTime: 3 },
  { id: "mistmine", name: "雾港银井", kind: "mine", x: 3400, y: 1840, owner: "neutral", income: RESOURCE_INCOME.mistmine, captureTime: 4.4 }
];
