import { CONFIG, FACTIONS } from "./config.js";
import { WEAPONS } from "./config.js";
import { expToNextLevel, getTownDailyIncome } from "./player.js";
import { getArmyPower, getArmySize, getMaxArmySize, getMaxTroopLevel, getRecruitOptions, getRosterLines, getTroopLevelStats, getTroopUpgradeCost, isArmyMoraleFull, upgradeArmyStack } from "./troop.js";
import { developTown, getTownDevelopmentCost, leaveTown, recruitFromTown, restAtTown } from "./town.js";
import { drawBar, drawPanel, drawPixelText, formatNumber, rectContains } from "./utils.js";

// UI 模块：维护按钮、HUD、城池面板和菜单面板的绘制与点击处理。

const QUEST_PANEL = { x: 664, y: 64, w: 280, h: 116 };

const EMPTY_WEAPON = {
  id: "none",
  name: "未装备",
  quality: "none",
  attack: 0,
  defense: 0,
  range: 30,
  crit: 0,
  color: "#6f6048"
};

const QUALITY_COLORS = {
  none: "#6f6048",
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
  return { buttons: [], toastTimer: 0 };
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
  ctx.fillStyle = pressed ? "#080503" : "#110b05";
  ctx.fillRect(x + 2, y + 2, w, h);

  // 主体
  ctx.fillStyle = disabled ? "#3d3222" : pressed ? "#3e2a18" : hovered ? "#6a4628" : "#4a3520";
  ctx.fillRect(x, drawY, w, h);

  // 高光线
  ctx.fillStyle = disabled ? "#5a4d3a" : hovered ? "#ffd56a" : "#8f682e";
  ctx.fillRect(x, drawY, w, 2);
  ctx.fillRect(x, drawY, 2, h);

  // 暗线
  ctx.fillStyle = disabled ? "#2a1f12" : pressed ? "#160d06" : "#2a1a0a";
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
  ctx.fillStyle = disabled ? "#6b5d45" : hovered ? "#fff0a8" : "#ffd56a";
  ctx.font = "bold 13px Microsoft YaHei UI, Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.imageSmoothingEnabled = false;
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

  drawPanel(ctx, 10, 8, 410, 70, "领主状态");
  const avatarButton = addButton(game.ui, 24, 26, 40, 40, "", "menu", false, true);
  drawAvatar(ctx, avatarButton, player, game.input);

  drawPixelText(ctx, player.name, 78, 25, "#ffd56a", 16);
  drawPixelText(ctx, "Lv." + player.level, 166, 28, "#d6a84f", 12);
  drawPixelText(ctx, "第 " + player.day + " 日", 224, 28, "#b9a77a", 12);

  drawHudMetric(ctx, "金币", formatNumber(player.gold), 78, 48, "#ffe6a6");
  drawHudMetric(ctx, "兵力", armySize + "/" + maxSize, 166, 48, "#d9f0ff");
  drawHudMetric(ctx, "战力", String(power), 278, 48, "#ffe6a6");
  drawBar(ctx, 78, 68, 206, 5, game.elapsedDayTimer / game.dayLength, "#ffd56a", "#28170c", "#5f3f17");
  drawPixelText(ctx, Math.ceil(Math.max(0, game.dayLength - game.elapsedDayTimer)) + "秒", 294, 63, "#b9a77a", 10);

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
  ctx.fillStyle = hovered ? "#6a4628" : "#3b2a1a";
  ctx.fillRect(x - 2, y - 2, 44, 44);
  ctx.strokeStyle = hovered ? "#ffd56a" : "#8f682e";
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

function drawHudMetric(ctx, label, value, x, y, valueColor) {
  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.font = "600 12px Microsoft YaHei UI, Microsoft YaHei, sans-serif";
  ctx.fillStyle = "#b9a77a";
  ctx.fillText(label, Math.round(x), Math.round(y));
  ctx.font = "800 16px Consolas, \"Microsoft YaHei UI\", monospace";
  ctx.fillStyle = valueColor;
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 2;
  ctx.fillText(value, Math.round(x + 31), Math.round(y - 2));
  ctx.restore();
}

function drawTravelDestinationHint(ctx, game, button) {
  const dx = game.travelDestination.x - game.player.x;
  const dy = game.travelDestination.y - game.player.y;
  const distance = Math.round(Math.hypot(dx, dy) / CONFIG.tileSize);
  ctx.save();
  ctx.fillStyle = "rgba(3, 8, 10, 0.72)";
  ctx.fillRect(button.x - 8, button.y + button.h + 6, button.w + 16, 20);
  ctx.strokeStyle = "rgba(125,243,255,0.42)";
  ctx.lineWidth = 1;
  ctx.strokeRect(button.x - 7.5, button.y + button.h + 6.5, button.w + 16, 20);
  drawPixelText(ctx, "目的地 " + distance + "格", button.x + button.w / 2, button.y + button.h + 11, "#7df3ff", 10, "center");
  ctx.restore();
}

function drawQuestTracker(ctx, game) {
  if (game.state !== "world") {
    return;
  }
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
  drawPixelText(ctx, fitPixelText(ctx, objective, panelW - 66, 12), panelX + 18, panelY + 24, "#f8e9bd", 12);
  drawQuestRow(ctx, "城镇", ownedTowns, towns.length, panelX + 18, panelY + 48, "#ffd56a");
  drawQuestRow(ctx, "资源", ownedResources, resources.length, panelX + 18, panelY + 68, "#32ff9a");
  drawQuestRow(ctx, "探索", explored, 100, panelX + 18, panelY + 88, "#7df3ff", "%");
}

function drawQuestRow(ctx, label, value, max, x, y, color, suffix) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  drawPixelText(ctx, label, x, y - 2, "#b9a77a", 10);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(x + 48, y, 150, 7);
  ctx.fillStyle = color;
  ctx.fillRect(x + 48, y, Math.round(150 * ratio), 7);
  ctx.strokeStyle = "rgba(248,233,189,0.26)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 48.5, y + 0.5, 150, 7);
  drawPixelText(ctx, value + (suffix || "/" + max), x + 212, y - 4, color, 11);
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
        : "#d7c89e";
    ctx.fillStyle = color;
    ctx.fillRect(x + 12, y + 16 + index * 16, 4, 4);
    drawPixelText(ctx, fitPixelText(ctx, report.text, w - 38, 10), x + 22, y + 11 + index * 16, color, 10);
  });
  ctx.restore();
}

