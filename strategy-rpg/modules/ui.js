import { CONFIG, FACTIONS } from "./config.js";
import { WEAPONS } from "./config.js";
import { buyMarketItem, ensurePlayerGoods, getMarketItem, getPlayerSellListings, getTownSellListings, sellMarketItem } from "./market.js";
import { setNotice } from "./notice.js";
import { expToNextLevel, getTownDailyIncome } from "./player.js";
import { getArmyPower, getArmySize, getMaxArmySize, getMaxTroopLevel, getRecruitOptions, getRosterLines, getSingleTroopUpgradeCost, getTroopBatchUpgradeCost, getTroopLevelStats, isArmyMoraleFull, upgradeSingleTroop, upgradeTroopBatch } from "./troop.js";
import { developTown, getTownDevelopmentCost, leaveTown, recruitFromTown, resetTownUi, restAtTown } from "./town.js";
import { NUMBER_FONT_FAMILY, UI_FONT_FAMILY, drawBar, drawPanel, drawPixelText, formatNumber, rectContains, setupCanvasFont } from "./utils.js";

// UI 模块：维护按钮、HUD、城池面板和菜单面板的绘制与点击处理。

const QUEST_PANEL = { x: 706, y: 64, w: 238, h: 116 };
const ARMY_GRID_LAYOUT = { x: 214, y: 156, cols: 10, rows: 7, cell: 42, gap: 7 };
const UI_TEXT = {
  main: "#f4e1aa",
  body: "#ead59b",
  muted: "#d7c286",
  label: "#dfb866",
  empty: "#b7a16a",
  dim: "#a99563",
  disabled: "#9a885e"
};
const BUTTON_THEME = {
  shadow: "#23150a",
  shadowPressed: "#120a04",
  normal: "#6c4b2a",
  hover: "#8a6236",
  pressed: "#54381f",
  disabled: "#5d523d",
  light: "#c79d55",
  lightHover: "#f0c96e",
  lightDisabled: "#7a6b4d",
  dark: "#2e1c0e",
  darkPressed: "#1b0f06",
  darkDisabled: "#3a2c1a",
  text: "#ffe08a",
  textHover: "#fff0b4",
  textDisabled: "#a89462"
};

const EMPTY_WEAPON = {
  id: "none",
  name: "未装备",
  quality: "none",
  attack: 0,
  defense: 0,
  range: 30,
  crit: 0,
  color: UI_TEXT.dim
};

const QUALITY_COLORS = {
  none: UI_TEXT.dim,
  common: "#d8d2c6",
  uncommon: "#7fd184",
  rare: "#79b8ff",
  epic: "#c79bff",
  legendary: "#ffd56a"
};

const QUALITY_NAMES = {
  none: "无",
  common: "普通",
  uncommon: "精良",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说"
};

const ATTR_IDS = ["strength", "agility", "intelligence", "leadership"];

export function createUi() {
  return { buttons: [], toastTimer: 0, armyMultiSelect: false, selectedArmySoldierKeys: [] };
}

export function clearArmyUiState(ui) {
  if (!ui) {
    return;
  }
  ui.selectedArmySoldierKey = null;
  ui.selectedArmySoldierKeys = [];
  ui.armyMultiSelect = false;
}

export function clearEnemyArmyPreview(ui) {
  if (!ui) {
    return;
  }
  ui.enemyArmyPreview = null;
  ui.enemyArmyPage = 0;
}

export function clearButtons(ui) {
  ui.buttons.length = 0;
}

export function addButton(ui, x, y, w, h, label, action, disabled, hidden) {
  const button = { x, y, w, h, label, action, disabled: !!disabled, hidden: !!hidden };
  ui.buttons.push(button);
  return button;
}

function addPanelCloseButton(ui, panelX, panelY, panelW, action) {
  return addButton(ui, panelX + panelW - 40, panelY + 14, 24, 24, "x", action);
}

// 像素按钮绘制
export function drawButton(ctx, button, input) {
  if (button.hidden) {
    return;
  }
  ctx.save();
  const { x, y, w, h } = button;
  const disabled = button.disabled;
  const hovered = Boolean(input && !disabled && rectContains(button, input.mouse.x, input.mouse.y));
  const pressed = Boolean(hovered && input.mouse.down);
  const pressOffset = pressed ? 2 : 0;
  const drawY = y + pressOffset;

  // 按钮底影
  ctx.fillStyle = pressed ? BUTTON_THEME.shadowPressed : BUTTON_THEME.shadow;
  ctx.fillRect(x + 2, y + 2, w, h);

  // 主体
  ctx.fillStyle = disabled ? BUTTON_THEME.disabled : pressed ? BUTTON_THEME.pressed : hovered ? BUTTON_THEME.hover : BUTTON_THEME.normal;
  ctx.fillRect(x, drawY, w, h);

  // 高光线
  ctx.fillStyle = disabled ? BUTTON_THEME.lightDisabled : hovered ? BUTTON_THEME.lightHover : BUTTON_THEME.light;
  ctx.fillRect(x, drawY, w, 2);
  ctx.fillRect(x, drawY, 2, h);

  // 暗线
  ctx.fillStyle = disabled ? BUTTON_THEME.darkDisabled : pressed ? BUTTON_THEME.darkPressed : BUTTON_THEME.dark;
  ctx.fillRect(x, drawY + h - 2, w, 2);
  ctx.fillRect(x + w - 2, drawY, 2, h);

  if (hovered) {
    ctx.strokeStyle = pressed ? "#d6a84f" : "#ffd56a";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1.5, drawY - 1.5, w + 3, h + 3);
    ctx.fillStyle = pressed ? "rgba(255,213,106,0.08)" : "rgba(255,213,106,0.14)";
    ctx.fillRect(x + 4, drawY + 3, w - 8, h - 6);
  }

  // 文字
  setupCanvasFont(ctx, 14, 800, UI_FONT_FAMILY, "center", "middle");
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(3, 6, 8, 0.82)";
  ctx.strokeText(button.label, Math.round(x + w / 2), Math.round(drawY + h / 2));
  ctx.fillStyle = disabled ? BUTTON_THEME.textDisabled : hovered ? BUTTON_THEME.textHover : BUTTON_THEME.text;
  ctx.fillText(button.label, Math.round(x + w / 2), Math.round(drawY + h / 2));

  // 可用按钮光晕
  if (!disabled && !hovered) {
    ctx.fillStyle = "rgba(255,213,106,0.06)";
    ctx.fillRect(x + 4, drawY + 3, w - 8, h - 6);
  }

  ctx.restore();
}

// ==================== HUD ====================

export function drawHud(ctx, game) {
  clearButtons(game.ui);
  const player = game.player;

  // 精简主界面：只保留关键状态，详细属性放到属性界面。
  const armySize = getArmySize(player.army);
  const maxSize = getMaxArmySize(player);
  const power = Math.round(getArmyPower(player.army));

  drawPanel(ctx, 10, 8, 287, 70, "领主状态");
  const avatarButton = addButton(game.ui, 24, 26, 40, 40, "", "menu", false, true);
  drawAvatar(ctx, avatarButton, player, game.input);

  drawPixelText(ctx, player.name, 78, 25, "#ffd56a", 16);
  drawPixelText(ctx, "Lv." + player.level, 176, 28, "#d6a84f", 12);
  drawPixelText(ctx, "第 " + player.day + " 日", 226, 28, UI_TEXT.muted, 12);

  drawHudMetric(ctx, "金", formatNumber(player.gold), 78, 48, "#ffe6a6", 18);
  drawHudMetric(ctx, "兵", armySize + "/" + maxSize, 148, 48, "#d9f0ff", 18);
  drawHudMetric(ctx, "战", String(power), 226, 48, "#ffe6a6", 18);
  drawBar(ctx, 78, 68, 154, 5, game.elapsedDayTimer / game.dayLength, "#ffd56a", "#28170c", "#5f3f17");
  drawPixelText(ctx, Math.ceil(Math.max(0, game.dayLength - game.elapsedDayTimer)) + "秒", 240, 63, UI_TEXT.muted, 10);

  addButton(game.ui, 786, 18, 72, 32, "军队", "army");
  addButton(game.ui, 868, 18, 72, 32, "设置", "settings");
  const autoPathButton = addButton(game.ui, 690, 18, 86, 32, "自动寻路", "autoPathDestination", !game.travelDestination);
  for (const btn of game.ui.buttons) {
    drawButton(ctx, btn, game.input);
  }
  if (game.travelDestination) {
    drawTravelDestinationHint(ctx, game, autoPathButton);
  }

  drawNearbyTownActions(ctx, game);
  drawNearbyResourceActions(ctx, game);
  drawCaptureProgress(ctx, game);
  drawQuestTracker(ctx, game);
  drawWarReports(ctx, game);

  // 键盘提示
  drawPixelText(ctx, "WASD移动 | E进城 | R攻城 | ESC菜单 | F5保存 | F9读档", 10, 522, "rgba(248,233,189,0.62)", 12);
}

function drawAvatar(ctx, button, player, input) {
  const hovered = Boolean(input && rectContains(button, input.mouse.x, input.mouse.y));
  const pressed = Boolean(hovered && input.mouse.down);
  const x = button.x;
  const y = button.y + (pressed ? 1 : 0);

  ctx.save();
  ctx.fillStyle = hovered ? BUTTON_THEME.hover : "#4b341f";
  ctx.fillRect(x - 2, y - 2, 44, 44);
  ctx.strokeStyle = hovered ? BUTTON_THEME.lightHover : BUTTON_THEME.light;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 1.5, y - 1.5, 43, 43);

  ctx.fillStyle = "#5a2c22";
  ctx.fillRect(x + 7, y + 9, 26, 27);
  ctx.fillStyle = "#d8b58a";
  ctx.fillRect(x + 11, y + 12, 18, 17);
  ctx.fillStyle = "#d6a84f";
  ctx.fillRect(x + 8, y + 6, 24, 8);
  ctx.fillRect(x + 12, y + 2, 4, 7);
  ctx.fillRect(x + 20, y + 1, 4, 8);
  ctx.fillRect(x + 28, y + 2, 4, 7);
  ctx.fillStyle = "#070604";
  ctx.fillRect(x + 15, y + 18, 3, 3);
  ctx.fillRect(x + 24, y + 18, 3, 3);
  ctx.fillStyle = "#7f2f27";
  ctx.fillRect(x + 11, y + 30, 18, 7);
  ctx.fillStyle = "#ffd56a";
  ctx.fillRect(x + 18, y + 31, 6, 3);

  if (hovered) {
    drawPixelText(ctx, "属性", x + 20, y + 45, "#ffd56a", 10, "center");
  }
  ctx.restore();
}

