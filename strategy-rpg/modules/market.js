import { WEAPONS } from "./config.js";

export const TRADE_GOODS = {
  grain: {
    id: "grain",
    name: "麦谷",
    basePrice: 18,
    color: "#d6c06a",
    description: "村镇常见粮食，军镇和关隘缺粮时价格更高。",
    supplyKinds: ["village"],
    demandKinds: ["castle", "tavern"],
    supplyTowns: ["sunford", "goldenfield", "moonwell"],
    demandTowns: ["stormgate", "ironpass", "frostford"]
  },
  ironOre: {
    id: "ironOre",
    name: "铁矿石",
    basePrice: 42,
    color: "#9ea0a3",
    description: "打造兵器和城防的硬通货，矿镇便宜，前线城堡高价收购。",
    supplyKinds: [],
    demandKinds: ["castle"],
    supplyTowns: ["crowmine", "ironpass", "ravenrock"],
    demandTowns: ["redspire", "stormgate", "frostford"]
  },
  salt: {
    id: "salt",
    name: "盐砖",
    basePrice: 36,
    color: "#e8e0c8",
    description: "便于长途运输的民生物资，各城需求稳定。",
    supplyKinds: ["tavern"],
    demandKinds: ["village", "castle"],
    supplyTowns: ["mistport", "jadecross"],
    demandTowns: ["graykeep", "emberfall", "northwatch"]
  },
  wool: {
    id: "wool",
    name: "羊毛",
    basePrice: 28,
    color: "#d8d2c6",
    description: "边地牧场出产的布料原料，寒地营寨收购价不错。",
    supplyKinds: ["village"],
    demandKinds: ["castle"],
    supplyTowns: ["jadecross", "goldenfield"],
    demandTowns: ["frostford", "northwatch"]
  },
  tea: {
    id: "tea",
    name: "山茶",
    basePrice: 56,
    color: "#78b85f",
    description: "青山驿路上的精致货物，酒馆和港城更愿意出高价。",
    supplyKinds: ["village"],
    demandKinds: ["tavern"],
    supplyTowns: ["starhaven", "moonwell"],
    demandTowns: ["oakhall", "mistport", "jadecross"]
  },
  herbs: {
    id: "herbs",
    name: "药草",
    basePrice: 48,
    color: "#74d17a",
    description: "行军医师常备药材，战事频繁的城池需求很高。",
    supplyKinds: ["village"],
    demandKinds: ["castle"],
    supplyTowns: ["oakhall", "starhaven", "moonwell"],
    demandTowns: ["redspire", "emberfall", "ironpass"]
  },
  wine: {
    id: "wine",
    name: "果酒",
    basePrice: 64,
    color: "#d66a8a",
    description: "酒馆低价流通的享乐品，守军驻地往往买得更贵。",
    supplyKinds: ["tavern"],
    demandKinds: ["castle"],
    supplyTowns: ["oakhall", "mistport"],
    demandTowns: ["graykeep", "stormgate", "dawnwatch"]
  },
  silk: {
    id: "silk",
    name: "丝绸",
    basePrice: 92,
    color: "#f3c9ff",
    description: "轻而贵的奢侈品，适合高风险长途倒卖。",
    supplyKinds: ["tavern"],
    demandKinds: ["castle"],
    supplyTowns: ["blueharbor", "mistport", "jadecross"],
    demandTowns: ["redspire", "stormgate", "ravenrock"]
  },
  amber: {
    id: "amber",
    name: "琥珀",
    basePrice: 118,
    color: "#ffb347",
    description: "矿脉与古林间产出的贵重饰材，远离产地时溢价明显。",
    supplyKinds: [],
    demandKinds: ["tavern", "castle"],
    supplyTowns: ["emberfall", "ravenrock"],
    demandTowns: ["blueharbor", "mistport", "jadecross"]
  },
  horseTack: {
    id: "horseTack",
    name: "马具",
    basePrice: 76,
    color: "#c49a68",
    description: "骑兵和商队都需要的货物，关隘与驿站价格起伏大。",
    supplyKinds: ["tavern"],
    demandKinds: ["castle"],
    supplyTowns: ["jadecross", "oakhall"],
    demandTowns: ["stormgate", "redspire", "northwatch"]
  }
};

