import { CONFIG } from "../config.js";
import { getArmyPower, getArmySize, getMaxArmySize, getMaxTroopLevel, getSingleTroopUpgradeCost, getTroopBatchUpgradeCost, getTroopLevelStats } from "../troop.js";
import { drawPanel, drawPixelText, formatNumber, rectContains } from "../utils.js";
import { ARMY_GRID_LAYOUT, UI_TEXT, addButton, addPanelCloseButton, clearButtons, drawButton, drawTroopPortrait } from "./uiCore.js";

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

export function getArmySoldiers(army) {
  const soldiers = [];
  army.forEach(function (unit, stackIndex) {
    for (let i = 0; i < unit.count; i += 1) {
      soldiers.push({ unit, stackIndex, ordinal: i });
    }
  });
  return soldiers;
}

export function ensureArmySelectionState(ui) {
  if (!ui) {
    return;
  }
  if (!Array.isArray(ui.selectedArmySoldierKeys)) {
    ui.selectedArmySoldierKeys = [];
  }
  ui.armyMultiSelect = Boolean(ui.armyMultiSelect);
}

export function cleanSelectedArmySoldierKeys(ui, soldiers) {
  ensureArmySelectionState(ui);
  const validKeys = new Set(soldiers.map(getArmySoldierKey));
  ui.selectedArmySoldierKeys = ui.selectedArmySoldierKeys.filter((key, index, list) => (
    validKeys.has(key) && list.indexOf(key) === index
  ));
  if (ui.selectedArmySoldierKey && !validKeys.has(ui.selectedArmySoldierKey)) {
    ui.selectedArmySoldierKey = null;
  }
}

export function getSelectedArmySoldier(game, soldiers) {
  const selectedKey = game.ui.selectedArmySoldierKey;
  const selected = selectedKey
    ? soldiers.find((soldier) => getArmySoldierKey(soldier) === selectedKey)
    : null;
  if (!selected) {
    game.ui.selectedArmySoldierKey = null;
  }
  return selected || null;
}

export function getSelectedArmySoldiers(ui, soldiers) {
  ensureArmySelectionState(ui);
  const selectedKeys = new Set(ui.selectedArmySoldierKeys);
  return soldiers.filter((soldier) => selectedKeys.has(getArmySoldierKey(soldier)));
}

export function getArmySoldierKey(soldier) {
  return soldier.stackIndex + ":" + soldier.ordinal + ":" + soldier.unit.type + ":" + soldier.unit.level;
}

export function getArmySoldierUpgradeGroups(soldiers) {
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

export function setSelectedArmySoldier(game, typeId, level) {
  const soldiers = getArmySoldiers(game.player.army);
  const soldier = soldiers.find((item) => item.unit.type === typeId && item.unit.level === level) || soldiers[0];
  game.ui.selectedArmySoldierKey = soldier ? getArmySoldierKey(soldier) : null;
  game.ui.selectedArmySoldierKeys = [];
  if (soldier) {
    game.ui.armyPage = Math.floor(soldiers.indexOf(soldier) / getArmyPageSize(ARMY_GRID_LAYOUT));
  }
}

export function toggleSelectedArmySoldier(game, key) {
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

export function setArmyMultiSelect(game, enabled) {
  ensureArmySelectionState(game.ui);
  game.ui.armyMultiSelect = Boolean(enabled);
  game.ui.selectedArmySoldierKey = null;
  if (!enabled) {
    game.ui.selectedArmySoldierKeys = [];
  }
}

export function selectVisibleArmySoldiers(game) {
  ensureArmySelectionState(game.ui);
  const soldiers = getArmySoldiers(game.player.army);
  const page = getArmyPage(game.ui, "armyPage", soldiers.length, ARMY_GRID_LAYOUT);
  const visibleSoldiers = getArmyPageSoldiers(soldiers, page, ARMY_GRID_LAYOUT);
  game.ui.selectedArmySoldierKeys = visibleSoldiers.map(getArmySoldierKey);
  game.ui.selectedArmySoldierKey = null;
}

export function clearArmyMultiSelection(game) {
  ensureArmySelectionState(game.ui);
  game.ui.selectedArmySoldierKeys = [];
}

export function drawArmyToolbar(ctx, game, soldiers, selectedSoldiers, batchPreview, layout) {
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

export function drawArmySoldierGrid(ctx, game, soldiers, selectedSoldier, options = {}) {
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

export function drawArmySelectionMark(ctx, x, y) {
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

export function getArmyPageSize(layout) {
  return layout.cols * layout.rows;
}

export function getArmyPage(ui, key, total, layout) {
  const pageSize = getArmyPageSize(layout);
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const current = Math.max(0, Math.min(maxPage, Math.floor(Number(ui[key] || 0))));
  ui[key] = current;
  return current;
}

export function getArmyPageSoldiers(soldiers, page, layout) {
  const pageSize = getArmyPageSize(layout);
  const start = page * pageSize;
  return soldiers.slice(start, start + pageSize);
}

export function stepArmyPage(ui, key, total, direction) {
  const pageSize = getArmyPageSize(ARMY_GRID_LAYOUT);
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const current = Math.max(0, Math.min(maxPage, Math.floor(Number(ui[key] || 0))));
  ui[key] = Math.max(0, Math.min(maxPage, current + direction));
}

export function drawArmyPager(ctx, game, total, page, layout, key) {
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

export function drawArmyLevelBadge(ctx, x, y, level) {
  ctx.save();
  ctx.fillStyle = "rgba(4, 8, 10, 0.86)";
  ctx.fillRect(Math.round(x), Math.round(y), 21, 12);
  ctx.strokeStyle = "rgba(255,213,106,0.72)";
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, 21, 12);
  drawPixelText(ctx, "Lv." + level, x + 2, y + 1, "#ffd56a", 8);
  ctx.restore();
}

export function drawArmySoldierCard(ctx, game, soldier, options = {}) {
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

export function drawArmyStatPreview(ctx, label, value, nextValue, x, y, showDelta) {
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

export function parseStatValue(value) {
  return Number(String(value).replace("%", "")) || 0;
}