function drawHudMetric(ctx, label, value, x, y, valueColor, valueOffset = 31) {
  ctx.save();
  setupCanvasFont(ctx, 12, 800, UI_FONT_FAMILY);
  ctx.fillStyle = UI_TEXT.muted;
  ctx.fillText(label, Math.round(x), Math.round(y));
  setupCanvasFont(ctx, 16, 900, NUMBER_FONT_FAMILY);
  ctx.fillStyle = valueColor;
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 2;
  ctx.fillText(value, Math.round(x + valueOffset), Math.round(y - 2));
  ctx.restore();
}

function drawTravelDestinationHint(ctx, game, button) {
  const dx = game.travelDestination.x - game.player.x;
  const dy = game.travelDestination.y - game.player.y;
  const distance = Math.round(Math.hypot(dx, dy) / CONFIG.tileSize);
  const hintW = 148;
  const hintH = 20;
  const hintX = Math.min(button.x - hintW - 16, QUEST_PANEL.x - hintW - 32);
  const hintY = button.y + button.h + 6;
  ctx.save();
  ctx.fillStyle = "rgba(3, 8, 10, 0.72)";
  ctx.fillRect(hintX, hintY, hintW, hintH);
  ctx.strokeStyle = "rgba(125,243,255,0.42)";
  ctx.lineWidth = 1;
  ctx.strokeRect(hintX + 0.5, hintY + 0.5, hintW, hintH);
  drawPixelText(ctx, "目的地 " + distance + "格", hintX + hintW / 2, hintY + 5, "#7df3ff", 10, "center");
  ctx.restore();
}

function drawQuestTracker(ctx, game) {
  const panelX = QUEST_PANEL.x;
  const panelY = QUEST_PANEL.y;
  const panelW = QUEST_PANEL.w;
  const panelH = QUEST_PANEL.h;
  const towns = game.map.towns || [];
  const resources = game.map.resources || [];
  const ownedTowns = towns.filter((town) => town.owner === "player").length;
  const ownedResources = resources.filter((resource) => resource.owner === "player").length;
  const explored = getExploredRatio(game);
  const title = game.player.unified ? "凯旋纪事" : "征途目标";
  const objective = game.nearTown
    ? "处理附近城镇：" + game.nearTown.name
    : game.nearResource
      ? "占领资源点：" + game.nearResource.name
      : game.player.target
        ? "行军至标记地点"
        : "探索大陆并扩张势力";

  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, title);
  drawQuestCompass(ctx, panelX + panelW - 30, panelY + 21, game.player.facingAngle || Math.PI);
  drawPixelText(ctx, fitPixelText(ctx, objective, panelW - 66, 12), panelX + 18, panelY + 24, UI_TEXT.main, 12);
  drawQuestRow(ctx, "城镇", ownedTowns, towns.length, panelX + 18, panelY + 48, "#ffd56a", "", panelW - 36);
  drawQuestRow(ctx, "资源", ownedResources, resources.length, panelX + 18, panelY + 68, "#32ff9a", "", panelW - 36);
  drawQuestRow(ctx, "探索", explored, 100, panelX + 18, panelY + 88, "#7df3ff", "%", panelW - 36);
}

function drawQuestRow(ctx, label, value, max, x, y, color, suffix, rowWidth = 244) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const valueText = value + (suffix || "/" + max);
  const valueX = x + rowWidth;
  const barX = x + 48;
  const barW = Math.max(64, rowWidth - 86);
  drawPixelText(ctx, label, x, y - 2, UI_TEXT.muted, 10);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(barX, y, barW, 7);
  ctx.fillStyle = color;
  ctx.fillRect(barX, y, Math.round(barW * ratio), 7);
  ctx.strokeStyle = "rgba(248,233,189,0.26)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, y + 0.5, barW, 7);
  drawPixelText(ctx, valueText, valueX, y - 4, color, 11, "right");
}

function getExploredRatio(game) {
  if (!game.fog || !game.fog.cells || !game.fog.cells.length) {
    return 0;
  }
  if (typeof game.fog.exploredCount === "number") {
    return Math.round((game.fog.exploredCount / game.fog.cells.length) * 100);
  }
  let explored = 0;
  for (let i = 0; i < game.fog.cells.length; i += 1) {
    if (game.fog.cells[i] > 0) {
      explored += 1;
    }
  }
  game.fog.exploredCount = explored;
  return Math.round((explored / game.fog.cells.length) * 100);
}

function drawGlassPanel(ctx, x, y, w, h, title) {
  ctx.save();
  ctx.shadowColor = "rgba(84,224,255,0.28)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "rgba(5, 12, 16, 0.68)";
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(84,224,255,0.07)";
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (let yy = y + 12; yy < y + h - 10; yy += 12) {
    ctx.fillRect(x + 8, yy, w - 16, 1);
  }
  ctx.strokeStyle = "rgba(125,243,255,0.72)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.strokeStyle = "rgba(214,168,79,0.42)";
  ctx.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(x + 12, y - 9, Math.max(82, title.length * 16), 20);
  drawPixelText(ctx, title, x + 22, y - 6, "#7df3ff", 14);
  ctx.fillStyle = "#7df3ff";
  drawUiCorner(ctx, x, y, 11, 1);
  drawUiCorner(ctx, x + w, y, -11, 1);
  drawUiCorner(ctx, x, y + h, 11, -1);
  drawUiCorner(ctx, x + w, y + h, -11, -1);
  ctx.restore();
}

function drawUiCorner(ctx, x, y, dx, dy) {
  ctx.fillRect(Math.round(x), Math.round(y), dx, 2 * dy);
  ctx.fillRect(Math.round(x), Math.round(y), 2 * Math.sign(dx), 10 * dy);
}

