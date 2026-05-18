import { buyMarketItem, getPlayerSellListings, getTownSellListings, sellMarketItem } from "../market.js";
import { setNotice } from "../notice.js";
import { resetTutorial, skipTutorial, updateTutorial } from "../tutorial.js";
import { upgradeSingleTroop, upgradeTroopBatch } from "../troop.js";
import { developTown, leaveTown, recruitFromTown, resetTownUi, restAtTown } from "../town.js";
import { INVENTORY_PAGE_SIZE, MARKET_PAGE_SIZE, clearArmyUiState, clearEnemyArmyPreview, stepPagedListPage } from "./uiCore.js";
import { cleanSelectedArmySoldierKeys, clearArmyMultiSelection, getArmySoldierUpgradeGroups, getArmySoldiers, getSelectedArmySoldiers, selectVisibleArmySoldiers, setArmyMultiSelect, setSelectedArmySoldier, stepArmyPage, toggleSelectedArmySoldier } from "./armyUi.js";
import { getPlayerGoodsEntries, playerOwnsMarketItem } from "./marketUi.js";
import { addSessionAttributePoint, clearAttributeSession, equipPlayerItem, getInventoryEquipmentIds, getSelectedEquipmentId, isEquippedEquipment, selectEquipment, setSelectedEquipment, unequipPlayerItem, undoSessionAttributePoint } from "./equipmentUi.js";

export function handleUiAction(game, action) {
  if (!action) return false;

  if (action === "menu") {
    clearAttributeSession(game);
    game.state = "menu";
    game.message = "属性界面：查看装备、分配技能点、管理存档";
    updateTutorial(game, { type: "menu" });
    return true;
  }
  if (action === "army") {
    game.state = "army";
    game.message = "军队管理：花费金币升级部队";
    updateTutorial(game, { type: "openArmy" });
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
    var townView = action.split(":")[1] || "home";
    game.ui.townView = townView;
    game.ui.selectedMarketItem = null;
    game.ui.marketBuyPage = 0;
    game.ui.marketSellPage = 0;
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
    var recruitResult = recruitFromTown(game, parts[1], Number(parts[2]));
    if (recruitResult && recruitResult.ok) {
      updateTutorial(game, { type: "recruit" });
    }
    return true;
  }
  if (action.indexOf("upgradeTroop:") === 0) {
    var stackIndex = Number(action.split(":")[1]);
    var result = upgradeSingleTroop(game.player, stackIndex);
    setNotice(game, result.ok ? "升级完成" : "无法升级", [result.message], 1.8, "gold");
    if (result.ok && result.upgraded) {
      setSelectedArmySoldier(game, result.upgraded.type, result.upgraded.level);
      updateTutorial(game, { type: "upgradeTroop" });
    }
    return true;
  }
  if (action.indexOf("upgradeSingleTroop:") === 0) {
    var singleStackIndex = Number(action.split(":")[1]);
    var singleResult = upgradeSingleTroop(game.player, singleStackIndex);
    setNotice(game, singleResult.ok ? "升级完成" : "无法升级", [singleResult.message], 1.8, "gold");
    if (singleResult.ok && singleResult.upgraded) {
      setSelectedArmySoldier(game, singleResult.upgraded.type, singleResult.upgraded.level);
      updateTutorial(game, { type: "upgradeTroop" });
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
      updateTutorial(game, { type: "upgradeTroop" });
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
  if (action.indexOf("marketBuyPage:") === 0) {
    const listings = game.activeTown ? getTownSellListings(game, game.activeTown) : [];
    stepPagedListPage(game.ui, "marketBuyPage", listings.length, MARKET_PAGE_SIZE, action.endsWith(":next") ? 1 : -1);
    game.ui.selectedMarketItem = null;
    return true;
  }
  if (action.indexOf("marketSellPage:") === 0) {
    const listings = game.activeTown ? getPlayerSellListings(game, game.activeTown) : [];
    stepPagedListPage(game.ui, "marketSellPage", listings.length, MARKET_PAGE_SIZE, action.endsWith(":next") ? 1 : -1);
    game.ui.selectedMarketItem = null;
    return true;
  }
  if (action.indexOf("inventoryEquipmentPage:") === 0) {
    const equipmentIds = getInventoryEquipmentIds(game.player).filter((id) => !isEquippedEquipment(game.player, id));
    stepPagedListPage(game.ui, "inventoryEquipmentPage", equipmentIds.length, INVENTORY_PAGE_SIZE, action.endsWith(":next") ? 1 : -1);
    setSelectedEquipment(game, null);
    return true;
  }
  if (action.indexOf("inventoryGoodsPage:") === 0) {
    const goods = getPlayerGoodsEntries(game.player);
    stepPagedListPage(game.ui, "inventoryGoodsPage", goods.length, INVENTORY_PAGE_SIZE, action.endsWith(":next") ? 1 : -1);
    game.ui.selectedMarketItem = null;
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
      equipPlayerItem(game.player, selectedEquipId);
      setSelectedEquipment(game, null);
      updateTutorial(game, { type: "equipment" });
    }
    return true;
  }
  if (action === "unequipSelectedEquipment") {
    var selectedUnequipId = getSelectedEquipmentId(game);
    if (selectedUnequipId) {
      unequipPlayerItem(game.player, selectedUnequipId);
      updateTutorial(game, { type: "equipment" });
    }
    setSelectedEquipment(game, null);
    return true;
  }
  if (action === "tutorialSkip") {
    skipTutorial(game);
    setNotice(game, "教程已跳过", ["可在设置中重新开启"], 1.6, "gold");
    return true;
  }
  if (action === "tutorialComplete") {
    skipTutorial(game);
    setNotice(game, "教程完成", ["继续扩张你的领地"], 1.6, "gold");
    return true;
  }
  if (action === "tutorialReset") {
    resetTutorial(game);
    setNotice(game, "教程已重开", ["跟随目标逐步熟悉玩法"], 1.6, "gold");
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
