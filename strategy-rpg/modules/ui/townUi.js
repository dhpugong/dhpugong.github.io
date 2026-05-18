import { FACTIONS } from "../config.js";
import { getTownDailyIncome } from "../player.js";
import { getArmyPower, getArmySize, getMaxArmySize, getRecruitOptions, getRosterLines, isArmyMoraleFull } from "../troop.js";
import { getTownDevelopmentCost } from "../town.js";
import { drawPanel, drawPixelText, formatNumber } from "../utils.js";
import { UI_TEXT, addButton, addPanelCloseButton, clearButtons, drawButton, drawTroopPortrait } from "./uiCore.js";
import { drawMarketDetailPopup, drawTownTradeView, ensureTradePageState } from "./marketUi.js";

export function drawTownUi(ctx, game) {
  const town = game.activeTown;
  clearButtons(game.ui);
  const view = game.ui.townView || "home";

  drawPanel(ctx, 140, 48, 680, 444, town.name, "town");
  addPanelCloseButton(game.ui, 140, 48, 680, "leaveTown");

  const owner = FACTIONS[town.owner];
  const kindText = town.kind === "castle" ? "城池" : town.kind === "tavern" ? "酒馆" : "村庄";
  drawPixelText(ctx, kindText + " / " + owner.name, 168, 88, owner.color, 15);

  // 城池信息栏
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(168, 110, 624, 36);
  drawPixelText(ctx, "城防 " + Math.round(town.defense), 180, 116, "#ffd56a", 12);
  drawPixelText(ctx, "收益 " + getTownDailyIncome(town) + " 金/日", 310, 116, UI_TEXT.main, 12);
  drawPixelText(ctx, "驻军战力 " + Math.round(getArmyPower(town.garrison)), 460, 116, UI_TEXT.body, 12);
  drawPixelText(ctx, "你的金币 " + formatNumber(game.player.gold), 610, 116, "#ffd56a", 12);
  drawPixelText(ctx, "守军等级 " + Math.floor(town.garrisonLevel || 1), 180, 134, UI_TEXT.muted, 11);

  if (view === "recruit") {
    drawTownRecruitView(ctx, game, town);
  } else if (view === "trade") {
    ensureTradePageState(game.ui);
    drawTownTradeView(ctx, game, town);
  } else {
    drawTownHomeView(ctx, game, town);
  }

  const baseButtonCount = game.ui.buttons.length;
  for (let i = 0; i < baseButtonCount; i += 1) {
    drawButton(ctx, game.ui.buttons[i], game.input);
  }
  drawMarketDetailPopup(ctx, game);
  for (let j = baseButtonCount; j < game.ui.buttons.length; j += 1) {
    drawButton(ctx, game.ui.buttons[j], game.input);
  }
}

export function drawTownHomeView(ctx, game, town) {
  drawPixelText(ctx, "城镇事务", 168, 176, "#ffd56a", 16);
  drawPixelText(ctx, "选择要办理的事务。招募和交易会进入独立界面。", 168, 206, UI_TEXT.body, 12);

  const recruitButton = addButton(game.ui, 220, 256, 180, 42, "招兵买马", "townView:recruit");
  const tradeButton = addButton(game.ui, 560, 256, 180, 42, "交易物品", "townView:trade");
  drawTownActionTile(ctx, recruitButton, "训练新兵、整补士气、发展城市");
  drawTownActionTile(ctx, tradeButton, "买入商品装备，卖出背包货物");

  addButton(game.ui, 395, 444, 170, 34, "离开城镇", "leaveTown");
}

export function drawTownActionTile(ctx, button, caption) {
  const x = button.x;
  const y = button.y;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  ctx.fillRect(x - 10, y - 12, button.w + 20, button.h + 56);
  ctx.strokeStyle = "rgba(143,104,46,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 9.5, y - 11.5, button.w + 20, button.h + 56);
  drawPixelText(ctx, caption, x + button.w / 2, y + 54, UI_TEXT.muted, 11, "center");
  ctx.restore();
}

export function drawTownRecruitView(ctx, game, town) {
  drawPixelText(ctx, "招募兵种", 168, 170, "#ffd56a", 14);
  const recruitOptions = getRecruitOptions(town);
  const armyFull = getArmySize(game.player.army) >= getMaxArmySize(game.player);
  recruitOptions.forEach((type, index) => {
    const y = 188 + index * 44;

    // 兵种背景条
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(168, y - 4, 384, 36);

    drawTroopPortrait(ctx, type.id, 185, y + 12, type.color, 0.78);

    // 兵种名
    drawPixelText(ctx, type.name, 212, y, type.color, 14);
    drawPixelText(ctx, type.role, 272, y, UI_TEXT.muted, 11);
    drawPixelText(ctx, type.cost + " 金/人   生命 " + type.hp + "   攻击 " + type.attack, 212, y + 18, UI_TEXT.body, 10);

    const cannotBuy3 = armyFull || game.player.gold < type.cost * 3;
    const cannotBuy10 = armyFull || game.player.gold < type.cost * 10;
    addButton(game.ui, 586, y, 76, 28, "招募x3", "recruit:" + type.id + ":3", cannotBuy3);
    addButton(game.ui, 670, y, 76, 28, "招募x10", "recruit:" + type.id + ":10", cannotBuy10);
  });

  // 我军编制
  const rosterY = 188 + recruitOptions.length * 44 + 8;
  drawPixelText(ctx, "我军编制", 168, rosterY, "#ffd56a", 14);
  getRosterLines(game.player.army).slice(0, 5).forEach((line, index) => {
    drawPixelText(ctx, line, 168, rosterY + 22 + index * 18, UI_TEXT.body, 11);
  });

  // 操作按钮
  const restCost = Math.max(8, Math.round(getArmyPower(game.player.army) * 0.015));
  const developCost = getTownDevelopmentCost(town);
  const moraleFull = isArmyMoraleFull(game.player.army);
  const canManageTown = town.owner === "player";
  addButton(game.ui, 586, 330, 170, 32, "整补士气 " + restCost + "金", "rest", game.player.gold < restCost || moraleFull);
  addButton(game.ui, 586, 380, 170, 32, "发展城市 " + developCost + "金", "developTown", !canManageTown || game.player.gold < developCost);
  addButton(game.ui, 586, 450, 78, 32, "返回", "townView:home");
  addButton(game.ui, 678, 450, 78, 32, "交易", "townView:trade");
}