function drawQuestCompass(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.strokeStyle = "rgba(125,243,255,0.38)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-10.5, -10.5, 21, 21);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(-8, -8, 16, 16);
  ctx.rotate(angle || 0);
  ctx.fillStyle = "#32ff9a";
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWarReports(ctx, game) {
  const reports = (game.reports || []).slice(0, 6);
  if (!reports.length) {
    return;
  }
  const x = QUEST_PANEL.x;
  const y = 196;
  const w = QUEST_PANEL.w;
  const h = 30 + reports.length * 16;
  ctx.save();
  ctx.fillStyle = "rgba(6, 10, 13, 0.46)";
  ctx.fillRect(x, y - 10, w, h);
  ctx.strokeStyle = "rgba(214,168,79,0.36)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y - 10.5, w, h);
  ctx.fillStyle = "rgba(214,168,79,0.1)";
  ctx.fillRect(x + 5, y - 5, w - 10, 1);
  drawPixelText(ctx, "战报", x + 12, y - 6, "#ffd56a", 11);
  reports.forEach(function (report, index) {
    const color = report.kind === "good"
      ? "#74d17a"
      : report.kind === "bad"
        ? "#ff7568"
        : UI_TEXT.body;
    ctx.fillStyle = color;
    ctx.fillRect(x + 12, y + 16 + index * 16, 4, 4);
    drawPixelText(ctx, fitPixelText(ctx, report.text, w - 38, 10), x + 22, y + 11 + index * 16, color, 10);
  });
  ctx.restore();
}

function fitPixelText(ctx, text, maxWidth, size) {
  const value = String(text || "");
  ctx.save();
  setupCanvasFont(ctx, size, size >= 12 ? 700 : 650, UI_FONT_FAMILY);
  if (ctx.measureText(value).width <= maxWidth) {
    ctx.restore();
    return value;
  }
  let fitted = value;
  while (fitted.length > 1 && ctx.measureText(fitted + "...").width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  ctx.restore();
  return fitted + "...";
}

function drawNearbyResourceActions(ctx, game) {
  if (!game.nearResource || game.state !== "world") return;
  if (game.capturingResource) return;

  const resource = game.nearResource;
  const panelX = 372;
  const panelY = 408;
  const ownerText = resource.owner === "player" ? "我方" : "无主";
  const kindText = resource.kind === "mine" ? "矿山" : "农场";

  drawPanel(ctx, panelX, panelY, 216, 82, resource.name);
  drawPixelText(ctx, kindText + " / " + ownerText + " / +" + resource.income + "金/日", panelX + 18, panelY + 22, UI_TEXT.main, 13);
  const disabled = resource.owner === "player";
  const captureButton = addButton(game.ui, panelX + 54, panelY + 48, 108, 28, "占领", "captureNearbyResource", disabled);
  drawButton(ctx, captureButton, game.input);
}

function drawCaptureProgress(ctx, game) {
  if (!game.capturingResource) return;
  const resource = (game.map.resources || []).find(function (item) {
    return item.id === game.capturingResource.id;
  });
  if (!resource) return;

  const ratio = game.capturingResource.timer / game.capturingResource.duration;
  drawPanel(ctx, 350, 402, 260, 74, "占领中");
  drawPixelText(ctx, resource.name, 480, 424, "#ffd56a", 15, "center");
  drawBar(ctx, 382, 452, 196, 8, ratio, "#ffd56a", "#28170c", "#5f3f17");
}

function drawNearbyTownActions(ctx, game) {
  if (!game.nearTown || game.state !== "world") return;

  const town = game.nearTown;
  const owner = FACTIONS[town.owner];
  const panelX = 364;
  const panelY = 410;
  const panelW = 232;
  drawPanel(ctx, panelX, panelY, panelW, 82, town.name);
  drawPixelText(ctx, owner.name, panelX + 20, panelY + 22, owner.color, 14);

  const siegeDisabled = town.owner === "player";
  const previewDisabled = siegeDisabled || !town.garrison || !town.garrison.length;
  const previewButton = addButton(game.ui, panelX + panelW - 42, panelY + 12, 26, 24, "兵", "openTownArmyPreview", previewDisabled);
  const enterButton = addButton(game.ui, panelX + 20, panelY + 48, 86, 28, "进城", "enterNearbyTown");
  const siegeButton = addButton(game.ui, panelX + 126, panelY + 48, 86, 28, "攻城", "siegeNearbyTown", siegeDisabled);
  drawButton(ctx, previewButton, game.input);
  drawButton(ctx, enterButton, game.input);
  drawButton(ctx, siegeButton, game.input);
}

// ==================== 城池面板 ====================

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

function drawTownHomeView(ctx, game, town) {
  drawPixelText(ctx, "城镇事务", 168, 176, "#ffd56a", 16);
  drawPixelText(ctx, "选择要办理的事务。招募和交易会进入独立界面。", 168, 206, UI_TEXT.body, 12);

  const recruitButton = addButton(game.ui, 220, 256, 180, 42, "招兵买马", "townView:recruit");
  const tradeButton = addButton(game.ui, 560, 256, 180, 42, "交易物品", "townView:trade");
  drawTownActionTile(ctx, recruitButton, "训练新兵、整补士气、发展城市");
  drawTownActionTile(ctx, tradeButton, "买入商品装备，卖出背包货物");

  addButton(game.ui, 395, 444, 170, 34, "离开城镇", "leaveTown");
}

function drawTownActionTile(ctx, button, caption) {
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

function drawTownRecruitView(ctx, game, town) {
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

function drawTownTradeView(ctx, game, town) {
  ensurePlayerGoods(game.player);
  const townListings = getTownSellListings(game, town);
  const playerListings = getPlayerSellListings(game, town);

  drawPixelText(ctx, "城市出售", 168, 168, "#ffd56a", 14);
  drawPixelText(ctx, "背包出售", 506, 168, "#ffd56a", 14);
  drawMarketList(ctx, game, townListings, 168, 190, "buyMarket", true);
  drawMarketList(ctx, game, playerListings, 506, 190, "sellMarket", false);
  drawPixelText(ctx, "收购价为当日售价的 80%-90%，不同城市价格不同。", 168, 452, UI_TEXT.muted, 11);
  addButton(game.ui, 592, 448, 78, 32, "返回", "townView:home");
  addButton(game.ui, 684, 448, 78, 32, "招募", "townView:recruit");
}

function drawMarketList(ctx, game, listings, x, y, actionPrefix, buying) {
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(x, y - 8, 286, 238);
  ctx.strokeStyle = "rgba(143,104,46,0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y - 7.5, 286, 238);

  if (!listings.length) {
    drawPixelText(ctx, buying ? "今日无货" : "背包无可出售物品", x + 143, y + 92, UI_TEXT.empty, 12, "center");
    return;
  }

  listings.slice(0, 7).forEach(function (listing, index) {
    const rowY = y + index * 32;
    const item = listing.item;
    const selected = getSelectedMarketKey(game) === getMarketKey(listing.kind, listing.id);
    const rowRect = { x, y: rowY - 4, w: 202, h: 28 };
    const hovered = game.input && rectContains(rowRect, game.input.mouse.x, game.input.mouse.y);

    ctx.fillStyle = selected ? "rgba(255,213,106,0.13)" : hovered ? "rgba(138,98,54,0.24)" : "rgba(255,255,255,0.025)";
    ctx.fillRect(rowRect.x, rowRect.y, rowRect.w, rowRect.h);
    ctx.strokeStyle = selected ? "#ffd56a" : hovered ? "#d6a84f" : "rgba(143,104,46,0.32)";
    ctx.strokeRect(rowRect.x + 0.5, rowRect.y + 0.5, rowRect.w, rowRect.h);

    drawMarketIcon(ctx, item, x + 14, rowY + 10, listing.kind);
    drawPixelText(ctx, item.name + (listing.count ? " x" + listing.count : ""), x + 30, rowY, getMarketItemColor(listing), 12);
    drawPixelText(ctx, listing.price + "金", x + 180, rowY, buying ? "#ffd56a" : "#74d17a", 12, "right");
    const disabled = buying && (game.player.gold < listing.price || (listing.kind === "weapon" && playerOwnsMarketItem(game.player, "weapon", listing.id)));
    addButton(game.ui, rowRect.x, rowRect.y, rowRect.w, rowRect.h, item.name, "selectMarketItem:" + listing.kind + ":" + listing.id, false, true);
    addButton(game.ui, x + 214, rowY - 3, 58, 26, buying ? "买入" : "卖出", actionPrefix + ":" + listing.kind + ":" + listing.id, disabled);
  });
}

function drawMarketIcon(ctx, item, x, y, kind) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(x - 7, y - 7, 14, 14);
  ctx.strokeStyle = kind === "weapon" ? getWeaponNameColor(item) : item.color || UI_TEXT.body;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 6.5, y - 6.5, 14, 14);
  ctx.fillStyle = kind === "weapon" ? getWeaponNameColor(item) : item.color || UI_TEXT.body;
  if (kind === "weapon") {
    ctx.fillRect(x - 1, y - 7, 3, 12);
    ctx.fillRect(x - 5, y - 4, 11, 2);
  } else {
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(x - 2, y - 3, 3, 2);
  }
  ctx.restore();
}

function drawMarketDetailPopup(ctx, game) {
  const selected = getSelectedMarketItem(game);
  if (!selected) {
    return;
  }

  const x = 306;
  const y = 144;
  const w = 348;
  const h = 248;
  const item = selected.item;
  const isWeapon = selected.kind === "weapon";

  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  addButton(game.ui, 0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight, "关闭物品信息", "closeMarketDetail", false, true);
  drawPanel(ctx, x, y, w, h, isWeapon ? "装备信息" : "商品信息", "town");
  addPanelCloseButton(game.ui, x, y, w, "closeMarketDetail");

  const contentX = x + 34;
  const contentY = y + 44;
  drawMarketIcon(ctx, item, contentX + 12, contentY + 12, selected.kind);
  drawPixelText(ctx, item.name, contentX + 36, contentY, getMarketItemColor(selected), 20);
  drawPixelText(ctx, isWeapon ? getQualityName(item) + " / 装备" : "跑商商品", contentX + 36, contentY + 32, UI_TEXT.muted, 12);

  const boxY = contentY + 62;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(contentX, boxY, w - 68, 92);
  ctx.strokeStyle = "rgba(143,104,46,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(contentX + 0.5, boxY + 0.5, w - 68, 92);

  if (isWeapon) {
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

function getSelectedMarketItem(game) {
  const selected = game.ui && game.ui.selectedMarketItem;
  if (!selected) {
    return null;
  }
  const item = getMarketItem(selected.kind, selected.id);
  return item ? { kind: selected.kind, id: selected.id, item } : null;
}

function getSelectedMarketKey(game) {
  const selected = game.ui && game.ui.selectedMarketItem;
  return selected ? getMarketKey(selected.kind, selected.id) : "";
}

function getMarketKey(kind, id) {
  return kind + ":" + id;
}

function getMarketItemColor(listing) {
  return listing.kind === "weapon" ? getWeaponNameColor(listing.item) : listing.item.color || UI_TEXT.main;
}

function getPlayerGoodsEntries(player) {
  ensurePlayerGoods(player);
  return Object.keys(player.goods)
    .map((id) => ({ item: getMarketItem("good", id), count: player.goods[id] }))
    .filter((entry) => entry.item && entry.count > 0)
    .sort((a, b) => a.item.name.localeCompare(b.item.name, "zh-Hans-CN"));
}

function playerOwnsMarketItem(player, kind, id) {
  if (kind === "good") {
    ensurePlayerGoods(player);
    return (player.goods[id] || 0) > 0;
  }
  if (kind === "weapon") {
    return (player.inventory || []).includes(id);
  }
  return false;
}

function getMarketPriceLine(game, selected) {
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

function wrapText(text, maxChars) {
  const value = String(text || "");
  const lines = [];
  for (let i = 0; i < value.length; i += maxChars) {
    lines.push(value.slice(i, i + maxChars));
  }
  return lines;
}

// ==================== 属性界面 ====================

export function drawMenuUi(ctx, game) {
  clearButtons(game.ui);
  ensurePlayerEquipmentState(game.player);
  ensureAttributeSession(game);

  const panelX = 142;
  const panelY = 42;
  const panelW = 676;
  drawPanel(ctx, panelX, panelY, panelW, 458, "属性界面", "menu");
  addPanelCloseButton(game.ui, panelX, panelY, panelW, "closeMenu");

  const general = game.player.general || { name: "沈铁冠", weapon: "oldSword" };
  const equippedWeaponId = getEquippedWeaponId(game.player);
  const selectedEquipmentId = getSelectedEquipmentId(game);
  const weapon = getEquippedWeapon(game.player);
  const generalStats = getPlayerGeneralPreview(game.player);

  // 将领与装备
  drawPixelText(ctx, "将领", 176, 72, "#ffd56a", 15);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(176, 94, 250, 150);
  drawPixelText(ctx, general.name, 194, 106, "#ffd56a", 18);
  drawPlayerStatGrid(ctx, generalStats, 194, 144);

  drawPixelText(ctx, "装备槽", 176, 266, "#ffd56a", 15);
  drawEquipmentSlot(ctx, 194, 292, "武器", weapon.name, getWeaponNameColor(weapon), game.input, Boolean(equippedWeaponId), equippedWeaponId === selectedEquipmentId);
  addButton(game.ui, 194, 292, 124, 52, "查看武器", equippedWeaponId ? "selectEquipment:" + equippedWeaponId : "", !equippedWeaponId, true);
  drawEquipmentSlot(ctx, 194, 354, "护甲", game.player.equipment.armor, getGearSlotColor(game.player.equipment.armor, "#7a8a9a"));
  drawEquipmentSlot(ctx, 194, 416, "饰品", game.player.equipment.trinket, getGearSlotColor(game.player.equipment.trinket, "#8e5ab8"));

  // 属性分配
  drawPixelText(ctx, "属性分配（剩余 " + game.player.skillPoints + "）", 456, 72, "#ffd56a", 15);

  var attrs = [
    { id: "strength", name: "力量", value: game.player.attributes.strength },
    { id: "agility", name: "敏捷", value: game.player.attributes.agility },
    { id: "intelligence", name: "智力", value: game.player.attributes.intelligence },
    { id: "leadership", name: "统御", value: game.player.attributes.leadership }
  ];

  attrs.forEach(function (row, index) {
    const col = index % 2;
    const rowIndex = Math.floor(index / 2);
    var x = 456 + col * 154;
    var y = 104 + rowIndex * 48;
    const sessionAdds = getAttributeSessionAdds(game, row.id);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(x, y - 6, 144, 34);

    const attrButtonW = 28;
    const minusX = x + 50;
    const plusX = x + 108;
    const valueX = (minusX + attrButtonW + plusX) / 2;

    drawPixelText(ctx, row.name, x + 10, y + 4, UI_TEXT.main, 13);
    drawPixelText(ctx, String(row.value), valueX, y + 6, "#ffd56a", 13, "center");

    addButton(game.ui, minusX, y - 1, attrButtonW, 26, "-", "attrUndo:" + row.id, sessionAdds <= 0);
    addButton(game.ui, plusX, y - 1, attrButtonW, 26, "+", "attrAdd:" + row.id, game.player.skillPoints <= 0);
  });

  drawEquipmentInventory(ctx, game);

  const baseButtonCount = game.ui.buttons.length;
  for (var i = 0; i < baseButtonCount; i++) {
    drawButton(ctx, game.ui.buttons[i], game.input);
  }
  drawEquipmentDetailPopup(ctx, game);
  drawMarketDetailPopup(ctx, game);
  for (var j = baseButtonCount; j < game.ui.buttons.length; j++) {
    drawButton(ctx, game.ui.buttons[j], game.input);
  }
}

function getPlayerGeneralPreview(player) {
  const general = player.general || { level: Math.max(1, player.level || 1), weapon: null };
  const attrs = player.attributes || { strength: 0, agility: 0, intelligence: 0, leadership: 0 };
  const weapon = getEquippedWeapon(player);
  const level = general.level || player.level || 1;
  const expNext = expToNextLevel(player);
  const attackBonus = attrs.strength * 1.2 + attrs.intelligence * 0.6;
  const hpBonus = attrs.leadership * 8 + attrs.strength * 3;
  const speedBonus = attrs.agility * 0.9;
  const playerAttackMul = 1 + attrs.strength * 0.018;
  const playerSpeedMul = 1 + attrs.agility * 0.012;
  const moraleHpMul = 1 + attrs.leadership * 0.8 / 220;
  return {
    hp: Math.round((130 + level * 22 + weapon.defense * 8 + hpBonus) * moraleHpMul),
    attack: Math.round((18 + level * 4 + weapon.attack + attackBonus) * playerAttackMul),
    defense: Math.round(6 + level + weapon.defense + attrs.leadership * 0.7),
    speed: Math.round((38 + level * 1.5 + speedBonus) * playerSpeedMul),
    range: weapon.range,
    crit: Math.round((0.08 + weapon.crit + attrs.agility * 0.006 + attrs.intelligence * 0.003) * 100),
    level,
    exp: Math.floor(player.exp || 0),
    expNext,
    gold: Math.floor(player.gold || 0),
    armySize: getArmySize(player.army),
    maxArmySize: getMaxArmySize(player),
    armyPower: Math.round(getArmyPower(player.army))
  };
}

function drawPlayerStatGrid(ctx, stats, x, y) {
  const labelValueGap = 42 * 0.7;
  const rightLabelX = x + 116;
  const rows = [
    ["等级", stats.level, "经验", stats.exp + "/" + stats.expNext],
    ["血量", stats.hp, "攻击", stats.attack],
    ["防御", stats.defense, "速度", stats.speed],
    ["射程", stats.range, "暴击", stats.crit + "%"]
  ];
  rows.forEach(function (row, index) {
    const yPos = y + index * 16;
    drawPixelText(ctx, row[0], x, yPos, UI_TEXT.label, 10);
    drawPixelText(ctx, String(row[1]), x + labelValueGap, yPos, UI_TEXT.main, 11);
    if (row[2]) {
      drawPixelText(ctx, row[2], rightLabelX, yPos, UI_TEXT.label, 10);
      drawPixelText(ctx, String(row[3]), rightLabelX + labelValueGap, yPos, UI_TEXT.main, 11);
    }
  });
}

function drawEquipmentInventory(ctx, game) {
  const equipped = getEquippedWeaponId(game.player);
  const weaponIds = getInventoryWeaponIds(game.player).filter((id) => id !== equipped);
  const goods = getPlayerGoodsEntries(game.player);

  drawPixelText(ctx, "背包", 456, 286, "#ffd56a", 15);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(456, 310, 308, 138);

  if (!weaponIds.length && !goods.length) {
    drawPixelText(ctx, "背包为空", 610, 364, UI_TEXT.empty, 12, "center");
    return;
  }

  drawPixelText(ctx, "装备", 470, 316, UI_TEXT.label, 10);
  weaponIds.slice(0, 6).forEach(function (id, index) {
    const weapon = WEAPONS[id];
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 470 + col * 94;
    const y = 332 + row * 28;
    const rect = { x, y, w: 84, h: 26 };
    const selected = getSelectedEquipmentId(game) === id;
    const hovered = game.input && rectContains(rect, game.input.mouse.x, game.input.mouse.y);
    const pressed = hovered && game.input.mouse.down;
    const drawY = y + (pressed ? 1 : 0);
    ctx.fillStyle = selected ? "rgba(255,213,106,0.14)" : hovered ? "rgba(138,98,54,0.28)" : "rgba(255,255,255,0.035)";
    ctx.fillRect(x, drawY, 84, 26);
    ctx.strokeStyle = selected ? "#ffd56a" : hovered ? "#d6a84f" : "#5f3f17";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, drawY + 0.5, 84, 26);
    drawPixelText(ctx, weapon.name, x + 6, drawY + 7, getWeaponNameColor(weapon), 10);
    addButton(game.ui, x, y, 84, 26, "查看装备", "selectEquipment:" + id, false, true);
  });

  drawPixelText(ctx, "商品", 470, 392, UI_TEXT.label, 10);
  goods.slice(0, 6).forEach(function (entry, index) {
    const item = entry.item;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 470 + col * 94;
    const y = 408 + row * 28;
    const rect = { x, y, w: 84, h: 24 };
    const selected = getSelectedMarketKey(game) === getMarketKey("good", item.id);
    const hovered = game.input && rectContains(rect, game.input.mouse.x, game.input.mouse.y);
    const pressed = hovered && game.input.mouse.down;
    const drawY = y + (pressed ? 1 : 0);
    ctx.fillStyle = selected ? "rgba(255,213,106,0.14)" : hovered ? "rgba(138,98,54,0.28)" : "rgba(255,255,255,0.035)";
    ctx.fillRect(x, drawY, 84, 24);
    ctx.strokeStyle = selected ? "#ffd56a" : hovered ? "#d6a84f" : "#5f3f17";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, drawY + 0.5, 84, 24);
    drawPixelText(ctx, item.name + " x" + entry.count, x + 6, drawY + 6, item.color || UI_TEXT.main, 10);
    addButton(game.ui, x, y, 84, 24, "查看商品", "selectMarketItem:good:" + item.id, false, true);
  });
}

function drawEquipmentDetailPopup(ctx, game) {
  const selectedId = getSelectedEquipmentId(game);
  const weapon = selectedId ? WEAPONS[selectedId] : null;

  if (!weapon) {
    return;
  }

  const x = 306;
  const y = 144;
  const w = 348;
  const h = 248;
  const equipped = getEquippedWeaponId(game.player) === weapon.id;

  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(0, 0, 960, 540);
  addButton(game.ui, 0, 0, 960, 540, "关闭装备信息", "closeEquipmentDetail", false, true);
  drawPanel(ctx, x, y, w, h, "装备信息", "menu");
  addPanelCloseButton(game.ui, x, y, w, "closeEquipmentDetail");

  const contentX = x + 34;
  const contentY = y + 44;
  drawPixelText(ctx, weapon.name, contentX, contentY, getWeaponNameColor(weapon), 20);
  drawPixelText(ctx, getQualityName(weapon) + " / 武器", contentX, contentY + 34, UI_TEXT.muted, 12);

  const statsBoxY = contentY + 58;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(contentX, statsBoxY, w - 68, 78);
  ctx.strokeStyle = "rgba(143,104,46,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(contentX + 0.5, statsBoxY + 0.5, w - 68, 78);

  const stats = formatEquipmentStats(weapon);
  stats.forEach(function (line, index) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const statX = contentX + 18 + col * 132;
    const statY = statsBoxY + 14 + row * 21;
    drawPixelText(ctx, line, statX, statY, UI_TEXT.main, 13);
  });
  addButton(game.ui, x + 114, y + h - 50, 120, 34, equipped ? "卸下" : "穿戴", equipped ? "unequipSelectedEquipment" : "equipSelectedEquipment");
}

// ==================== 军队管理 ====================

export function drawArmyUi(ctx, game) {
  clearButtons(game.ui);
  ensureArmySelectionState(game.ui);

  const panelX = 176;
  const panelY = 48;
  const panelW = 608;
  drawPanel(ctx, panelX, panelY, panelW, 444, "军队管理", "army");
  addPanelCloseButton(game.ui, panelX, panelY, panelW, "closeArmy");
  drawPixelText(ctx, "金币 " + formatNumber(game.player.gold), 214, 84, "#ffd56a", 14);
  drawPixelText(ctx, "兵力 " + getArmySize(game.player.army) + "/" + getMaxArmySize(game.player), 344, 84, "#d9f0ff", 14);
  drawPixelText(ctx, "战力 " + Math.round(getArmyPower(game.player.army)), 484, 84, UI_TEXT.main, 14);

  drawPixelText(ctx, "部队编制", 214, 122, UI_TEXT.label, 11);

  const soldiers = getArmySoldiers(game.player.army);
  const armyPage = getArmyPage(game.ui, "armyPage", soldiers.length, ARMY_GRID_LAYOUT);
  const visibleSoldiers = getArmyPageSoldiers(soldiers, armyPage, ARMY_GRID_LAYOUT);
  const multiSelect = Boolean(game.ui.armyMultiSelect);
  cleanSelectedArmySoldierKeys(game.ui, soldiers);
  const selectedSoldier = getSelectedArmySoldier(game, soldiers);
  const selectedSoldiers = multiSelect ? getSelectedArmySoldiers(game.ui, soldiers) : [];
  const batchPreview = getTroopBatchUpgradeCost(game.player.army, getArmySoldierUpgradeGroups(selectedSoldiers));

  drawArmyToolbar(ctx, game, soldiers, selectedSoldiers, batchPreview, ARMY_GRID_LAYOUT);

  if (!game.player.army.length) {
    drawPixelText(ctx, "暂无部队", 480, 236, UI_TEXT.empty, 16, "center");
  }

  drawArmySoldierGrid(ctx, game, visibleSoldiers, selectedSoldier, {
    ...ARMY_GRID_LAYOUT,
    selectedKeys: multiSelect ? new Set(game.ui.selectedArmySoldierKeys) : null,
    actionPrefix: multiSelect ? "toggleArmySoldier:" : "selectArmySoldier:"
  });
  drawArmyPager(ctx, game, soldiers.length, armyPage, ARMY_GRID_LAYOUT, "armyPage");

  const baseButtonCount = game.ui.buttons.length;
  for (var i = 0; i < baseButtonCount; i++) {
    drawButton(ctx, game.ui.buttons[i], game.input);
  }

  if (!multiSelect && selectedSoldier) {
    drawArmySoldierCard(ctx, game, selectedSoldier, {
      title: "士兵信息",
      closeAction: "closeArmySoldier"
    });
    for (var j = baseButtonCount; j < game.ui.buttons.length; j++) {
      drawButton(ctx, game.ui.buttons[j], game.input);
    }
  }
}

export function drawArmyPreviewOverlay(ctx, game) {
  const preview = game.ui && game.ui.enemyArmyPreview;
  if (!preview) {
    return;
  }

  const army = Array.isArray(preview.army) ? preview.army : [];
  const soldiers = getArmySoldiers(army);
  const armyPage = getArmyPage(game.ui, "enemyArmyPage", soldiers.length, ARMY_GRID_LAYOUT);
  const visibleSoldiers = getArmyPageSoldiers(soldiers, armyPage, ARMY_GRID_LAYOUT);
  const panelX = 176;
  const panelY = 48;
  const panelW = 608;
  const firstButtonIndex = game.ui.buttons.length;

  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  addButton(game.ui, 0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight, "关闭敌军预览", "closeEnemyArmyPreview", false, true);

  drawPanel(ctx, panelX, panelY, panelW, 444, preview.title || "敌军预览", "battle");
  addPanelCloseButton(game.ui, panelX, panelY, panelW, "closeEnemyArmyPreview");
  drawPixelText(ctx, preview.subtitle || "敌军编制", 214, 84, "#ff8a74", 14);
  drawPixelText(ctx, "兵力 " + getArmySize(army), 344, 84, "#d9f0ff", 14);
  drawPixelText(ctx, "战力 " + Math.round(getArmyPower(army)), 484, 84, UI_TEXT.main, 14);
  drawPixelText(ctx, "敌军编制", 214, 122, UI_TEXT.label, 11);

  if (!army.length) {
    drawPixelText(ctx, "暂无部队", 480, 236, UI_TEXT.empty, 16, "center");
  }

  drawArmySoldierGrid(ctx, game, visibleSoldiers, null, {
    ...ARMY_GRID_LAYOUT,
    clickable: false,
    strokeColor: "#7a3e38",
    hoverColor: "#7a3e38"
  });
  drawArmyPager(ctx, game, soldiers.length, armyPage, ARMY_GRID_LAYOUT, "enemyArmyPage");

  for (var i = firstButtonIndex; i < game.ui.buttons.length; i++) {
    drawButton(ctx, game.ui.buttons[i], game.input);
  }
}

function getArmySoldiers(army) {
  const soldiers = [];
  army.forEach(function (unit, stackIndex) {
    for (let i = 0; i < unit.count; i += 1) {
      soldiers.push({ unit, stackIndex, ordinal: i });
    }
  });
  return soldiers;
}

function ensureArmySelectionState(ui) {
  if (!ui) {
    return;
  }
  if (!Array.isArray(ui.selectedArmySoldierKeys)) {
    ui.selectedArmySoldierKeys = [];
  }
  ui.armyMultiSelect = Boolean(ui.armyMultiSelect);
}

function cleanSelectedArmySoldierKeys(ui, soldiers) {
  ensureArmySelectionState(ui);
  const validKeys = new Set(soldiers.map(getArmySoldierKey));
  ui.selectedArmySoldierKeys = ui.selectedArmySoldierKeys.filter((key, index, list) => (
    validKeys.has(key) && list.indexOf(key) === index
  ));
  if (ui.selectedArmySoldierKey && !validKeys.has(ui.selectedArmySoldierKey)) {
    ui.selectedArmySoldierKey = null;
  }
}

function getSelectedArmySoldier(game, soldiers) {
  const selectedKey = game.ui.selectedArmySoldierKey;
  const selected = selectedKey
    ? soldiers.find((soldier) => getArmySoldierKey(soldier) === selectedKey)
    : null;
  if (!selected) {
    game.ui.selectedArmySoldierKey = null;
  }
  return selected || null;
}

function getSelectedArmySoldiers(ui, soldiers) {
  ensureArmySelectionState(ui);
  const selectedKeys = new Set(ui.selectedArmySoldierKeys);
  return soldiers.filter((soldier) => selectedKeys.has(getArmySoldierKey(soldier)));
}

function getArmySoldierKey(soldier) {
  return soldier.stackIndex + ":" + soldier.ordinal + ":" + soldier.unit.type + ":" + soldier.unit.level;
}

function getArmySoldierUpgradeGroups(soldiers) {
  const groups = new Map();
  soldiers.forEach(function (soldier) {
    const unit = soldier.unit;
    if (!unit || unit.level >= getMaxTroopLevel(unit.type)) {
      return;
    }
    const key = unit.type + ":" + unit.level;
    const group = groups.get(key) || { type: unit.type, level: unit.level, count: 0 };
    group.count += 1;
    groups.set(key, group);
  });
  return Array.from(groups.values());
}

function setSelectedArmySoldier(game, typeId, level) {
  const soldiers = getArmySoldiers(game.player.army);
  const soldier = soldiers.find((item) => item.unit.type === typeId && item.unit.level === level) || soldiers[0];
  game.ui.selectedArmySoldierKey = soldier ? getArmySoldierKey(soldier) : null;
  game.ui.selectedArmySoldierKeys = [];
  if (soldier) {
    game.ui.armyPage = Math.floor(soldiers.indexOf(soldier) / getArmyPageSize(ARMY_GRID_LAYOUT));
  }
}

function toggleSelectedArmySoldier(game, key) {
  ensureArmySelectionState(game.ui);
  const soldiers = getArmySoldiers(game.player.army);
  const validKeys = new Set(soldiers.map(getArmySoldierKey));
  if (!validKeys.has(key)) {
    cleanSelectedArmySoldierKeys(game.ui, soldiers);
    return;
  }
  const keys = game.ui.selectedArmySoldierKeys;
  const index = keys.indexOf(key);
  if (index >= 0) {
    keys.splice(index, 1);
  } else {
    keys.push(key);
  }
  game.ui.selectedArmySoldierKey = null;
}

function setArmyMultiSelect(game, enabled) {
  ensureArmySelectionState(game.ui);
  game.ui.armyMultiSelect = Boolean(enabled);
  game.ui.selectedArmySoldierKey = null;
  if (!enabled) {
    game.ui.selectedArmySoldierKeys = [];
  }
}

function selectVisibleArmySoldiers(game) {
  ensureArmySelectionState(game.ui);
  const soldiers = getArmySoldiers(game.player.army);
  const page = getArmyPage(game.ui, "armyPage", soldiers.length, ARMY_GRID_LAYOUT);
  const visibleSoldiers = getArmyPageSoldiers(soldiers, page, ARMY_GRID_LAYOUT);
  game.ui.selectedArmySoldierKeys = visibleSoldiers.map(getArmySoldierKey);
  game.ui.selectedArmySoldierKey = null;
}

function clearArmyMultiSelection(game) {
  ensureArmySelectionState(game.ui);
  game.ui.selectedArmySoldierKeys = [];
}

function drawArmyToolbar(ctx, game, soldiers, selectedSoldiers, batchPreview, layout) {
  const multiSelect = Boolean(game.ui.armyMultiSelect);
  const selectedCount = selectedSoldiers.length;
  const canUpgrade = multiSelect && batchPreview.count > 0 && game.player.gold >= batchPreview.cost;
  const x = layout.x + 68;
  const y = layout.y - 34;
  const modeButton = addButton(game.ui, x, y, 68, 24, multiSelect ? "退出多选" : "多选", "toggleArmyMultiSelect");
  addButton(game.ui, x + 76, y, 68, 24, "本页全选", "selectVisibleArmySoldiers", !multiSelect || soldiers.length <= 0);
  addButton(game.ui, x + 152, y, 44, 24, "清空", "clearArmyMultiSelection", !multiSelect || selectedCount <= 0);
  addButton(game.ui, x + 204, y, 96, 24, "一键升级", "upgradeSelectedArmySoldiers", !canUpgrade);

  ctx.save();
  if (multiSelect) {
    ctx.strokeStyle = "rgba(125,243,255,0.52)";
    ctx.lineWidth = 1;
    ctx.strokeRect(modeButton.x - 2.5, modeButton.y - 2.5, modeButton.w + 5, modeButton.h + 5);
  }
  const status = multiSelect
    ? "已选 " + selectedCount + (batchPreview.count > 0 ? " / 可升级 " + batchPreview.count + " / " + batchPreview.cost + "金" : " / 无可升级")
    : "点击士兵查看详情";
  drawPixelText(ctx, status, layout.x, layout.y - 52, multiSelect ? "#7df3ff" : UI_TEXT.empty, 11);
  if (multiSelect && batchPreview.count > 0 && game.player.gold < batchPreview.cost) {
    drawPixelText(ctx, "金币不足", layout.x + 216, layout.y - 52, "#ff7568", 11);
  }
  ctx.restore();
}

function drawArmySoldierGrid(ctx, game, soldiers, selectedSoldier, options = {}) {
  const startX = options.x || 214;
  const startY = options.y || 148;
  const cols = options.cols || 10;
  const rows = options.rows || 7;
  const cell = options.cell || 42;
  const gap = options.gap || 7;
  const maxVisible = cols * rows;
  const clickable = options.clickable !== false;
  const actionPrefix = options.actionPrefix || "selectArmySoldier:";
  const selectedKey = selectedSoldier ? getArmySoldierKey(selectedSoldier) : "";
  const selectedKeys = options.selectedKeys || null;

  soldiers.slice(0, maxVisible).forEach(function (soldier, index) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = startX + col * (cell + gap);
    const y = startY + row * (cell + gap);
    const rect = { x, y, w: cell, h: cell };
    const hovered = clickable && game.input && rectContains(rect, game.input.mouse.x, game.input.mouse.y);
    const soldierKey = getArmySoldierKey(soldier);
    const selected = selectedKeys ? selectedKeys.has(soldierKey) : selectedKey === soldierKey;
    const stats = getTroopLevelStats(soldier.unit.type, soldier.unit.level);

    ctx.fillStyle = selected ? "rgba(255,213,106,0.16)" : hovered ? "rgba(125,243,255,0.12)" : "rgba(255,255,255,0.035)";
    ctx.fillRect(x, y, cell, cell);
    ctx.strokeStyle = selected ? "#ffd56a" : hovered ? (options.hoverColor || "#7df3ff") : (options.strokeColor || "#5f3f17");
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, cell, cell);
    drawTroopPortrait(ctx, soldier.unit.type, x + cell / 2, y + 21, stats.color, 0.72);
    drawArmyLevelBadge(ctx, x + cell - 22, y + cell - 15, soldier.unit.level);
    if (selectedKeys && selected) {
      drawArmySelectionMark(ctx, x + 4, y + 4);
    }
    if (clickable) {
      addButton(game.ui, x, y, cell, cell, stats.name, actionPrefix + soldierKey, false, true);
    }
  });
}

