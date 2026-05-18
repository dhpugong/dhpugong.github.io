import { UI_FONT_FAMILY, drawPixelText, rectContains, setupCanvasFont } from "../utils.js";

// UI 模块：维护按钮、HUD、城池面板和菜单面板的绘制与点击处理。

export const QUEST_PANEL = { x: 706, y: 64, w: 238, h: 116 };
export const ARMY_GRID_LAYOUT = { x: 214, y: 156, cols: 10, rows: 7, cell: 42, gap: 7 };
export const UI_TEXT = {
  main: "#f4e1aa",
  body: "#ead59b",
  muted: "#d7c286",
  label: "#dfb866",
  empty: "#b7a16a",
  dim: "#a99563",
  disabled: "#9a885e"
};
export const BUTTON_THEME = {
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

export const EMPTY_WEAPON = {
  id: "none",
  name: "未装备",
  quality: "none",
  attack: 0,
  defense: 0,
  range: 30,
  crit: 0,
  color: UI_TEXT.dim
};

export const QUALITY_COLORS = {
  none: UI_TEXT.dim,
  common: "#d8d2c6",
  uncommon: "#7fd184",
  rare: "#79b8ff",
  epic: "#c79bff",
  legendary: "#ffd56a"
};

export const QUALITY_NAMES = {
  none: "无",
  common: "普通",
  uncommon: "精良",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说"
};

export const ATTR_IDS = ["strength", "agility", "intelligence", "leadership"];
export const MARKET_PAGE_SIZE = 7;
export const INVENTORY_PAGE_SIZE = 9;
export const EQUIPMENT_SLOT_NAMES = {
  weapon: "武器",
  armor: "护甲",
  trinket: "饰品"
};

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

export function addPanelCloseButton(ui, panelX, panelY, panelW, action) {
  return addButton(ui, panelX + panelW - 40, panelY + 14, 24, 24, "x", action);
}

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

export function getPagedListPage(ui, key, total, pageSize) {
  if (!ui) {
    return 0;
  }
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const current = Math.max(0, Math.min(maxPage, Math.floor(Number(ui[key] || 0))));
  ui[key] = current;
  return current;
}

export function stepPagedListPage(ui, key, total, pageSize, direction) {
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const current = Math.max(0, Math.min(maxPage, Math.floor(Number(ui[key] || 0))));
  ui[key] = Math.max(0, Math.min(maxPage, current + direction));
}

export function drawInlinePager(ctx, game, total, page, pageSize, x, y, key) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) {
    return;
  }
  addButton(game.ui, x, y, 22, 20, "<", key + ":prev", page <= 0);
  drawPixelText(ctx, (page + 1) + "/" + pageCount, x + 50, y + 4, "#d9f0ff", 10, "center");
  addButton(game.ui, x + 78, y, 22, 20, ">", key + ":next", page >= pageCount - 1);
}

export function wrapText(text, maxChars) {
  const value = String(text || "");
  const lines = [];
  for (let i = 0; i < value.length; i += maxChars) {
    lines.push(value.slice(i, i + maxChars));
  }
  return lines;
}

export function drawTroopPortrait(ctx, troopType, x, y, color, scale = 1) {
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

export function getClickedButton(ui, point) {
  if (!point) return null;
  for (var i = ui.buttons.length - 1; i >= 0; i--) {
    if (!ui.buttons[i].disabled && rectContains(ui.buttons[i], point.x, point.y)) {
      return ui.buttons[i];
    }
  }
  return null;
}
