import { CONFIG } from "../config.js";
import { ensurePlayerGoods, getMarketItem, getPlayerSellListings, getTownSellListings } from "../market.js";
import { drawPanel, drawPixelText, rectContains } from "../utils.js";
import { MARKET_PAGE_SIZE, UI_TEXT, addButton, addPanelCloseButton, drawInlinePager, getPagedListPage, wrapText } from "./uiCore.js";
import { formatEquipmentStats, getEquipmentNameColor, getEquipmentSlotName, getQualityName, isEquipmentKind, playerOwnsEquipment } from "./equipmentUi.js";

export function drawTownTradeView(ctx, game, town) {
  ensurePlayerGoods(game.player);
  const townListings = getTownSellListings(game, town);
  const playerListings = getPlayerSellListings(game, town);
  const townPage = getPagedListPage(game.ui, "marketBuyPage", townListings.length, MARKET_PAGE_SIZE);
  const playerPage = getPagedListPage(game.ui, "marketSellPage", playerListings.length, MARKET_PAGE_SIZE);

  drawPixelText(ctx, "城市出售", 168, 168, "#ffd56a", 14);
  drawPixelText(ctx, "背包出售", 506, 168, "#ffd56a", 14);
  drawInlinePager(ctx, game, townListings.length, townPage, MARKET_PAGE_SIZE, 330, 164, "marketBuyPage");
  drawInlinePager(ctx, game, playerListings.length, playerPage, MARKET_PAGE_SIZE, 668, 164, "marketSellPage");
  drawMarketList(ctx, game, townListings, townPage, 168, 190, "buyMarket", true);
  drawMarketList(ctx, game, playerListings, playerPage, 506, 190, "sellMarket", false);
  drawPixelText(ctx, "收购价为当日售价的 80%-90%，不同城市价格不同。", 168, 452, UI_TEXT.muted, 11);
  addButton(game.ui, 592, 448, 78, 32, "返回", "townView:home");
  addButton(game.ui, 684, 448, 78, 32, "招募", "townView:recruit");
}

export function drawMarketList(ctx, game, listings, page, x, y, actionPrefix, buying) {
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(x, y - 8, 286, 238);
  ctx.strokeStyle = "rgba(143,104,46,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y - 7.5, 286, 238);

  if (!listings.length) {
    drawPixelText(ctx, buying ? "今日无货" : "背包无可出售物品", x + 143, y + 92, UI_TEXT.empty, 12, "center");
    return;
  }

  const start = page * MARKET_PAGE_SIZE;
  listings.slice(start, start + MARKET_PAGE_SIZE).forEach(function (listing, index) {
    const rowY = y + index * 32;
    const item = listing.item;
    const selected = getSelectedMarketKey(game) === getMarketKey(listing.kind, listing.id);
    const rowRect = { x, y: rowY - 4, w: 202, h: 28 };
    const rowCenterY = rowRect.y + rowRect.h / 2;
    const textY = rowRect.y + 8;
    const priceX = rowRect.x + rowRect.w - 6;
    const hovered = game.input && rectContains(rowRect, game.input.mouse.x, game.input.mouse.y);

    ctx.fillStyle = selected ? "rgba(255,213,106,0.13)" : hovered ? "rgba(138,98,54,0.24)" : "rgba(255,255,255,0.025)";
    ctx.fillRect(rowRect.x, rowRect.y, rowRect.w, rowRect.h);
    ctx.strokeStyle = selected ? "#ffd56a" : hovered ? "#d6a84f" : "rgba(143,104,46,0.32)";
    ctx.strokeRect(rowRect.x + 0.5, rowRect.y + 0.5, rowRect.w, rowRect.h);

    drawMarketIcon(ctx, item, x + 14, rowCenterY, listing.kind);
    drawPixelText(ctx, item.name + (listing.count ? " x" + listing.count : ""), x + 30, textY, getMarketItemColor(listing), 12);
    drawPixelText(ctx, listing.price + "金", priceX, textY, buying ? "#ffd56a" : "#74d17a", 12, "right");
    const disabled = buying && (game.player.gold < listing.price || (isEquipmentKind(listing.kind) && playerOwnsMarketItem(game.player, listing.kind, listing.id)));
    addButton(game.ui, rowRect.x, rowRect.y, rowRect.w, rowRect.h, item.name, "selectMarketItem:" + listing.kind + ":" + listing.id, false, true);
    addButton(game.ui, x + 214, rowY - 3, 58, 26, buying ? "买入" : "卖出", actionPrefix + ":" + listing.kind + ":" + listing.id, disabled);
  });
}