function drawArmySelectionMark(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(125,243,255,0.86)";
  ctx.fillRect(x, y, 11, 11);
  ctx.strokeStyle = "#050b0d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 6);
  ctx.lineTo(x + 5, y + 9);
  ctx.lineTo(x + 10, y + 2);
  ctx.stroke();
  ctx.restore();
}

function getArmyPageSize(layout) {
  return layout.cols * layout.rows;
}

function getArmyPage(ui, key, total, layout) {
  const pageSize = getArmyPageSize(layout);
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const current = Math.max(0, Math.min(maxPage, Math.floor(Number(ui[key] || 0))));
  ui[key] = current;
  return current;
}

function getArmyPageSoldiers(soldiers, page, layout) {
  const pageSize = getArmyPageSize(layout);
  const start = page * pageSize;
  return soldiers.slice(start, start + pageSize);
}

function stepArmyPage(ui, key, total, direction) {
  const pageSize = getArmyPageSize(ARMY_GRID_LAYOUT);
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const current = Math.max(0, Math.min(maxPage, Math.floor(Number(ui[key] || 0))));
  ui[key] = Math.max(0, Math.min(maxPage, current + direction));
}

function drawArmyPager(ctx, game, total, page, layout, key) {
  const pageSize = getArmyPageSize(layout);
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) {
    return;
  }
  const gridW = layout.cols * layout.cell + (layout.cols - 1) * layout.gap;
  const x = layout.x + gridW - 106;
  const y = layout.y - 34;
  addButton(game.ui, x, y, 26, 22, "<", key + ":prev", page <= 0);
  drawPixelText(ctx, (page + 1) + "/" + pageCount, x + 54, y + 4, "#d9f0ff", 11, "center");
  addButton(game.ui, x + 80, y, 26, 22, ">", key + ":next", page >= pageCount - 1);
}

