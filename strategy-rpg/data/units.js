export const TROOP_TYPES_DATA = {
  infantry: {
    id: "infantry",
    name: "步兵",
    icon: "盾",
    cost: 28,
    upkeep: 2,
    hp: 34,
    attack: 7,
    defense: 4,
    range: 26,
    speed: 30,
    morale: 74,
    crit: 0.06,
    color: "#b7b0a1",
    role: "前排坚守"
  },
  pikeman: {
    id: "pikeman",
    name: "长枪兵",
    icon: "枪",
    cost: 34,
    upkeep: 3,
    hp: 30,
    attack: 9,
    defense: 3,
    range: 42,
    speed: 27,
    morale: 72,
    crit: 0.07,
    color: "#95b9b0",
    role: "反骑突刺"
  },
  archer: {
    id: "archer",
    name: "弓箭手",
    icon: "弓",
    cost: 38,
    upkeep: 3,
    hp: 22,
    attack: 7,
    defense: 1,
    range: 168,
    speed: 24,
    morale: 68,
    crit: 0.12,
    color: "#76a767",
    role: "远程压制"
  },
  cavalry: {
    id: "cavalry",
    name: "骑兵",
    icon: "骑",
    cost: 72,
    upkeep: 6,
    hp: 42,
    attack: 13,
    defense: 3,
    range: 34,
    speed: 56,
    morale: 78,
    crit: 0.14,
    color: "#c8944b",
    role: "高速冲锋"
  },
  mage: {
    id: "mage",
    name: "法师",
    icon: "法",
    cost: 90,
    upkeep: 8,
    hp: 20,
    attack: 15,
    defense: 1,
    range: 146,
    speed: 22,
    morale: 64,
    crit: 0.16,
    color: "#9b73d8",
    role: "范围法术"
  }
};

export const TROOP_LEVEL_STATS = {
  infantry: {
    levels: {
      1: { hp: 36, attack: 7, defense: 5, range: 26, speed: 28, crit: 0.05, upkeep: 2, upgradeCost: 0 },
      2: { hp: 44, attack: 8, defense: 7, range: 26, speed: 28, crit: 0.055, upkeep: 3, upgradeCost: 18 },
      3: { hp: 54, attack: 10, defense: 9, range: 27, speed: 27, crit: 0.06, upkeep: 4, upgradeCost: 32 },
      4: { hp: 66, attack: 12, defense: 12, range: 27, speed: 27, crit: 0.065, upkeep: 5, upgradeCost: 52 },
      5: { hp: 82, attack: 15, defense: 16, range: 28, speed: 26, crit: 0.07, upkeep: 7, upgradeCost: 0 }
    }
  },
  pikeman: {
    levels: {
      1: { hp: 30, attack: 9, defense: 3, range: 42, speed: 27, crit: 0.07, upkeep: 3, upgradeCost: 0 },
      2: { hp: 35, attack: 12, defense: 4, range: 46, speed: 27, crit: 0.08, upkeep: 4, upgradeCost: 24 },
      3: { hp: 40, attack: 15, defense: 6, range: 50, speed: 26, crit: 0.09, upkeep: 5, upgradeCost: 42 },
      4: { hp: 47, attack: 19, defense: 8, range: 54, speed: 26, crit: 0.1, upkeep: 7, upgradeCost: 68 },
      5: { hp: 55, attack: 24, defense: 10, range: 58, speed: 25, crit: 0.11, upkeep: 9, upgradeCost: 0 }
    }
  },
  archer: {
    levels: {
      1: { hp: 22, attack: 7, defense: 1, range: 168, speed: 24, crit: 0.12, upkeep: 3, upgradeCost: 0 },
      2: { hp: 25, attack: 9, defense: 1, range: 184, speed: 24, crit: 0.15, upkeep: 4, upgradeCost: 26 },
      3: { hp: 29, attack: 12, defense: 2, range: 202, speed: 23, crit: 0.18, upkeep: 5, upgradeCost: 46 },
      4: { hp: 33, attack: 15, defense: 2, range: 220, speed: 23, crit: 0.22, upkeep: 7, upgradeCost: 74 },
      5: { hp: 38, attack: 19, defense: 3, range: 240, speed: 22, crit: 0.27, upkeep: 9, upgradeCost: 0 }
    }
  },
  cavalry: {
    levels: {
      1: { hp: 42, attack: 13, defense: 3, range: 34, speed: 56, crit: 0.14, upkeep: 6, upgradeCost: 0 },
      2: { hp: 50, attack: 17, defense: 4, range: 36, speed: 62, crit: 0.16, upkeep: 8, upgradeCost: 52 },
      3: { hp: 60, attack: 22, defense: 6, range: 38, speed: 68, crit: 0.19, upkeep: 11, upgradeCost: 88 },
      4: { hp: 72, attack: 28, defense: 8, range: 40, speed: 74, crit: 0.22, upkeep: 15, upgradeCost: 136 },
      5: { hp: 88, attack: 36, defense: 11, range: 42, speed: 82, crit: 0.26, upkeep: 20, upgradeCost: 0 }
    }
  },
  mage: {
    levels: {
      1: { hp: 20, attack: 15, defense: 1, range: 146, speed: 22, crit: 0.16, upkeep: 8, upgradeCost: 0 },
      2: { hp: 23, attack: 21, defense: 1, range: 158, speed: 22, crit: 0.18, upkeep: 11, upgradeCost: 70 },
      3: { hp: 27, attack: 28, defense: 2, range: 172, speed: 21, crit: 0.2, upkeep: 15, upgradeCost: 118 },
      4: { hp: 31, attack: 37, defense: 2, range: 188, speed: 21, crit: 0.23, upkeep: 20, upgradeCost: 178 },
      5: { hp: 36, attack: 48, defense: 3, range: 206, speed: 20, crit: 0.27, upkeep: 27, upgradeCost: 0 }
    }
  }
};
