import { getEquipmentItem } from "../config.js";
import { expToNextLevel } from "../player.js";
import { getArmyPower, getArmySize, getMaxArmySize } from "../troop.js";
import { drawPanel, drawPixelText, rectContains } from "../utils.js";
import { INVENTORY_PAGE_SIZE, UI_TEXT, addButton, addPanelCloseButton, clearButtons, drawButton, drawInlinePager, getPagedListPage } from "./uiCore.js";
import { drawEquipmentDetailPopup, drawEquipmentSlot, ensureAttributeSession, ensurePlayerEquipmentState, getAttributeSessionAdds, getEquipmentNameColor, getEquippedGear, getEquippedWeapon, getInventoryEquipmentIds, getSelectedEquipmentId, isEquippedEquipment } from "./equipmentUi.js";
import { drawMarketDetailPopup, getMarketKey, getPlayerGoodsEntries, getSelectedMarketKey } from "./marketUi.js";

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
  const selectedEquipmentId = getSelectedEquipmentId(game);
  const weapon = getEquippedWeapon(game.player);
  const armor = getEquippedGear(game.player, "armor");
  const trinket = getEquippedGear(game.player, "trinket");
  const generalStats = getPlayerGeneralPreview(game.player);

  // 将领与装备
  drawPixelText(ctx, "将领", 176, 72, "#ffd56a", 15);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(176, 94, 250, 150);
  drawPixelText(ctx, general.name, 194, 106, "#ffd56a", 18);
  drawPlayerStatGrid(ctx, generalStats, 194, 144);

  drawPixelText(ctx, "装备槽", 176, 266, "#ffd56a", 15);
  drawEquipmentSlot(ctx, 194, 292, "武器", weapon.name, getEquipmentNameColor(weapon), game.input, Boolean(weapon.id !== "none"), weapon.id === selectedEquipmentId);
  addButton(game.ui, 194, 292, 124, 52, "查看武器", weapon.id !== "none" ? "selectEquipment:" + weapon.id : "", weapon.id === "none", true);
  drawEquipmentSlot(ctx, 194, 354, "护甲", armor.name, getEquipmentNameColor(armor), game.input, Boolean(armor.id !== "none"), armor.id === selectedEquipmentId);
  addButton(game.ui, 194, 354, 124, 52, "查看护甲", armor.id !== "none" ? "selectEquipment:" + armor.id : "", armor.id === "none", true);
  drawEquipmentSlot(ctx, 194, 416, "饰品", trinket.name, getEquipmentNameColor(trinket), game.input, Boolean(trinket.id !== "none"), trinket.id === selectedEquipmentId);
  addButton(game.ui, 194, 416, 124, 52, "查看饰品", trinket.id !== "none" ? "selectEquipment:" + trinket.id : "", trinket.id === "none", true);

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

export function getPlayerGeneralPreview(player) {
  const general = player.general || { level: Math.max(1, player.level || 1), weapon: null };
  const attrs = player.attributes || { strength: 0, agility: 0, intelligence: 0, leadership: 0 };
  const weapon = getEquippedWeapon(player);
  const armor = getEquippedGear(player, "armor");
  const trinket = getEquippedGear(player, "trinket");
  const level = general.level || player.level || 1;
  const expNext = expToNextLevel(player);
  const gearAttack = (weapon.attack || 0) + (armor.attack || 0) + (trinket.attack || 0);
  const gearDefense = (weapon.defense || 0) + (armor.defense || 0) + (trinket.defense || 0);
  const gearHp = (armor.hp || 0) + (trinket.hp || 0);
  const gearSpeed = (armor.speed || 0) + (trinket.speed || 0);
  const gearCrit = (weapon.crit || 0) + (armor.crit || 0) + (trinket.crit || 0);
  const attackBonus = attrs.strength * 1.2 + attrs.intelligence * 0.6;
  const hpBonus = attrs.leadership * 8 + attrs.strength * 3 + gearHp;
  const speedBonus = attrs.agility * 0.9 + gearSpeed;
  const playerAttackMul = 1 + attrs.strength * 0.018;
  const playerSpeedMul = 1 + attrs.agility * 0.012;
  const moraleHpMul = 1 + attrs.leadership * 0.8 / 220;
  return {
    hp: Math.round((130 + level * 22 + gearDefense * 8 + hpBonus) * moraleHpMul),
    attack: Math.round((18 + level * 4 + gearAttack + attackBonus) * playerAttackMul),
    defense: Math.round(6 + level + gearDefense + attrs.leadership * 0.7),
    speed: Math.round((38 + level * 1.5 + speedBonus) * playerSpeedMul),
    range: weapon.range,
    crit: Math.round((0.08 + gearCrit + attrs.agility * 0.006 + attrs.intelligence * 0.003) * 100),
    level,
    exp: Math.floor(player.exp || 0),
    expNext,
    gold: Math.floor(player.gold || 0),
    armySize: getArmySize(player.army),
    maxArmySize: getMaxArmySize(player),
    armyPower: Math.round(getArmyPower(player.army))
  };
}

export function drawPlayerStatGrid(ctx, stats, x, y) {
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

export function drawEquipmentInventory(ctx, game) {
  const equipmentIds = getInventoryEquipmentIds(game.player).filter((id) => !isEquippedEquipment(game.player, id));
  const goods = getPlayerGoodsEntries(game.player);
  const equipmentPage = getPagedListPage(game.ui, "inventoryEquipmentPage", equipmentIds.length, INVENTORY_PAGE_SIZE);
  const goodsPage = getPagedListPage(game.ui, "inventoryGoodsPage", goods.length, INVENTORY_PAGE_SIZE);

  drawPixelText(ctx, "背包", 456, 248, "#ffd56a", 15);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(456, 272, 308, 198);

  if (!equipmentIds.length && !goods.length) {
    drawPixelText(ctx, "背包为空", 610, 362, UI_TEXT.empty, 12, "center");
    return;
  }

  drawPixelText(ctx, "装备", 470, 278, UI_TEXT.label, 10);
  drawInlinePager(ctx, game, equipmentIds.length, equipmentPage, INVENTORY_PAGE_SIZE, 656, 274, "inventoryEquipmentPage");
  equipmentIds.slice(equipmentPage * INVENTORY_PAGE_SIZE, (equipmentPage + 1) * INVENTORY_PAGE_SIZE).forEach(function (id, index) {
    const item = getEquipmentItem(id);
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 470 + col * 94;
    const y = 294 + row * 28;
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
    drawPixelText(ctx, item.name, x + 6, drawY + 7, getEquipmentNameColor(item), 10);
    addButton(game.ui, x, y, 84, 26, "查看装备", "selectEquipment:" + id, false, true);
  });

  drawPixelText(ctx, "商品", 470, 398, UI_TEXT.label, 10);
  drawInlinePager(ctx, game, goods.length, goodsPage, INVENTORY_PAGE_SIZE, 656, 394, "inventoryGoodsPage");
  goods.slice(goodsPage * INVENTORY_PAGE_SIZE, (goodsPage + 1) * INVENTORY_PAGE_SIZE).forEach(function (entry, index) {
    const item = entry.item;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 470 + col * 94;
    const y = 414 + row * 26;
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