function drawArmyLevelBadge(ctx, x, y, level) {
  ctx.save();
  ctx.fillStyle = "rgba(4, 8, 10, 0.86)";
  ctx.fillRect(Math.round(x), Math.round(y), 21, 12);
  ctx.strokeStyle = "rgba(255,213,106,0.72)";
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, 21, 12);
  drawPixelText(ctx, "Lv." + level, x + 2, y + 1, "#ffd56a", 8);
  ctx.restore();
}

function drawArmySoldierCard(ctx, game, soldier, options = {}) {
  const unit = soldier.unit;
  const stats = getTroopLevelStats(unit.type, unit.level);
  const readonly = Boolean(options.readonly);
  const next = !readonly && unit.level < getMaxTroopLevel(unit.type) ? getTroopLevelStats(unit.type, unit.level + 1) : null;
  const cost = readonly ? 0 : getSingleTroopUpgradeCost(unit);
  const cardX = 306;
  const cardY = 86;
  const cardW = 348;
  const cardH = 368;
  const contentX = cardX + 34;
  const contentY = cardY + 46;
  const statsBoxY = contentY + 86;
  const upgradeButton = { x: cardX + 104, y: cardY + cardH - 54, w: 140, h: 34 };
  const upgradeHovered = !readonly && game.input && rectContains(upgradeButton, game.input.mouse.x, game.input.mouse.y);
  const closeAction = options.closeAction || "closeArmySoldier";

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  addButton(game.ui, 0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight, "关闭士兵信息", closeAction, false, true);

  drawPanel(ctx, cardX, cardY, cardW, cardH, options.title || "士兵信息", "army");
  addPanelCloseButton(game.ui, cardX, cardY, cardW, closeAction);

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(contentX, statsBoxY, cardW - 68, 154);
  ctx.strokeStyle = "rgba(143,104,46,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(contentX + 0.5, statsBoxY + 0.5, cardW - 68, 154);

  drawTroopPortrait(ctx, unit.type, contentX + 34, contentY + 36, stats.color, 1.15);
  drawPixelText(ctx, stats.name, contentX + 82, contentY + 8, stats.color, 21);
  drawPixelText(ctx, stats.role, contentX + 82, contentY + 42, UI_TEXT.muted, 12);
  drawPixelText(ctx, "Lv." + unit.level + "  士气 " + Math.round(unit.morale || 0), contentX + 82, contentY + 62, UI_TEXT.main, 13);

  const rows = [
    ["生命", stats.hp, next ? next.hp : null],
    ["攻击", stats.attack, next ? next.attack : null],
    ["防御", stats.defense, next ? next.defense : null],
    ["射程", stats.range, next ? next.range : null],
    ["速度", stats.speed, next ? next.speed : null],
    ["暴击", Math.round(stats.crit * 100) + "%", next ? Math.round(next.crit * 100) + "%" : null],
    ["维护", stats.upkeep, next ? next.upkeep : null]
  ];
  rows.forEach(function (row, index) {
    drawArmyStatPreview(ctx, row[0], row[1], row[2], contentX + 24, statsBoxY + 14 + index * 19, upgradeHovered && Boolean(next));
  });

  if (!readonly) {
    const disabled = !next || game.player.gold < cost;
    addButton(game.ui, upgradeButton.x, upgradeButton.y, upgradeButton.w, upgradeButton.h, next ? "升级 " + cost + "金" : "满级", "upgradeSingleTroop:" + soldier.stackIndex, disabled);
  }
  ctx.restore();
}

