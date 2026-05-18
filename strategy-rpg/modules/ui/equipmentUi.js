import { WEAPONS, getEquipmentItem, getEquipmentSlotById } from "../config.js";
import { drawPanel, drawPixelText, rectContains } from "../utils.js";
import { ATTR_IDS, EMPTY_WEAPON, EQUIPMENT_SLOT_NAMES, QUALITY_COLORS, QUALITY_NAMES, UI_TEXT, addButton, addPanelCloseButton } from "./uiCore.js";

export function drawEquipmentDetailPopup(ctx, game) {
  const selectedId = getSelectedEquipmentId(game);
  const item = selectedId ? getEquipmentItem(selectedId) : null;

  if (!item) {
    return;
  }

  const x = 306;
  const y = 144;
  const w = 348;
  const h = 248;
  const equipped = isEquippedEquipment(game.player, item.id);

  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(0, 0, 960, 540);
  addButton(game.ui, 0, 0, 960, 540, "关闭装备信息", "closeEquipmentDetail", false, true);
  drawPanel(ctx, x, y, w, h, "装备信息", "menu");
  addPanelCloseButton(game.ui, x, y, w, "closeEquipmentDetail");

  const contentX = x + 34;
  const contentY = y + 44;
  drawPixelText(ctx, item.name, contentX, contentY, getEquipmentNameColor(item), 20);
  drawPixelText(ctx, getQualityName(item) + " / " + getEquipmentSlotName(item), contentX, contentY + 34, UI_TEXT.muted, 12);

  const statsBoxY = contentY + 58;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(contentX, statsBoxY, w - 68, 78);
  ctx.strokeStyle = "rgba(143,104,46,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(contentX + 0.5, statsBoxY + 0.5, w - 68, 78);

  const stats = formatEquipmentStats(item);
  stats.forEach(function (line, index) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const statX = contentX + 18 + col * 132;
    const statY = statsBoxY + 14 + row * 21;
    drawPixelText(ctx, line, statX, statY, UI_TEXT.main, 13);
  });
  addButton(game.ui, x + 114, y + h - 50, 120, 34, equipped ? "卸下" : "穿戴", equipped ? "unequipSelectedEquipment" : "equipSelectedEquipment");
}