function fitPixelText(ctx, text, maxWidth, size) {
  const value = String(text || "");
  ctx.save();
  ctx.font = `${size >= 12 ? 600 : 500} ${size}px "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif`;
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
  drawPixelText(ctx, kindText + " / " + ownerText + " / +" + resource.income + "金/日", panelX + 18, panelY + 22, "#f8e9bd", 13);
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
  drawPanel(ctx, panelX, panelY, 232, 82, town.name);
  drawPixelText(ctx, owner.name, panelX + 20, panelY + 22, owner.color, 14);

  const siegeDisabled = town.owner === "player";
  const enterButton = addButton(game.ui, panelX + 20, panelY + 48, 86, 28, "进城", "enterNearbyTown");
  const siegeButton = addButton(game.ui, panelX + 126, panelY + 48, 86, 28, "攻城", "siegeNearbyTown", siegeDisabled);
  drawButton(ctx, enterButton, game.input);
  drawButton(ctx, siegeButton, game.input);
}

// ==================== 城池面板 ====================

export function drawTownUi(ctx, game) {
  const town = game.activeTown;
  clearButtons(game.ui);

  drawPanel(ctx, 140, 48, 680, 444, town.name);

  const owner = FACTIONS[town.owner];
  const kindText = town.kind === "castle" ? "城池" : town.kind === "tavern" ? "酒馆" : "村庄";
  drawPixelText(ctx, kindText + " / " + owner.name, 168, 88, owner.color, 15);

  // 城池信息栏
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(168, 110, 624, 36);
  drawPixelText(ctx, "城防 " + Math.round(town.defense), 180, 116, "#ffd56a", 12);
  drawPixelText(ctx, "收益 " + getTownDailyIncome(town) + " 金/日", 310, 116, "#f8e9bd", 12);
  drawPixelText(ctx, "驻军战力 " + Math.round(getArmyPower(town.garrison)), 460, 116, "#d7c89e", 12);
  drawPixelText(ctx, "你的金币 " + formatNumber(game.player.gold), 610, 116, "#ffd56a", 12);
  drawPixelText(ctx, "守军等级 " + Math.floor(town.garrisonLevel || 1), 180, 134, "#b9a77a", 11);

  // 可招募兵种
  drawPixelText(ctx, "招募兵种", 168, 170, "#ffd56a", 14);
  const recruitOptions = getRecruitOptions(town);
  recruitOptions.forEach((type, index) => {
    const y = 188 + index * 44;

    // 兵种背景条
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(168, y - 4, 384, 36);

    drawTroopPortrait(ctx, type.id, 185, y + 12, type.color, 0.78);

    // 兵种名
    drawPixelText(ctx, type.name, 212, y, type.color, 14);
    drawPixelText(ctx, type.role, 272, y, "#b9a77a", 11);
    drawPixelText(ctx, type.cost + " 金/人   生命 " + type.hp + "   攻击 " + type.attack, 212, y + 18, "#d7c89e", 10);

    const cannotBuy3 = game.player.gold < type.cost * 3;
    const cannotBuy10 = game.player.gold < type.cost * 10;
    addButton(game.ui, 586, y, 76, 28, "招募x3", "recruit:" + type.id + ":3", cannotBuy3);
    addButton(game.ui, 670, y, 76, 28, "招募x10", "recruit:" + type.id + ":10", cannotBuy10);
  });

  // 我军编制
  const rosterY = 188 + recruitOptions.length * 44 + 8;
  drawPixelText(ctx, "我军编制", 168, rosterY, "#ffd56a", 14);
  getRosterLines(game.player.army).slice(0, 5).forEach((line, index) => {
    drawPixelText(ctx, line, 168, rosterY + 22 + index * 18, "#d7c89e", 11);
  });

  // 操作按钮
  const restCost = Math.max(8, Math.round(getArmyPower(game.player.army) * 0.015));
  const developCost = getTownDevelopmentCost(town);
  const moraleFull = isArmyMoraleFull(game.player.army);
  const canManageTown = town.owner === "player";
  addButton(game.ui, 586, 330, 170, 32, "整补士气 " + restCost + "金", "rest", game.player.gold < restCost || moraleFull);
  addButton(game.ui, 586, 380, 170, 32, "发展城市 " + developCost + "金", "developTown", !canManageTown || game.player.gold < developCost);
  addButton(game.ui, 586, 450, 170, 32, "离开城镇", "leaveTown");

  for (const btn of game.ui.buttons) {
    drawButton(ctx, btn, game.input);
  }
}