function drawArmyStatPreview(ctx, label, value, nextValue, x, y, showDelta) {
  drawPixelText(ctx, label, x, y, UI_TEXT.label, 10);
  drawPixelText(ctx, String(value), x + 64, y, UI_TEXT.main, 10);
  if (!showDelta || nextValue === null || nextValue === undefined) {
    return;
  }
  const current = parseStatValue(value);
  const next = parseStatValue(nextValue);
  const delta = next - current;
  if (Math.abs(delta) < 0.001) {
    return;
  }
  const color = delta > 0 ? "#58ff8a" : "#ff7568";
  const sign = delta > 0 ? "+" : "";
  const text = typeof nextValue === "string" && String(nextValue).includes("%")
    ? sign + Math.round(delta) + "%"
    : sign + Math.round(delta);
  drawPixelText(ctx, text, x + 130, y, color, 10);
}

function parseStatValue(value) {
  return Number(String(value).replace("%", "")) || 0;
}

function drawTroopPortrait(ctx, troopType, x, y, color, scale = 1) {
  const px = Math.round(x);
  const py = Math.round(y);
  const s = scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(s, s);

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.fillRect(-15, -15, 30, 30);
  ctx.strokeStyle = "#5f3f17";
  ctx.lineWidth = 1;
  ctx.strokeRect(-15.5, -15.5, 30, 30);

  ctx.fillStyle = "#d8b58a";
  ctx.fillRect(-5, -10, 10, 8);
  ctx.fillStyle = color;
  ctx.fillRect(-7, -2, 14, 14);

  if (troopType === "infantry") {
    ctx.fillStyle = "#8a7a60";
    ctx.fillRect(-13, -4, 6, 13);
    ctx.fillStyle = "#d8d2c6";
    ctx.fillRect(8, -8, 3, 18);
    ctx.fillRect(6, -9, 7, 2);
  } else if (troopType === "pikeman") {
    ctx.fillStyle = "#8a7050";
    ctx.fillRect(9, -13, 2, 25);
    ctx.fillStyle = "#e8d8c0";
    ctx.fillRect(7, -15, 6, 5);
  } else if (troopType === "archer") {
    ctx.strokeStyle = "#c49a68";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(9, -2, 8, -1.25, 1.25);
    ctx.stroke();
    ctx.fillStyle = "#e8d8c0";
    ctx.fillRect(7, -2, 10, 1);
  } else if (troopType === "cavalry") {
    ctx.fillStyle = "#5a3a18";
    ctx.fillRect(-13, 6, 26, 8);
    ctx.fillRect(8, 0, 8, 8);
    ctx.fillStyle = "#7a6040";
    ctx.fillRect(5, -6, 18, 2);
  } else if (troopType === "mage") {
    ctx.fillStyle = "#5a3a5a";
    ctx.fillRect(10, -13, 3, 24);
    ctx.fillStyle = "#c79bff";
    ctx.fillRect(7, -17, 9, 7);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(10, -15, 3, 3);
  }

  ctx.fillStyle = "#2a1a0a";
  ctx.fillRect(-4, -7, 2, 2);
  ctx.fillRect(3, -7, 2, 2);
  ctx.restore();
}

