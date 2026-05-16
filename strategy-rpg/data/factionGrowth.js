export const FACTION_GROWTH_RANGES = {
  wild: {
    interval: { min: 28, max: 34 },
    levelGain: { min: 0.25, max: 0.45 },
    primary: "infantry",
    secondary: "archer",
    primaryCount: { min: 1, max: 3 },
    secondaryCount: { min: 1, max: 2 },
    scale: { min: 0.8, max: 1.2 },
    morale: { min: 60, max: 66 },
    mobilizeChance: { min: 0, max: 0 }
  },
  red: {
    interval: { min: 21, max: 27 },
    levelGain: { min: 0.42, max: 0.62 },
    primary: "cavalry",
    secondary: "infantry",
    primaryCount: { min: 2, max: 4 },
    secondaryCount: { min: 3, max: 6 },
    scale: { min: 1.0, max: 1.45 },
    morale: { min: 73, max: 79 },
    mobilizeChance: { min: 0.2, max: 0.35 }
  },
  blue: {
    interval: { min: 25, max: 31 },
    levelGain: { min: 0.34, max: 0.52 },
    primary: "archer",
    secondary: "mage",
    primaryCount: { min: 3, max: 5 },
    secondaryCount: { min: 1, max: 2 },
    scale: { min: 0.85, max: 1.2 },
    morale: { min: 71, max: 77 },
    mobilizeChance: { min: 0.15, max: 0.28 }
  },
  neutral: {
    interval: { min: 31, max: 38 },
    levelGain: { min: 0.18, max: 0.32 },
    primary: "pikeman",
    secondary: "infantry",
    primaryCount: { min: 1, max: 3 },
    secondaryCount: { min: 2, max: 4 },
    scale: { min: 0.55, max: 0.85 },
    morale: { min: 65, max: 70 },
    mobilizeChance: { min: 0.06, max: 0.16 }
  }
};