// ==================== 属性界面 ====================

export function drawMenuUi(ctx, game) {
  clearButtons(game.ui);
  ensurePlayerEquipmentState(game.player);
  ensureAttributeSession(game);

  const panelX = 142;
  const panelY = 42;
  const panelW = 676;
  drawPanel(ctx, panelX, panelY, panelW, 458, "属性界面");
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

    drawPixelText(ctx, row.name, x + 10, y + 4, "#f8e9bd", 13);
    drawPixelText(ctx, String(row.value), x + 88, y + 6, "#ffd56a", 13, "center");

    addButton(game.ui, x + 50, y - 1, 28, 26, "-", "attrUndo:" + row.id, sessionAdds <= 0);
    addButton(game.ui, x + 108, y - 1, 28, 26, "+", "attrAdd:" + row.id, game.player.skillPoints <= 0);
  });

  drawEquipmentInventory(ctx, game);

  const baseButtonCount = game.ui.buttons.length;
  for (var i = 0; i < baseButtonCount; i++) {
    drawButton(ctx, game.ui.buttons[i], game.input);
  }
  drawEquipmentDetailPopup(ctx, game);
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
  const rows = [
    ["等级", stats.level, "经验", stats.exp + "/" + stats.expNext],
    ["血量", stats.hp, "攻击", stats.attack],
    ["防御", stats.defense, "速度", stats.speed],
    ["射程", stats.range, "暴击", stats.crit + "%"]
  ];
  rows.forEach(function (row, index) {
    const yPos = y + index * 16;
    drawPixelText(ctx, row[0], x, yPos, "#8f682e", 10);
    drawPixelText(ctx, String(row[1]), x + 42, yPos, "#f8e9bd", 11);
    if (row[2]) {
      drawPixelText(ctx, row[2], x + 116, yPos, "#8f682e", 10);
      drawPixelText(ctx, String(row[3]), x + 158, yPos, "#f8e9bd", 11);
    }
  });
}