export function drawEquipmentSlot(ctx, x, y, label, item, color, input, clickable, selected) {
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

export function equipPlayerItem(player, itemId) {
  const item = getEquipmentItem(itemId);
  const slot = getEquipmentSlotById(itemId);
  if (!item || !slot) {
    return { ok: false, message: "未知装备" };
  }
  ensurePlayerEquipmentState(player);
  if (!player.inventory.includes(itemId)) {
    return { ok: false, message: "尚未获得该装备" };
  }

  const currentId = getEquippedItemId(player, slot);
  if (currentId === itemId) {
    removeEquipmentFromInventory(player, itemId);
    return { ok: true, message: item.name + " 已在装备槽" };
  }

  removeEquipmentFromInventory(player, itemId);
  if (currentId) {
    addEquipmentToInventory(player, currentId);
  }

  setEquippedItemId(player, slot, itemId);
  player.equipment[slot] = item.name;
  return { ok: true, message: "已装备 " + item.name };
}

export function selectEquipment(game, itemId) {
  if (!getEquipmentItem(itemId)) {
    return false;
  }
  setSelectedEquipment(game, itemId);
  return true;
}

export function getSelectedEquipmentId(game) {
  const selected = game.ui && game.ui.selectedEquipmentId;
  return selected && getEquipmentItem(selected) ? selected : null;
}

export function setSelectedEquipment(game, itemId) {
  if (!game.ui) {
    return;
  }
  game.ui.selectedEquipmentId = itemId && getEquipmentItem(itemId) ? itemId : null;
}

export function unequipPlayerItem(player, itemId) {
  ensurePlayerEquipmentState(player);
  const item = getEquipmentItem(itemId);
  const slot = getEquipmentSlotById(itemId);
  if (!item || !slot) {
    return { ok: false, message: "未知装备" };
  }
  const currentId = getEquippedItemId(player, slot);
  if (!currentId) {
    setEquippedItemId(player, slot, null);
    player.equipment[slot] = EMPTY_WEAPON.name;
    return { ok: false, message: EQUIPMENT_SLOT_NAMES[slot] + "槽已经为空" };
  }

  const currentItem = getEquipmentItem(currentId);
  addEquipmentToInventory(player, currentId);
  setEquippedItemId(player, slot, null);
  player.equipment[slot] = EMPTY_WEAPON.name;
  return { ok: true, message: "已卸下 " + (currentItem ? currentItem.name : item.name) };
}

export function ensurePlayerEquipmentState(player) {
  if (!player.general) {
    player.general = { name: "沈铁冠", faction: "player", level: Math.max(1, player.level || 1), weapon: "oldSword" };
  }
  if (!player.inventory) {
    player.inventory = [];
  }
  if (!player.equipment) {
    player.equipment = { weapon: "旧王短剑", armor: EMPTY_WEAPON.name, trinket: EMPTY_WEAPON.name };
  }
  if (!player.equipmentIds || typeof player.equipmentIds !== "object") {
    player.equipmentIds = { armor: null, trinket: null };
  }
  normalizeEmptyGearSlots(player);
  if (player.general.weapon && !WEAPONS[player.general.weapon]) {
    player.general.weapon = null;
    player.equipment.weapon = EMPTY_WEAPON.name;
  }
  if (player.equipmentIds.armor && !getEquipmentItem(player.equipmentIds.armor)) {
    player.equipmentIds.armor = null;
    player.equipment.armor = EMPTY_WEAPON.name;
  }
  if (player.equipmentIds.trinket && !getEquipmentItem(player.equipmentIds.trinket)) {
    player.equipmentIds.trinket = null;
    player.equipment.trinket = EMPTY_WEAPON.name;
  }
  player.equipment.armor = getEquippedGear(player, "armor").name;
  player.equipment.trinket = getEquippedGear(player, "trinket").name;
  player.inventory = getInventoryEquipmentIds(player);
}

export function normalizeEmptyGearSlots(player) {
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

export function getEquipmentNameColor(item) {
  const quality = item && item.quality ? item.quality : "common";
  return QUALITY_COLORS[quality] || item.color || QUALITY_COLORS.common;
}

export function getQualityName(item) {
  const quality = item && item.quality ? item.quality : "common";
  return QUALITY_NAMES[quality] || QUALITY_NAMES.common;
}

export function getEquipmentSlotName(item) {
  return EQUIPMENT_SLOT_NAMES[getEquipmentSlotById(item && item.id)] || "装备";
}

export function isEquipmentKind(kind) {
  return kind === "weapon" || kind === "armor" || kind === "trinket";
}

export function formatEquipmentStats(item) {
  const stats = [];
  if ((item.attack || 0) !== 0) {
    stats.push("攻击 +" + item.attack);
  }
  if ((item.defense || 0) !== 0) {
    stats.push("防御 +" + item.defense);
    stats.push("血量 +" + item.defense * 8);
  }
  if ((item.hp || 0) !== 0) {
    stats.push("生命 +" + item.hp);
  }
  if ((item.speed || 0) !== 0) {
    stats.push("速度 " + (item.speed > 0 ? "+" : "") + item.speed);
  }
  if ((item.range || 0) !== 0) {
    stats.push("射程 " + item.range);
  }
  if ((item.crit || 0) !== 0) {
    stats.push("暴击 +" + Math.round(item.crit * 100) + "%");
  }
  return stats.length ? stats : ["无属性"];
}

export function ensureAttributeSession(game) {
  if (!game.ui.attributeSession) {
    game.ui.attributeSession = {
      adds: { strength: 0, agility: 0, intelligence: 0, leadership: 0 }
    };
  }
}

export function clearAttributeSession(game) {
  if (game.ui) {
    game.ui.attributeSession = null;
    game.ui.selectedEquipmentId = null;
  }
}

export function getAttributeSessionAdds(game, attr) {
  return game.ui.attributeSession && game.ui.attributeSession.adds
    ? game.ui.attributeSession.adds[attr] || 0
    : 0;
}

export function addSessionAttributePoint(game, attr) {
  ensureAttributeSession(game);
  if (game.player.skillPoints <= 0 || !ATTR_IDS.includes(attr)) {
    return false;
  }
  game.player.skillPoints -= 1;
  game.player.attributes[attr] += 1;
  game.ui.attributeSession.adds[attr] = getAttributeSessionAdds(game, attr) + 1;
  return true;
}

export function undoSessionAttributePoint(game, attr) {
  ensureAttributeSession(game);
  if (!ATTR_IDS.includes(attr) || getAttributeSessionAdds(game, attr) <= 0) {
    return false;
  }
  game.ui.attributeSession.adds[attr] -= 1;
  game.player.attributes[attr] -= 1;
  game.player.skillPoints += 1;
  return true;
}

export function getEquippedWeaponId(player) {
  const weaponId = player && player.general ? player.general.weapon : null;
  return weaponId && WEAPONS[weaponId] ? weaponId : null;
}

export function getEquippedWeapon(player) {
  const weaponId = getEquippedWeaponId(player);
  return weaponId ? WEAPONS[weaponId] : EMPTY_WEAPON;
}

export function getEquippedGear(player, slot) {
  if (slot === "weapon") {
    return getEquippedWeapon(player);
  }
  const id = player && player.equipmentIds ? player.equipmentIds[slot] : null;
  return id && getEquipmentItem(id) ? getEquipmentItem(id) : EMPTY_WEAPON;
}

export function getEquippedItemId(player, slot) {
  if (slot === "weapon") {
    return getEquippedWeaponId(player);
  }
  return player && player.equipmentIds && getEquipmentItem(player.equipmentIds[slot]) ? player.equipmentIds[slot] : null;
}

export function setEquippedItemId(player, slot, itemId) {
  if (slot === "weapon") {
    player.general.weapon = itemId || null;
    return;
  }
  if (!player.equipmentIds) {
    player.equipmentIds = { armor: null, trinket: null };
  }
  player.equipmentIds[slot] = itemId || null;
}

export function isEquippedEquipment(player, itemId) {
  const slot = getEquipmentSlotById(itemId);
  return Boolean(slot && getEquippedItemId(player, slot) === itemId);
}

export function playerOwnsEquipment(player, itemId) {
  return (player.inventory || []).includes(itemId) || isEquippedEquipment(player, itemId);
}

export function getInventoryEquipmentIds(player) {
  return Array.from(new Set((player.inventory || []).filter((id) => getEquipmentItem(id))));
}

export function addEquipmentToInventory(player, itemId) {
  if (!getEquipmentItem(itemId)) {
    return;
  }
  if (!player.inventory) {
    player.inventory = [];
  }
  removeEquipmentFromInventory(player, itemId);
  player.inventory.push(itemId);
}

export function removeEquipmentFromInventory(player, itemId) {
  if (!player.inventory) {
    player.inventory = [];
    return;
  }
  player.inventory = player.inventory.filter((id) => id !== itemId);
}