// ==================== 设置界面 ====================

export function drawSettingsUi(ctx, game) {
  clearButtons(game.ui);

  const panelX = 300;
  const panelY = 72;
  const panelW = 360;
  drawPanel(ctx, panelX, panelY, panelW, 360, "设置", "settings");
  addPanelCloseButton(game.ui, panelX, panelY, panelW, "closeSettings");
  drawPixelText(ctx, "最大帧率", 336, 110, "#ffd56a", 15);
  drawPixelText(ctx, "当前 " + game.settings.maxFps + " FPS", 520, 112, UI_TEXT.main, 12);

  const options = [15, 24, 30, 45, 60];
  options.forEach(function (fps, index) {
    const selected = game.settings.maxFps === fps;
    addButton(game.ui, 336 + index * 58, 144, 48, 30, selected ? fps + "✓" : String(fps), "setFps:" + fps);
  });

  drawPixelText(ctx, "存档", 336, 206, "#ffd56a", 15);
  addButton(game.ui, 336, 240, 132, 34, "保存存档", "save");
  addButton(game.ui, 492, 240, 132, 34, "读取存档", "load");
  addButton(game.ui, 336, 284, 132, 34, document.fullscreenElement ? "退出全屏" : "全屏", "toggleFullscreen");
  drawPixelText(ctx, "兑换码", 336, 292, "#ffd56a", 15);
  addButton(game.ui, 492, 284, 132, 34, "输入兑换码", "openPrivilege");
  addButton(game.ui, 414, 342, 132, 36, "返回主界面", "backToStart");

  const baseButtonCount = game.ui.buttons.length;
  for (let i = 0; i < baseButtonCount; i += 1) {
    drawButton(ctx, game.ui.buttons[i], game.input);
  }

  if (game.privilege && game.privilege.open) {
    game.ui.buttons.length = 0;
    drawPrivilegeDialog(ctx, game);
    for (let i = 0; i < game.ui.buttons.length; i += 1) {
      drawButton(ctx, game.ui.buttons[i], game.input);
    }
  }
}

function drawPrivilegeDialog(ctx, game) {
  const value = game.privilege.input || "";
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, 960, 540);
  drawPanel(ctx, 304, 176, 352, 188, "兑换码", "settings");
  drawPixelText(ctx, "请输入兑换码", 480, 210, "#ffd56a", 16, "center");
  ctx.fillStyle = "rgba(45,31,18,0.72)";
  ctx.fillRect(348, 246, 264, 34);
  ctx.strokeStyle = BUTTON_THEME.light;
  ctx.lineWidth = 1;
  ctx.strokeRect(348.5, 246.5, 264, 34);
  drawPixelText(ctx, value || " ", 360, 254, value ? UI_TEXT.main : UI_TEXT.dim, 15);
  if (Math.floor(Date.now() / 450) % 2 === 0) {
    const cursorX = Math.min(596, 362 + value.length * 9);
    ctx.fillStyle = "#ffd56a";
    ctx.fillRect(cursorX, 254, 2, 18);
  }
  addButton(game.ui, 360, 310, 104, 34, "兑换", "redeemPrivilege");
  addButton(game.ui, 496, 310, 104, 34, "取消", "closePrivilege");
}

function drawEquipmentSlot(ctx, x, y, label, item, color, input, clickable, selected) {
  const hovered = Boolean(input && clickable && rectContains({ x, y, w: 120, h: 52 }, input.mouse.x, input.mouse.y));
  const pressed = Boolean(hovered && input.mouse.down);
  const drawY = y + (pressed ? 1 : 0);

  ctx.strokeStyle = selected ? "#ffd56a" : hovered ? "#ffd56a" : "#806035";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, drawY + 0.5, 120, 52);

  ctx.fillStyle = selected ? "rgba(255,213,106,0.12)" : hovered ? "rgba(138,98,54,0.28)" : "rgba(255,255,255,0.035)";
  ctx.fillRect(x + 2, drawY + 2, 116, 48);

  drawPixelText(ctx, label, x + 8, drawY + 4, hovered || selected ? "#ffd56a" : UI_TEXT.label, 10);
  drawPixelText(ctx, item, x + 8, drawY + 22, color, 13);

  // 小装饰
  ctx.fillStyle = color;
  ctx.fillRect(x + 100, drawY + 12, 8, 28);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x + 102, drawY + 14, 4, 24);
}

// ==================== 按钮点击处理 ====================

export function handleUiAction(game, action) {
  if (!action) return false;

  if (action === "menu") {
    clearAttributeSession(game);
    game.state = "menu";
    game.message = "属性界面：查看装备、分配技能点、管理存档";
    return true;
  }
  if (action === "army") {
    game.state = "army";
    game.message = "军队管理：花费金币升级部队";
    return true;
  }
  if (action === "closeMenu") {
    clearAttributeSession(game);
    game.state = "world";
    return true;
  }
  if (action === "closeArmy") {
    clearArmyUiState(game.ui);
    game.state = "world";
    return true;
  }
  if (action === "settings") {
    game.previousState = game.state === "settings" ? "world" : game.state;
    game.state = "settings";
    return true;
  }
  if (action === "openPrivilege") {
    game.privilege = { open: true, input: "", busy: false };
    return true;
  }
  if (action === "toggleFullscreen") {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      var target = document.querySelector(".game-shell") || document.documentElement;
      if (target.requestFullscreen) {
        target.requestFullscreen();
      }
    }
    return true;
  }
  if (action === "closePrivilege") {
    if (game.privilege) {
      game.privilege.open = false;
    }
    return true;
  }
  if (action === "closeSettings") {
    game.state = game.previousState && game.previousState !== "settings" ? game.previousState : "world";
    game.previousState = null;
    return true;
  }
  if (action === "backToStart") {
    if (game.state !== "start") {
      game.__requestSaveBeforeStart = true;
    }
    game.state = "start";
    game.previousState = null;
    game.activeTown = null;
    game.nearTown = null;
    game.nearResource = null;
    game.capturingResource = null;
    game.battle = null;
    game.pendingEncounter = null;
    game.encounter = null;
    resetTownUi(game);
    clearArmyUiState(game.ui);
    clearEnemyArmyPreview(game.ui);
    if (game.player) {
      game.player.target = null;
    }
    return true;
  }
  if (action === "leaveTown") {
    leaveTown(game);
    return true;
  }
  if (action.indexOf("townView:") === 0) {
    game.ui.townView = action.split(":")[1] || "home";
    game.ui.selectedMarketItem = null;
    return true;
  }
  if (action === "rest") {
    restAtTown(game);
    return true;
  }
  if (action === "developTown") {
    developTown(game);
    return true;
  }
  if (action.indexOf("recruit:") === 0) {
    var parts = action.split(":");
    recruitFromTown(game, parts[1], Number(parts[2]));
    return true;
  }
  if (action.indexOf("upgradeTroop:") === 0) {
    var stackIndex = Number(action.split(":")[1]);
    var result = upgradeSingleTroop(game.player, stackIndex);
    setNotice(game, result.ok ? "升级完成" : "无法升级", [result.message], 1.8, "gold");
    if (result.ok && result.upgraded) {
      setSelectedArmySoldier(game, result.upgraded.type, result.upgraded.level);
    }
    return true;
  }
  if (action.indexOf("upgradeSingleTroop:") === 0) {
    var singleStackIndex = Number(action.split(":")[1]);
    var singleResult = upgradeSingleTroop(game.player, singleStackIndex);
    setNotice(game, singleResult.ok ? "升级完成" : "无法升级", [singleResult.message], 1.8, "gold");
    if (singleResult.ok && singleResult.upgraded) {
      setSelectedArmySoldier(game, singleResult.upgraded.type, singleResult.upgraded.level);
    }
    return true;
  }
  if (action === "toggleArmyMultiSelect") {
    setArmyMultiSelect(game, !game.ui.armyMultiSelect);
    game.message = game.ui.armyMultiSelect ? "多选模式：选择士兵后一键升级" : "军队管理：花费金币升级部队";
    return true;
  }
  if (action === "selectVisibleArmySoldiers") {
    selectVisibleArmySoldiers(game);
    return true;
  }
  if (action === "clearArmyMultiSelection") {
    clearArmyMultiSelection(game);
    return true;
  }
  if (action === "upgradeSelectedArmySoldiers") {
    var soldiers = getArmySoldiers(game.player.army);
    cleanSelectedArmySoldierKeys(game.ui, soldiers);
    var selectedSoldiers = getSelectedArmySoldiers(game.ui, soldiers);
    var batchResult = upgradeTroopBatch(game.player, getArmySoldierUpgradeGroups(selectedSoldiers));
    setNotice(game, batchResult.ok ? "批量升级完成" : "无法升级", [batchResult.message], 1.8, "gold");
    game.message = batchResult.message;
    if (batchResult.ok) {
      game.ui.selectedArmySoldierKeys = [];
      game.ui.selectedArmySoldierKey = null;
    }
    return true;
  }
  if (action.indexOf("selectArmySoldier:") === 0) {
    game.ui.selectedArmySoldierKey = action.slice("selectArmySoldier:".length);
    game.ui.selectedArmySoldierKeys = [];
    return true;
  }
  if (action.indexOf("toggleArmySoldier:") === 0) {
    toggleSelectedArmySoldier(game, action.slice("toggleArmySoldier:".length));
    return true;
  }
  if (action.indexOf("armyPage:") === 0) {
    stepArmyPage(game.ui, "armyPage", getArmySoldiers(game.player.army).length, action.endsWith(":next") ? 1 : -1);
    game.ui.selectedArmySoldierKey = null;
    return true;
  }
  if (action === "closeArmySoldier") {
    game.ui.selectedArmySoldierKey = null;
    return true;
  }
  if (action === "openTownArmyPreview") {
    if (game.nearTown && game.nearTown.owner !== "player") {
      game.ui.enemyArmyPreview = {
        source: "town",
        title: game.nearTown.name + " 守军",
        subtitle: "敌方城池守军",
        army: game.nearTown.garrison || []
      };
      game.ui.enemyArmyPage = 0;
    }
    return true;
  }
  if (action === "openEncounterArmyPreview") {
    if (game.encounter && game.encounter.enemy) {
      var enemy = game.encounter.enemy;
      game.ui.enemyArmyPreview = {
        source: "encounter",
        title: (enemy.name || "敌军") + " 编制",
        subtitle: "遭遇敌军",
        army: enemy.army || enemy.garrison || []
      };
      game.ui.enemyArmyPage = 0;
    }
    return true;
  }
  if (action.indexOf("enemyArmyPage:") === 0) {
    const preview = game.ui.enemyArmyPreview;
    const army = preview && Array.isArray(preview.army) ? preview.army : [];
    stepArmyPage(game.ui, "enemyArmyPage", getArmySoldiers(army).length, action.endsWith(":next") ? 1 : -1);
    return true;
  }
  if (action === "closeEnemyArmyPreview") {
    clearEnemyArmyPreview(game.ui);
    return true;
  }
  if (action.indexOf("selectMarketItem:") === 0) {
    var marketParts = action.split(":");
    game.ui.selectedMarketItem = { kind: marketParts[1], id: marketParts[2] };
    setSelectedEquipment(game, null);
    return true;
  }
  if (action.indexOf("buyMarket:") === 0) {
    var buyParts = action.split(":");
    var buyResult = buyMarketItem(game, game.activeTown, buyParts[1], buyParts[2]);
    game.message = buyResult.message;
    setNotice(game, buyResult.ok ? "交易完成" : "交易失败", [buyResult.message], 1.6, "gold");
    return true;
  }
  if (action.indexOf("sellMarket:") === 0) {
    var sellParts = action.split(":");
    var sellResult = sellMarketItem(game, game.activeTown, sellParts[1], sellParts[2]);
    game.message = sellResult.message;
    setNotice(game, sellResult.ok ? "交易完成" : "交易失败", [sellResult.message], 1.6, "gold");
    if (!sellResult.ok || !playerOwnsMarketItem(game.player, sellParts[1], sellParts[2])) {
      game.ui.selectedMarketItem = null;
    }
    return true;
  }
  if (action === "closeMarketDetail") {
    game.ui.selectedMarketItem = null;
    return true;
  }
  if (action.indexOf("selectEquipment:") === 0) {
    selectEquipment(game, action.split(":")[1]);
    game.ui.selectedMarketItem = null;
    return true;
  }
  if (action === "closeEquipmentDetail") {
    setSelectedEquipment(game, null);
    return true;
  }
  if (action === "equipSelectedEquipment") {
    var selectedEquipId = getSelectedEquipmentId(game);
    if (selectedEquipId) {
      equipPlayerWeapon(game.player, selectedEquipId);
      setSelectedEquipment(game, null);
    }
    return true;
  }
  if (action === "unequipSelectedEquipment") {
    unequipPlayerWeapon(game.player);
    setSelectedEquipment(game, null);
    return true;
  }
  if (action.indexOf("attrAdd:") === 0) {
    addSessionAttributePoint(game, action.split(":")[1]);
    return true;
  }
  if (action.indexOf("attrUndo:") === 0) {
    undoSessionAttributePoint(game, action.split(":")[1]);
    return true;
  }
  return false;
}

