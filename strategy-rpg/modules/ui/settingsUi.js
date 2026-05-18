import { drawPanel, drawPixelText } from "../utils.js";
import { BUTTON_THEME, UI_TEXT, addButton, addPanelCloseButton, clearButtons, drawButton } from "./uiCore.js";

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

export function drawPrivilegeDialog(ctx, game) {
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
