export const FACTION_GROWTH_RANGES = {
  wild: {
    interval: { min: 38, max: 48 },
    levelGain: { min: 0.12, max: 0.24 },
    primary: "infantry",
    secondary: "archer",
    primaryCount: { min: 1, max: 2 },
    secondaryCount: { min: 1, max: 2 },
    upgradeChance: { min: 0.04, max: 0.1 },
    upgradeBudget: { min: 1, max: 1 },
    scale: { min: 0.45, max: 0.7 },
    morale: { min: 60, max: 66 },
    mobilizeChance: { min: 0, max: 0 }
  },
  red: {
    interval: { min: 36, max: 46 },
    levelGain: { min: 0.16, max: 0.28 },
    primary: "cavalry",
    secondary: "infantry",
    primaryCount: { min: 1, max: 2 },
    secondaryCount: { min: 2, max: 4 },
    upgradeChance: { min: 0.1, max: 0.18 },
    upgradeBudget: { min: 1, max: 2 },
    scale: { min: 0.55, max: 0.8 },
    morale: { min: 73, max: 79 },
    mobilizeChance: { min: 0.08, max: 0.16 }
  },
  blue: {
    interval: { min: 40, max: 50 },
    levelGain: { min: 0.14, max: 0.24 },
    primary: "archer",
    secondary: "mage",
    primaryCount: { min: 2, max: 3 },
    secondaryCount: { min: 1, max: 1 },
    upgradeChance: { min: 0.08, max: 0.16 },
    upgradeBudget: { min: 1, max: 2 },
    scale: { min: 0.45, max: 0.7 },
    morale: { min: 71, max: 77 },
    mobilizeChance: { min: 0.06, max: 0.14 }
  },
  neutral: {
    interval: { min: 46, max: 58 },
    levelGain: { min: 0.08, max: 0.18 },
    primary: "pikeman",
    secondary: "infantry",
    primaryCount: { min: 1, max: 2 },
    secondaryCount: { min: 1, max: 3 },
    upgradeChance: { min: 0.04, max: 0.1 },
    upgradeBudget: { min: 1, max: 1 },
    scale: { min: 0.35, max: 0.55 },
    morale: { min: 65, max: 70 },
    mobilizeChance: { min: 0.02, max: 0.08 }
  }
};