function equipPlayerWeapon(player, weaponId) {
  if (!WEAPONS[weaponId]) {
    return { ok: false, message: "未知武器" };
  }
  ensurePlayerEquipmentState(player);
  if (!player.inventory.includes(weaponId)) {
    return { ok: false, message: "尚未获得该武器" };
  }

  const currentWeaponId = getEquippedWeaponId(player);
  if (currentWeaponId === weaponId) {
    removeWeaponFromInventory(player, weaponId);
    return { ok: true, message: WEAPONS[weaponId].name + " 已在装备槽" };
  }

  removeWeaponFromInventory(player, weaponId);
  if (currentWeaponId) {
    addWeaponToInventory(player, currentWeaponId);
  }

  player.general.weapon = weaponId;
  player.equipment.weapon = WEAPONS[weaponId].name;
  return { ok: true, message: "已装备 " + WEAPONS[weaponId].name };
}

function selectEquipment(game, weaponId) {
  if (!WEAPONS[weaponId]) {
    return false;
  }
  setSelectedEquipment(game, weaponId);
  return true;
}

function getSelectedEquipmentId(game) {
  const selected = game.ui && game.ui.selectedEquipmentId;
  return selected && WEAPONS[selected] ? selected : null;
}

function setSelectedEquipment(game, weaponId) {
  if (!game.ui) {
    return;
  }
  game.ui.selectedEquipmentId = weaponId && WEAPONS[weaponId] ? weaponId : null;
}

function unequipPlayerWeapon(player) {
  ensurePlayerEquipmentState(player);
  const currentWeaponId = getEquippedWeaponId(player);
  if (!currentWeaponId) {
    player.general.weapon = null;
    player.equipment.weapon = EMPTY_WEAPON.name;
    return { ok: false, message: "武器槽已经为空" };
  }

  addWeaponToInventory(player, currentWeaponId);
  player.general.weapon = null;
  player.equipment.weapon = EMPTY_WEAPON.name;
  return { ok: true, message: "已卸下 " + WEAPONS[currentWeaponId].name };
}

function ensurePlayerEquipmentState(player) {
  if (!player.general) {
    player.general = { name: "沈铁冠", faction: "player", level: Math.max(1, player.level || 1), weapon: "oldSword" };
  }
  if (!player.inventory) {
    player.inventory = [];
  }
  if (!player.equipment) {
    player.equipment = { weapon: "旧王短剑", armor: EMPTY_WEAPON.name, trinket: EMPTY_WEAPON.name };
  }
  normalizeEmptyGearSlots(player);
  if (player.general.weapon && !WEAPONS[player.general.weapon]) {
    player.general.weapon = null;
    player.equipment.weapon = EMPTY_WEAPON.name;
  }
  player.inventory = getInventoryWeaponIds(player);
}

function normalizeEmptyGearSlots(player) {
  if (!player.equipment.weapon) {
    player.equipment.weapon = getEquippedWeaponId(player) ? "旧王短剑" : EMPTY_WEAPON.name;
  }
  if (!player.equipment.armor || player.equipment.armor === "旅人皮甲") {
    player.equipment.armor = EMPTY_WEAPON.name;
  }
  if (!player.equipment.trinket || player.equipment.trinket === "铁冠纹章") {
    player.equipment.trinket = EMPTY_WEAPON.name;
  }
}

function getGearSlotColor(item, fallback) {
  return item === EMPTY_WEAPON.name ? EMPTY_WEAPON.color : fallback;
}

function getWeaponNameColor(weapon) {
  const quality = weapon && weapon.quality ? weapon.quality : "common";
  return QUALITY_COLORS[quality] || weapon.color || QUALITY_COLORS.common;
}

function getQualityName(weapon) {
  const quality = weapon && weapon.quality ? weapon.quality : "common";
  return QUALITY_NAMES[quality] || QUALITY_NAMES.common;
}

function formatEquipmentStats(weapon) {
  const stats = [];
  if ((weapon.attack || 0) !== 0) {
    stats.push("攻击 +" + weapon.attack);
  }
  if ((weapon.defense || 0) !== 0) {
    stats.push("防御 +" + weapon.defense);
    stats.push("血量 +" + weapon.defense * 8);
  }
  if ((weapon.range || 0) !== 0) {
    stats.push("射程 " + weapon.range);
  }
  if ((weapon.crit || 0) !== 0) {
    stats.push("暴击 +" + Math.round(weapon.crit * 100) + "%");
  }
  return stats.length ? stats : ["无属性"];
}

function ensureAttributeSession(game) {
  if (!game.ui.attributeSession) {
    game.ui.attributeSession = {
      adds: { strength: 0, agility: 0, intelligence: 0, leadership: 0 }
    };
  }
}

function clearAttributeSession(game) {
  if (game.ui) {
    game.ui.attributeSession = null;
    game.ui.selectedEquipmentId = null;
  }
}

function getAttributeSessionAdds(game, attr) {
  return game.ui.attributeSession && game.ui.attributeSession.adds
    ? game.ui.attributeSession.adds[attr] || 0
    : 0;
}

function addSessionAttributePoint(game, attr) {
  ensureAttributeSession(game);
  if (game.player.skillPoints <= 0 || !ATTR_IDS.includes(attr)) {
    return false;
  }
  game.player.skillPoints -= 1;
  game.player.attributes[attr] += 1;
  game.ui.attributeSession.adds[attr] = getAttributeSessionAdds(game, attr) + 1;
  return true;
}

function undoSessionAttributePoint(game, attr) {
  ensureAttributeSession(game);
  if (!ATTR_IDS.includes(attr) || getAttributeSessionAdds(game, attr) <= 0) {
    return false;
  }
  game.ui.attributeSession.adds[attr] -= 1;
  game.player.attributes[attr] -= 1;
  game.player.skillPoints += 1;
  return true;
}

function getEquippedWeaponId(player) {
  const weaponId = player && player.general ? player.general.weapon : null;
  return weaponId && WEAPONS[weaponId] ? weaponId : null;
}

function getEquippedWeapon(player) {
  const weaponId = getEquippedWeaponId(player);
  return weaponId ? WEAPONS[weaponId] : EMPTY_WEAPON;
}

function getInventoryWeaponIds(player) {
  return Array.from(new Set((player.inventory || []).filter((id) => WEAPONS[id])));
}

function addWeaponToInventory(player, weaponId) {
  if (!WEAPONS[weaponId]) {
    return;
  }
  if (!player.inventory) {
    player.inventory = [];
  }
  removeWeaponFromInventory(player, weaponId);
  player.inventory.push(weaponId);
}

function removeWeaponFromInventory(player, weaponId) {
  if (!player.inventory) {
    player.inventory = [];
    return;
  }
  player.inventory = player.inventory.filter((id) => id !== weaponId);
}

export function getClickedButton(ui, point) {
  if (!point) return null;
  for (var i = ui.buttons.length - 1; i >= 0; i--) {
    if (!ui.buttons[i].disabled && rectContains(ui.buttons[i], point.x, point.y)) {
      return ui.buttons[i];
    }
  }
  return null;
}
