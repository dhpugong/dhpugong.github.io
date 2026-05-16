import { GENERAL_ATTRIBUTE_RANGES } from "../data/generals.js";
import { randInt } from "./utils.js";

export function applyRandomGeneralAttributes(general) {
  if (!general || general.faction === "player") {
    return general;
  }
  if (general.attributes) {
    return general;
  }

  const ranges = GENERAL_ATTRIBUTE_RANGES[general.faction] || GENERAL_ATTRIBUTE_RANGES.neutral;
  general.attributes = {
    strength: randInt(ranges.strength.min, ranges.strength.max),
    agility: randInt(ranges.agility.min, ranges.agility.max),
    intelligence: randInt(ranges.intelligence.min, ranges.intelligence.max),
    leadership: randInt(ranges.leadership.min, ranges.leadership.max)
  };
  return general;
}

export function getGeneralBattleBonus(general) {
  const attrs = general && general.attributes
    ? general.attributes
    : { strength: 0, agility: 0, intelligence: 0, leadership: 0 };
  return {
    attack: attrs.strength * 1.2 + attrs.intelligence * 0.6,
    defense: attrs.leadership * 0.7,
    hp: attrs.leadership * 8 + attrs.strength * 3,
    speed: attrs.agility * 0.9,
    crit: attrs.agility * 0.006 + attrs.intelligence * 0.003
  };
}