function drawEquipmentInventory(ctx, game) {
  const equipped = getEquippedWeaponId(game.player);
  const weaponIds = getInventoryWeaponIds(game.player).filter((id) => id !== equipped);

  drawPixelText(ctx, "装备切换", 456, 286, "#ffd56a", 15);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(456, 310, 308, 72);

  if (!weaponIds.length) {
    drawPixelText(ctx, "暂无可切换装备", 610, 336, "#8f8060", 12, "center");
    return;
  }

  weaponIds.slice(0, 6).forEach(function (id, index) {
    const weapon = WEAPONS[id];
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 470 + col * 94;
    const y = 318 + row * 30;
    const rect = { x, y, w: 84, h: 26 };
    const selected = getSelectedEquipmentId(game) === id;
    const hovered = game.input && rectContains(rect, game.input.mouse.x, game.input.mouse.y);
    const pressed = hovered && game.input.mouse.down;
    const drawY = y + (pressed ? 1 : 0);
    ctx.fillStyle = selected ? "rgba(255,213,106,0.14)" : hovered ? "rgba(106,70,40,0.72)" : "rgba(0,0,0,0.18)";
    ctx.fillRect(x, drawY, 84, 26);
    ctx.strokeStyle = selected ? "#ffd56a" : hovered ? "#d6a84f" : "#5f3f17";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, drawY + 0.5, 84, 26);
    drawPixelText(ctx, weapon.name, x + 6, drawY + 7, getWeaponNameColor(weapon), 10);
    addButton(game.ui, x, y, 84, 26, "查看装备", "selectEquipment:" + id, false, true);
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
  drawPanel(ctx, x, y, w, h, "装备信息");
  addPanelCloseButton(game.ui, x, y, w, "closeEquipmentDetail");

  const contentX = x + 34;
  const contentY = y + 44;
  drawPixelText(ctx, weapon.name, contentX, contentY, getWeaponNameColor(weapon), 20);
  drawPixelText(ctx, getQualityName(weapon) + " / 武器", contentX, contentY + 34, "#b9a77a", 12);

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
    drawPixelText(ctx, line, statX, statY, "#f8e9bd", 13);
  });
  addButton(game.ui, x + 114, y + h - 50, 120, 34, equipped ? "卸下" : "穿戴", equipped ? "unequipSelectedEquipment" : "equipSelectedEquipment");
}

// ==================== 军队管理 ====================

export function drawArmyUi(ctx, game) {
  clearButtons(game.ui);

  const panelX = 176;
  const panelY = 48;
  const panelW = 608;
  drawPanel(ctx, panelX, panelY, panelW, 444, "军队管理");
  addPanelCloseButton(game.ui, panelX, panelY, panelW, "closeArmy");
  drawPixelText(ctx, "金币 " + formatNumber(game.player.gold), 214, 84, "#ffd56a", 14);
  drawPixelText(ctx, "兵力 " + getArmySize(game.player.army) + "/" + getMaxArmySize(game.player), 344, 84, "#d9f0ff", 14);
  drawPixelText(ctx, "战力 " + Math.round(getArmyPower(game.player.army)), 484, 84, "#f8e9bd", 14);

  drawPixelText(ctx, "部队", 214, 122, "#b9a77a", 11);
  drawPixelText(ctx, "当前属性", 380, 122, "#b9a77a", 11);
  drawPixelText(ctx, "下级属性", 540, 122, "#b9a77a", 11);

  if (!game.player.army.length) {
    drawPixelText(ctx, "暂无部队", 480, 236, "#b9a77a", 16, "center");
  }

  game.player.army.forEach(function (unit, index) {
    const y = 146 + index * 58;
    const type = getTroopLevelStats(unit.type, unit.level);
    const maxLevel = getMaxTroopLevel(unit.type);
    const next = unit.level < maxLevel ? getTroopLevelStats(unit.type, unit.level + 1) : null;
    const cost = getTroopUpgradeCost(unit);

    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(206, y - 8, 540, 48);
    drawTroopPortrait(ctx, unit.type, 228, y + 12, type.color, 0.74);
    drawPixelText(ctx, type.name + " Lv." + unit.level, 252, y - 2, type.color, 14);
    drawPixelText(ctx, "x" + unit.count + " 士气" + unit.morale, 252, y + 18, "#d7c89e", 10);
    drawPixelText(ctx, formatTroopStats(type), 380, y + 2, "#f8e9bd", 10);
    drawPixelText(ctx, next ? formatTroopStats(next) : "已满级", 540, y + 2, next ? "#d9f0ff" : "#b9a77a", 10);

    const disabled = !next || game.player.gold < cost;
    addButton(game.ui, 646, y + 4, 86, 28, next ? "升级 " + cost : "满级", "upgradeTroop:" + index, disabled);
  });

  for (var i = 0; i < game.ui.buttons.length; i++) {
    drawButton(ctx, game.ui.buttons[i], game.input);
  }
}

