import { FACTIONS } from "./config.js";
import { WEAPONS } from "./config.js";
import { expToNextLevel, getTownDailyIncome, spendSkillPoint } from "./player.js";
import { getArmyPower, getArmySize, getMaxArmySize, getRecruitOptions, getRosterLines, isArmyMoraleFull } from "./troop.js";
import { getGarrisonUpgradeCost, improveDefense, leaveTown, recruitFromTown, restAtTown, upgradeGarrison } from "./town.js";
import { drawBar, drawPanel, drawPixelText, formatNumber, rectContains } from "./utils.js";

// UI 模块：维护按钮、HUD、城池面板和菜单面板的绘制与点击处理。

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

  addButton(game.ui, 868, 18, 72, 32, "设置", "settings");
  for (const btn of game.ui.buttons) {
    drawButton(ctx, btn, game.input);
  }

  drawNearbyTownActions(ctx, game);
  drawNearbyResourceActions(ctx, game);
  drawCaptureProgress(ctx, game);
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

function drawWarReports(ctx, game) {
  const reports = (game.reports || []).slice(0, 6);
  reports.forEach(function (report, index) {
    const color = report.kind === "good"
      ? "#74d17a"
      : report.kind === "bad"
        ? "#ff7568"
        : "#d7c89e";
    drawPixelText(ctx, report.text, 12, 424 + index * 16, color, 10);
  });
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

    // 兵种图标色块
    ctx.fillStyle = type.color;
    ctx.fillRect(172, y - 1, 26, 26);

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
  const defenseCost = 45;
  const upgradeCost = getGarrisonUpgradeCost(town);
  const moraleFull = isArmyMoraleFull(game.player.army);
  const canManageTown = town.owner === "player";
  addButton(game.ui, 586, 330, 170, 32, "整补士气 " + restCost + "金", "rest", game.player.gold < restCost || moraleFull);
  addButton(game.ui, 586, 370, 170, 32, "修筑城防 " + defenseCost + "金", "defense", !canManageTown || game.player.gold < defenseCost);
  addButton(game.ui, 586, 410, 170, 32, "升级守军 " + upgradeCost + "金", "upgradeGarrison", !canManageTown || game.player.gold < upgradeCost);
  addButton(game.ui, 586, 450, 170, 32, "离开城镇", "leaveTown");

  for (const btn of game.ui.buttons) {
    drawButton(ctx, btn, game.input);
  }
}

// ==================== 属性界面 ====================

export function drawMenuUi(ctx, game) {
  clearButtons(game.ui);

  drawPanel(ctx, 240, 56, 480, 420, "属性界面");

  // 装备区
  drawPixelText(ctx, "装备", 276, 82, "#ffd56a", 15);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(276, 100, 410, 64);
  drawEquipmentSlot(ctx, 290, 106, "武器", game.player.equipment.weapon, "#d6a84f");
  drawEquipmentSlot(ctx, 430, 106, "护甲", game.player.equipment.armor, "#7a8a9a");
  drawEquipmentSlot(ctx, 570, 106, "饰品", game.player.equipment.trinket, "#8e5ab8");
  const general = game.player.general || { name: "沈铁冠", weapon: "oldSword" };
  const weapon = WEAPONS[general.weapon] || WEAPONS.oldSword;
  drawPixelText(ctx, "将领 " + general.name + " / " + weapon.name + "  攻击+" + weapon.attack, 290, 156, "#ffd56a", 11);

  // 属性分配
  drawPixelText(ctx, "技能点分配（剩余 " + game.player.skillPoints + "）", 276, 186, "#ffd56a", 15);

  var attrs = [
    { id: "strength", name: "力量", value: game.player.attributes.strength, tip: "近战伤害加成" },
    { id: "agility", name: "敏捷", value: game.player.attributes.agility, tip: "行军速度加成" },
    { id: "intelligence", name: "智力", value: game.player.attributes.intelligence, tip: "法术伤害加成" },
    { id: "leadership", name: "统御", value: game.player.attributes.leadership, tip: "带兵数量上限" }
  ];

  attrs.forEach(function (row, index) {
    var y = 214 + index * 46;
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(276, y - 6, 410, 36);

    drawPixelText(ctx, row.name, 290, y + 0, "#f8e9bd", 14);
    drawPixelText(ctx, row.tip, 350, y + 0, "rgba(185,167,122,0.6)", 10);
    drawPixelText(ctx, String(row.value), 290, y + 18, "#ffd56a", 13);

    // 属性条
    drawBar(ctx, 330, y + 20, 120, 6, row.value / 30, "#d6a84f");

    addButton(game.ui, 506, y - 2, 64, 28, "+1", "attr:" + row.id, game.player.skillPoints <= 0);
  });

  // 操作按钮
  addButton(game.ui, 370, 406, 220, 34, "返回大地图", "closeMenu");

  for (var i = 0; i < game.ui.buttons.length; i++) {
    drawButton(ctx, game.ui.buttons[i], game.input);
  }
}

// ==================== 设置界面 ====================

export function drawSettingsUi(ctx, game) {
  clearButtons(game.ui);

  drawPanel(ctx, 300, 72, 360, 360, "设置");
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
  addButton(game.ui, 336, 342, 132, 36, "返回游戏", "closeSettings");
  addButton(game.ui, 492, 342, 132, 36, "返回主界面", "backToStart");

  for (const btn of game.ui.buttons) {
    drawButton(ctx, btn, game.input);
  }
}

function drawEquipmentSlot(ctx, x, y, label, item, color) {
  ctx.strokeStyle = "#5f3f17";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, 120, 52);

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(x + 2, y + 2, 116, 48);

  drawPixelText(ctx, label, x + 8, y + 4, "#8f682e", 10);
  drawPixelText(ctx, item, x + 8, y + 22, color, 13);

  // 小装饰
  ctx.fillStyle = color;
  ctx.fillRect(x + 100, y + 12, 8, 28);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x + 102, y + 14, 4, 24);
}

// ==================== 按钮点击处理 ====================

export function handleUiAction(game, action) {
  if (!action) return false;

  if (action === "menu") {
    game.state = "menu";
    game.message = "属性界面：查看装备、分配技能点、管理存档";
    return true;
  }
  if (action === "closeMenu") {
    game.state = "world";
    return true;
  }
  if (action === "settings") {
    game.previousState = game.state === "settings" ? "world" : game.state;
    game.state = "settings";
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
  if (action === "defense") {
    improveDefense(game);
    return true;
  }
  if (action === "upgradeGarrison") {
    upgradeGarrison(game);
    return true;
  }
  if (action.indexOf("recruit:") === 0) {
    var parts = action.split(":");
    recruitFromTown(game, parts[1], Number(parts[2]));
    return true;
  }
  if (action.indexOf("attr:") === 0) {
    var attr = action.split(":")[1];
    var ok = spendSkillPoint(game.player, attr);
    game.notice = {
      title: ok ? "属性提升" : "无法提升",
      lines: [ok ? attr + " 提升至 " + game.player.attributes[attr] : "没有可用技能点"],
      timer: 1.6,
      duration: 1.6,
      kind: "gold"
    };
    return true;
  }
  return false;
}

export function getClickedButton(ui, point) {
  if (!point) return null;
  for (var i = 0; i < ui.buttons.length; i++) {
    if (!ui.buttons[i].disabled && rectContains(ui.buttons[i], point.x, point.y)) {
      return ui.buttons[i];
    }
  }
  return null;
}
