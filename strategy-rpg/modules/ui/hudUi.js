import { CONFIG, FACTIONS } from "../config.js";
import { getArmyPower, getArmySize, getMaxArmySize } from "../troop.js";
import { NUMBER_FONT_FAMILY, UI_FONT_FAMILY, drawBar, drawPanel, drawPixelText, formatNumber, rectContains, setupCanvasFont } from "../utils.js";
import { BUTTON_THEME, QUEST_PANEL, UI_TEXT, addButton, clearButtons, drawButton } from "./uiCore.js";

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
  drawNearbyTeleporterActions(ctx, game);
  drawCaptureProgress(ctx, game);
  drawQuestTracker(ctx, game);
  drawWarReports(ctx, game);

  // 键盘提示
  drawPixelText(ctx, "WASD移动 | E进城 | R攻城 | ESC菜单 | F9读档 | 设置保存", 10, 522, "rgba(248,233,189,0.62)", 12);
}

export function drawAvatar(ctx, button, player, input) {
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

export function drawHudMetric(ctx, label, value, x, y, valueColor, valueOffset = 31) {
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

export function drawTravelDestinationHint(ctx, game, button) {
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

export function drawQuestTracker(ctx, game) {
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
      : game.nearTeleporter
        ? "使用传送阵：" + game.nearTeleporter.name
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

export function drawQuestRow(ctx, label, value, max, x, y, color, suffix, rowWidth = 244) {
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

export function getExploredRatio(game) {
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

export function drawGlassPanel(ctx, x, y, w, h, title) {
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

export function drawUiCorner(ctx, x, y, dx, dy) {
  ctx.fillRect(Math.round(x), Math.round(y), dx, 2 * dy);
  ctx.fillRect(Math.round(x), Math.round(y), 2 * Math.sign(dx), 10 * dy);
}

export function drawQuestCompass(ctx, x, y, angle) {
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

export function drawWarReports(ctx, game) {
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

export function fitPixelText(ctx, text, maxWidth, size) {
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

export function drawNearbyResourceActions(ctx, game) {
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

export function drawNearbyTeleporterActions(ctx, game) {
  if (!game.nearTeleporter || game.state !== "world") return;
  const portals = (game.map.teleporters || []).filter(function (teleporter) {
    return teleporter.id !== game.nearTeleporter.id;
  });
  if (!portals.length) return;

  const panelX = 306;
  const panelY = 382;
  const panelW = 348;
  const visible = portals.slice(0, 4);
  const panelH = 72 + Math.ceil(visible.length / 2) * 36;
  drawPanel(ctx, panelX, panelY, panelW, panelH, game.nearTeleporter.name);
  drawPixelText(ctx, "选择目标星门", panelX + 20, panelY + 24, "#7df3ff", 13);
  visible.forEach(function (teleporter, index) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = panelX + 20 + col * 156;
    const y = panelY + 50 + row * 36;
    const button = addButton(game.ui, x, y, 136, 28, teleporter.name, "teleportTo:" + teleporter.id);
    drawButton(ctx, button, game.input);
  });
}

export function drawCaptureProgress(ctx, game) {
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

export function drawNearbyTownActions(ctx, game) {
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