function formatTroopStats(stats) {
  return "攻" + stats.attack + " 防" + stats.defense + " 血" + stats.hp + " 速" + stats.speed;
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
  drawPanel(ctx, panelX, panelY, panelW, 360, "设置");
  addPanelCloseButton(game.ui, panelX, panelY, panelW, "closeSettings");
  drawPixelText(ctx, "最大帧率", 336, 110, "#ffd56a", 15);
  drawPixelText(ctx, "当前 " + game.settings.maxFps + " FPS", 520, 112, "#f8e9bd", 12);

  const options = [15, 24, 30, 45, 60];
  options.forEach(function (fps, index) {
    const selected = game.settings.maxFps === fps;
    addButton(game.ui, 336 + index * 58, 144, 48, 30, selected ? fps + "✓" : String(fps), "setFps:" + fps);
  });

  drawPixelText(ctx, "存档", 336, 206, "#ffd56a", 15);
  addButton(game.ui, 336, 240, 132, 34, "保存游戏", "save");
  addButton(game.ui, 492, 240, 132, 34, "读取存档", "load");
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
  drawPanel(ctx, 304, 176, 352, 188, "兑换码");
  drawPixelText(ctx, "请输入兑换码", 480, 210, "#ffd56a", 16, "center");
  ctx.fillStyle = "#110b05";
  ctx.fillRect(348, 246, 264, 34);
  ctx.strokeStyle = "#8f682e";
  ctx.lineWidth = 1;
  ctx.strokeRect(348.5, 246.5, 264, 34);
  drawPixelText(ctx, value || " ", 360, 254, value ? "#f8e9bd" : "#6f6048", 15);
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

  ctx.strokeStyle = selected ? "#ffd56a" : hovered ? "#ffd56a" : "#5f3f17";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, drawY + 0.5, 120, 52);

  ctx.fillStyle = selected ? "rgba(255,213,106,0.12)" : hovered ? "rgba(106,70,40,0.36)" : "rgba(0,0,0,0.2)";
  ctx.fillRect(x + 2, drawY + 2, 116, 48);

  drawPixelText(ctx, label, x + 8, drawY + 4, hovered || selected ? "#ffd56a" : "#8f682e", 10);
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
    game.state = "start";
    game.previousState = null;
    game.activeTown = null;
    game.nearTown = null;
    game.nearResource = null;
    game.capturingResource = null;
    game.battle = null;
    game.pendingEncounter = null;
    game.encounter = null;
    if (game.player) {
      game.player.target = null;
    }
    return true;
  }
  if (action === "leaveTown") {
    leaveTown(game);
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
    var result = upgradeArmyStack(game.player, stackIndex);
    game.notice = {
      title: result.ok ? "升级完成" : "无法升级",
      lines: [result.message],
      timer: 1.8,
      duration: 1.8,
      kind: "gold"
    };
    return true;
  }
  if (action.indexOf("selectEquipment:") === 0) {
    selectEquipment(game, action.split(":")[1]);
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