export function ensurePlayerGoods(player) {
  if (!player.goods || typeof player.goods !== "object" || Array.isArray(player.goods)) {
    player.goods = {};
  }
  for (const id of Object.keys(player.goods)) {
    if (!TRADE_GOODS[id] || player.goods[id] <= 0) {
      delete player.goods[id];
    } else {
      player.goods[id] = Math.floor(player.goods[id]);
    }
  }
}

export function getTownSellListings(game, town) {
  const day = getMarketDay(game);
  const goods = Object.values(TRADE_GOODS)
    .map((item) => ({
      kind: "good",
      id: item.id,
      item,
      price: getTownItemBuyPrice(game, town, "good", item.id),
      score: marketRandom(town.id + ":" + day + ":" + item.id + ":stock")
    }))
    .filter((entry) => isGoodAvailable(town, entry.item, entry.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, getGoodsSlotCount(town, day));

  const weapons = Object.values(WEAPONS)
    .filter((weapon) => weapon.id !== "oldSword")
    .map((weapon) => ({
      kind: "weapon",
      id: weapon.id,
      item: weapon,
      price: getTownItemBuyPrice(game, town, "weapon", weapon.id),
      score: marketRandom(town.id + ":" + day + ":" + weapon.id + ":gear")
    }))
    .filter((entry) => entry.score > getWeaponAvailabilityFloor(town, entry.item))
    .sort((a, b) => b.score - a.score)
    .slice(0, town.kind === "castle" ? 2 : 1);

  return goods.concat(weapons).sort((a, b) => a.price - b.price);
}

export function getPlayerSellListings(game, town) {
  const player = game.player;
  ensurePlayerGoods(player);
  const goods = Object.keys(player.goods)
    .filter((id) => player.goods[id] > 0 && TRADE_GOODS[id])
    .map((id) => ({
      kind: "good",
      id,
      item: TRADE_GOODS[id],
      count: player.goods[id],
      price: getTownItemSellPrice(game, town, "good", id)
    }));

  const weaponCounts = {};
  for (const id of player.inventory || []) {
    if (WEAPONS[id]) {
      weaponCounts[id] = (weaponCounts[id] || 0) + 1;
    }
  }
  const weapons = Object.keys(weaponCounts)
    .map((id) => ({
      kind: "weapon",
      id,
      item: WEAPONS[id],
      count: weaponCounts[id],
      price: getTownItemSellPrice(game, town, "weapon", id)
    }));

  return goods.concat(weapons).sort((a, b) => a.item.name.localeCompare(b.item.name, "zh-Hans-CN"));
}

export function buyMarketItem(game, town, kind, id) {
  const listing = getTownSellListings(game, town).find((entry) => entry.kind === kind && entry.id === id);
  if (!listing) {
    return { ok: false, message: "今日没有出售这件货物" };
  }
  if (game.player.gold < listing.price) {
    return { ok: false, message: "金币不足" };
  }
  if (kind === "weapon" && playerHasWeapon(game.player, id)) {
    return { ok: false, message: "背包里已有这件装备" };
  }

  game.player.gold -= listing.price;
  if (kind === "good") {
    ensurePlayerGoods(game.player);
    game.player.goods[id] = (game.player.goods[id] || 0) + 1;
  } else {
    if (!game.player.inventory) {
      game.player.inventory = [];
    }
    game.player.inventory.push(id);
  }
  return { ok: true, message: "买入 " + listing.item.name + "，花费 " + listing.price + " 金" };
}

export function sellMarketItem(game, town, kind, id) {
  const price = getTownItemSellPrice(game, town, kind, id);
  const item = getMarketItem(kind, id);
  if (!item) {
    return { ok: false, message: "未知货物" };
  }

  if (kind === "good") {
    ensurePlayerGoods(game.player);
    if ((game.player.goods[id] || 0) <= 0) {
      return { ok: false, message: "没有这件商品" };
    }
    game.player.goods[id] -= 1;
    if (game.player.goods[id] <= 0) {
      delete game.player.goods[id];
    }
  } else if (!removeOneWeapon(game.player, id)) {
    return { ok: false, message: "背包里没有这件装备" };
  }

  game.player.gold += price;
  return { ok: true, message: "卖出 " + item.name + "，获得 " + price + " 金" };
}

export function getMarketItem(kind, id) {
  if (kind === "good") {
    return TRADE_GOODS[id] || null;
  }
  if (kind === "weapon") {
    return WEAPONS[id] || null;
  }
  return null;
}

export function getTownItemBuyPrice(game, town, kind, id) {
  const item = getMarketItem(kind, id);
  if (!item) {
    return 0;
  }
  const basePrice = getBasePrice(kind, item);
  const day = getMarketDay(game);
  const regional = getRegionalModifier(town, kind, item);
  const daily = 0.82 + marketRandom(town.id + ":" + day + ":" + kind + ":" + id + ":buy") * 0.42;
  return Math.max(1, Math.round(basePrice * regional * daily));
}

export function getTownItemSellPrice(game, town, kind, id) {
  const buyPrice = getTownItemBuyPrice(game, town, kind, id);
  const day = getMarketDay(game);
  const ratio = 0.8 + marketRandom(town.id + ":" + day + ":" + kind + ":" + id + ":sell") * 0.1;
  return Math.max(1, Math.floor(buyPrice * ratio));
}

function getMarketDay(game) {
  return game && game.player ? Math.max(1, Math.floor(game.player.day || 1)) : 1;
}

function isGoodAvailable(town, item, score) {
  let threshold = 0.44;
  if ((item.supplyKinds || []).includes(town.kind)) {
    threshold -= 0.18;
  }
  if ((item.supplyTowns || []).includes(town.id)) {
    threshold -= 0.24;
  }
  return score > Math.max(0.12, threshold);
}

function getGoodsSlotCount(town, day) {
  const base = town.kind === "castle" ? 6 : town.kind === "tavern" ? 5 : 4;
  return base + Math.floor(marketRandom(town.id + ":" + day + ":slots") * 2);
}

function getWeaponAvailabilityFloor(town, weapon) {
  let floor = town.kind === "castle" ? 0.56 : town.kind === "tavern" ? 0.72 : 0.82;
  if (weapon.quality === "legendary") {
    floor += 0.12;
  } else if (weapon.quality === "common") {
    floor -= 0.1;
  }
  return Math.min(0.94, floor);
}

function getRegionalModifier(town, kind, item) {
  let modifier = 1;
  if (kind === "good") {
    if ((item.supplyKinds || []).includes(town.kind)) {
      modifier -= 0.16;
    }
    if ((item.demandKinds || []).includes(town.kind)) {
      modifier += 0.16;
    }
    if ((item.supplyTowns || []).includes(town.id)) {
      modifier -= 0.28;
    }
    if ((item.demandTowns || []).includes(town.id)) {
      modifier += 0.3;
    }
  } else if (kind === "weapon") {
    modifier += town.kind === "castle" ? -0.06 : 0.12;
    modifier += item.quality === "legendary" ? 0.18 : item.quality === "epic" ? 0.1 : 0;
  }
  return Math.max(0.58, modifier);
}

function getBasePrice(kind, item) {
  if (kind === "good") {
    return item.basePrice;
  }
  if (typeof item.basePrice === "number") {
    return item.basePrice;
  }
  return Math.round(45 + item.attack * 14 + item.defense * 12 + item.range * 0.7 + item.crit * 220);
}

function playerHasWeapon(player, id) {
  return (player.inventory || []).includes(id) || (player.general && player.general.weapon === id);
}

function removeOneWeapon(player, id) {
  if (!player.inventory) {
    player.inventory = [];
    return false;
  }
  const index = player.inventory.indexOf(id);
  if (index < 0) {
    return false;
  }
  player.inventory.splice(index, 1);
  return true;
}

function marketRandom(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}