export function drawMarketIcon(ctx, item, x, y, kind) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(x - 7, y - 7, 14, 14);
  ctx.strokeStyle = isEquipmentKind(kind) ? getEquipmentNameColor(item) : item.color || UI_TEXT.body;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 6.5, y - 6.5, 14, 14);
  ctx.fillStyle = isEquipmentKind(kind) ? getEquipmentNameColor(item) : item.color || UI_TEXT.body;
  if (kind === "weapon") {
    ctx.fillRect(x - 1, y - 7, 3, 12);
    ctx.fillRect(x - 5, y - 4, 11, 2);
  } else if (kind === "armor") {
    ctx.fillRect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(x - 2, y - 2, 4, 7);
  } else if (kind === "trinket") {
    ctx.fillRect(x - 3, y - 5, 6, 3);
    ctx.fillRect(x - 4, y - 1, 8, 8);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x - 1, y + 1, 2, 2);
  } else {
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(x - 2, y - 3, 3, 2);
  }
  ctx.restore();
}

export function drawMarketDetailPopup(ctx, game) {
  const selected = getSelectedMarketItem(game);
  if (!selected) {
    return;
  }

  const x = 306;
  const y = 144;
  const w = 348;
  const h = 248;
  const item = selected.item;
  const isEquipment = isEquipmentKind(selected.kind);

  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  addButton(game.ui, 0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight, "关闭物品信息", "closeMarketDetail", false, true);
  drawPanel(ctx, x, y, w, h, isEquipment ? "装备信息" : "商品信息", "town");
  addPanelCloseButton(game.ui, x, y, w, "closeMarketDetail");

  const contentX = x + 34;
  const contentY = y + 44;
  drawMarketIcon(ctx, item, contentX + 12, contentY + 12, selected.kind);
  drawPixelText(ctx, item.name, contentX + 36, contentY, getMarketItemColor(selected), 20);
  drawPixelText(ctx, isEquipment ? getQualityName(item) + " / " + getEquipmentSlotName(item) : "跑商商品", contentX + 36, contentY + 32, UI_TEXT.muted, 12);

  const boxY = contentY + 62;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(contentX, boxY, w - 68, 92);
  ctx.strokeStyle = "rgba(143,104,46,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(contentX + 0.5, boxY + 0.5, w - 68, 92);

  if (isEquipment) {
    formatEquipmentStats(item).forEach(function (line, index) {
      const col = index % 2;
      const row = Math.floor(index / 2);
      drawPixelText(ctx, line, contentX + 18 + col * 132, boxY + 16 + row * 22, UI_TEXT.main, 13);
    });
  } else {
    wrapText(item.description || "可用于城市间贸易。", 17).slice(0, 4).forEach(function (line, index) {
      drawPixelText(ctx, line, contentX + 18, boxY + 16 + index * 19, UI_TEXT.main, 12);
    });
  }

  const priceLine = getMarketPriceLine(game, selected);
  if (priceLine) {
    drawPixelText(ctx, priceLine, contentX + 18, y + h - 60, "#ffd56a", 13);
  }
}

export function getSelectedMarketItem(game) {
  const selected = game.ui && game.ui.selectedMarketItem;
  if (!selected) {
    return null;
  }
  const item = getMarketItem(selected.kind, selected.id);
  return item ? { kind: selected.kind, id: selected.id, item } : null;
}

export function getSelectedMarketKey(game) {
  const selected = game.ui && game.ui.selectedMarketItem;
  return selected ? getMarketKey(selected.kind, selected.id) : "";
}

export function getMarketKey(kind, id) {
  return kind + ":" + id;
}

export function getMarketItemColor(listing) {
  return isEquipmentKind(listing.kind) ? getEquipmentNameColor(listing.item) : listing.item.color || UI_TEXT.main;
}

export function getPlayerGoodsEntries(player) {
  ensurePlayerGoods(player);
  return Object.keys(player.goods)
    .map((id) => ({ item: getMarketItem("good", id), count: player.goods[id] }))
    .filter((entry) => entry.item && entry.count > 0)
    .sort((a, b) => a.item.name.localeCompare(b.item.name, "zh-Hans-CN"));
}

export function playerOwnsMarketItem(player, kind, id) {
  if (kind === "good") {
    ensurePlayerGoods(player);
    return (player.goods[id] || 0) > 0;
  }
  if (isEquipmentKind(kind)) {
    return playerOwnsEquipment(player, id);
  }
  return false;
}

export function getMarketPriceLine(game, selected) {
  const town = game.activeTown;
  if (!town || game.ui.townView !== "trade") {
    return "";
  }
  const townListing = getTownSellListings(game, town).find((entry) => entry.kind === selected.kind && entry.id === selected.id);
  const sellListing = getPlayerSellListings(game, town).find((entry) => entry.kind === selected.kind && entry.id === selected.id);
  const parts = [];
  if (townListing) {
    parts.push("买入 " + townListing.price + " 金");
  }
  if (sellListing) {
    parts.push("收购 " + sellListing.price + " 金");
  }
  return parts.join(" / ");
}

export function ensureTradePageState(ui) {
  if (!ui) {
    return;
  }
  if (!Number.isFinite(ui.marketBuyPage)) {
    ui.marketBuyPage = 0;
  }
  if (!Number.isFinite(ui.marketSellPage)) {
    ui.marketSellPage = 0;
  }
}
