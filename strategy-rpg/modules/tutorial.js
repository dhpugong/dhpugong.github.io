import { CONFIG } from "./config.js";
import { drawPanel, drawPixelText, setupCanvasFont, wrapText } from "./utils.js";
import { UI_TEXT, addButton, drawButton } from "./ui/uiCore.js";

const TUTORIAL_STEPS = [
  {
    id: "move",
    title: "整队出发",
    objective: "点击地面 或 用WASD 移动部队。",
    hint: "先熟悉行军，之后再靠近城镇。"
  },
  {
    id: "nearTown",
    title: "寻找城镇",
    objective: "靠近任意城镇，出现进城和攻城按钮。",
    hint: "灰石堡就在出生点附近。"
  },
  {
    id: "enterTown",
    title: "进入城镇",
    objective: "按 E 或点击进城，打开城镇事务。",
    hint: "城镇里可以招募、交易。"
  },
  {
    id: "recruit",
    title: "招募士兵",
    objective: "选择招兵买马，招募任意一队士兵。",
    hint: "新兵会加入你的军队编制。"
  },
  {
    id: "army",
    title: "查看军队",
    objective: "点击右上角X离开城镇，点击右上角军队查看士兵列表。",
    hint: "军队界面可以升级士兵。"
  },
  {
    id: "upgradeTroop",
    title: "升级士兵",
    objective: "选择一名士兵并完成一次升级。",
    hint: "升级会提升士兵属性。"
  },
  {
    id: "trade",
    title: "查看属性",
    objective: "进入属性界面，查看领主当前装备和属性。",
    hint: "属性界面入口在左上角头像处。"
  },
  {
    id: "battle",
    title: "初尝战火",
    objective: "攻下附近的灰石堡。",
    hint: "战斗胜利会占领该城市。"
  },
  {
    id: "afterBattle",
    title: "战后整备",
    objective: "打开设置进行保存。",
    hint: "请及时保存游戏进度。"
  }
];

const FIRST_STEP_ID = TUTORIAL_STEPS[0].id;

export function createTutorialState(options = {}) {
  return {
    enabled: Boolean(options.enabled),
    completed: false,
    stepId: options.stepId || FIRST_STEP_ID,
    paused: null,
    seenPauses: {},
    progress: {}
  };
}

export function normalizeTutorialState(state, options = {}) {
  const preservePaused = options.preservePaused !== false;
  if (!state || typeof state !== "object") {
    return createTutorialState({ enabled: Boolean(options.defaultEnabled) });
  }

  const stepId = getStepById(state.stepId) ? state.stepId : FIRST_STEP_ID;
  const completed = Boolean(state.completed);
  return {
    enabled: completed ? false : Boolean(state.enabled),
    completed,
    stepId,
    paused: preservePaused && state.paused && typeof state.paused === "object" ? state.paused : null,
    seenPauses: normalizeBooleanMap(state.seenPauses),
    progress: normalizeBooleanMap(state.progress)
  };
}

export function serializeTutorialState(state) {
  const tutorial = normalizeTutorialState(state, { preservePaused: false });
  return {
    enabled: tutorial.enabled,
    completed: tutorial.completed,
    stepId: tutorial.stepId,
    seenPauses: tutorial.seenPauses,
    progress: tutorial.progress
  };
}

export function updateTutorial(game, event = { type: "tick" }) {
  if (!game) {
    return null;
  }
  game.tutorial = normalizeTutorialState(game.tutorial);
  const tutorial = game.tutorial;
  if (!tutorial.enabled || tutorial.completed || tutorial.paused) {
    return tutorial;
  }

  const step = getStepById(tutorial.stepId);
  if (!step) {
    completeTutorial(game);
    return tutorial;
  }

  if (isStepComplete(step, game, event || { type: "tick" })) {
    advanceTutorial(game, step);
  }
  return tutorial;
}

export function skipTutorial(game) {
  if (!game) {
    return;
  }
  game.tutorial = normalizeTutorialState(game.tutorial);
  game.tutorial.enabled = false;
  game.tutorial.completed = true;
  game.tutorial.paused = null;
  game.message = "新手教程已跳过，可在设置中重开。";
}

export function resetTutorial(game) {
  if (!game) {
    return;
  }
  game.tutorial = createTutorialState({ enabled: true });
  game.message = "新手教程已重开。";
}

export function acknowledgeTutorialPause(game) {
  if (!game) {
    return;
  }
  game.tutorial = normalizeTutorialState(game.tutorial);
  game.tutorial.paused = null;
}

export function isTutorialPaused(game) {
  return Boolean(game && game.tutorial && game.tutorial.enabled && !game.tutorial.completed && game.tutorial.paused);
}

export function drawTutorialUi(ctx, game) {
  if (!game || game.state === "start") {
    return;
  }
  game.tutorial = normalizeTutorialState(game.tutorial);
  const tutorial = game.tutorial;
  if (!tutorial.enabled || tutorial.completed) {
    return;
  }
  if (game.ui && game.ui.saveSlotDialogOpen && !tutorial.paused) {
    return;
  }
  if (game.mapUi && game.mapUi.worldMap && game.mapUi.worldMap.open && !tutorial.paused) {
    return;
  }

  if (tutorial.paused) {
    drawTutorialPause(ctx, game, tutorial.paused);
    return;
  }

  const step = getStepById(tutorial.stepId);
  if (!step) {
    return;
  }
  drawTutorialPanel(ctx, game, step, getStepIndex(step.id));
}

function advanceTutorial(game, step) {
  const tutorial = game.tutorial;
  tutorial.progress[step.id] = true;
  const next = getNextStepForGame(game, step.id);
  if (!next) {
    completeTutorial(game);
    return;
  }
  tutorial.stepId = next.id;
  maybePauseForStep(tutorial, next);
}

function completeTutorial(game) {
  game.tutorial.enabled = false;
  game.tutorial.completed = true;
  game.tutorial.paused = null;
  game.message = "新手教程完成，祝你早日统一大陆。";
}

function maybePauseForStep(tutorial, step) {
  if (!step.pause || tutorial.seenPauses[step.pause.id]) {
    return;
  }
  tutorial.seenPauses[step.pause.id] = true;
  tutorial.paused = {
    id: step.pause.id,
    stepId: step.id,
    title: step.pause.title,
    lines: step.pause.lines || []
  };
}

function isStepComplete(step, game, event) {
  const type = event.type || "tick";
  if (step.id === "move") {
    return type === "move";
  }
  if (step.id === "nearTown") {
    return type === "nearTown" || Boolean(game.nearTown);
  }
  if (step.id === "enterTown") {
    return type === "enterTown" || game.state === "town";
  }
  if (step.id === "recruit") {
    return type === "recruit";
  }
  if (step.id === "army") {
    return type === "openArmy" || game.state === "army";
  }
  if (step.id === "upgradeTroop") {
    return type === "upgradeTroop";
  }
  if (step.id === "trade") {
    return type === "equipment" || type === "menu";
  }
  if (step.id === "battle") {
    return type === "battleEnd";
  }
  if (step.id === "afterBattle") {
    return false;
  }
  return false;
}

function drawTutorialPanel(ctx, game, step, index) {
  const x = CONFIG.canvasWidth - 254;
  const y = CONFIG.canvasHeight - 178;
  const w = 238;
  const h = 136;
  drawPanel(ctx, x, y, w, h, "新手教程", "menu");
  drawPixelText(ctx, step.title, x + 18, y + 24, "#7df3ff", 15);
  drawWrappedText(ctx, step.objective, x + 18, y + 50, w - 36, 12, UI_TEXT.main, 2);
  drawPixelText(ctx, step.hint, x + 18, y + 94, UI_TEXT.muted, 10);
  drawPixelText(ctx, (index + 1) + "/" + TUTORIAL_STEPS.length, x + w - 18, y + 25, "#ffd56a", 11, "right");
  const finalStep = index >= TUTORIAL_STEPS.length - 1;
  const action = finalStep ? "tutorialComplete" : "tutorialSkip";
  const label = finalStep ? "完成" : "跳过";
  const button = addButton(game.ui, x + w - 72, y + h - 34, 54, 24, label, action);
  drawButton(ctx, button, game.input);
}

function drawTutorialPause(ctx, game, pause) {
  addButton(game.ui, 0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight, "", "tutorialBlock", false, true);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.54)";
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  drawPanel(ctx, 286, 154, 388, 214, pause.title || "教程提示", "menu");
  drawPixelText(ctx, pause.title || "教程提示", CONFIG.canvasWidth / 2, 190, "#ffd56a", 22, "center");
  const lines = pause.lines && pause.lines.length ? pause.lines : ["了解这个系统后，继续你的征途。"];
  let y = 234;
  lines.forEach(function (line) {
    const used = drawWrappedText(ctx, line, 330, y, 300, 13, UI_TEXT.main, 2);
    y += used * 20;
  });
  const nextButton = addButton(game.ui, 424, 316, 112, 34, "继续", "tutorialNext");
  drawButton(ctx, nextButton, game.input);
  ctx.restore();
}

function drawWrappedText(ctx, text, x, y, maxWidth, size, color, maxLines) {
  setupCanvasFont(ctx, size);
  const lines = wrapText(ctx, String(text || ""), maxWidth).slice(0, maxLines || 3);
  lines.forEach(function (line, index) {
    drawPixelText(ctx, line, x, y + index * 18, color, size);
  });
  return lines.length;
}

function getStepById(stepId) {
  return TUTORIAL_STEPS.find(function (step) {
    return step.id === stepId;
  }) || null;
}

function getStepIndex(stepId) {
  return Math.max(0, TUTORIAL_STEPS.findIndex(function (step) {
    return step.id === stepId;
  }));
}

function getNextStep(stepId) {
  const index = getStepIndex(stepId);
  return TUTORIAL_STEPS[index + 1] || null;
}

function getNextStepForGame(game, stepId) {
  let next = getNextStep(stepId);
  if (next && next.id === "battle" && isGraykeepOwnedByPlayer(game)) {
    next = getNextStep(next.id);
  }
  return next;
}

function isGraykeepOwnedByPlayer(game) {
  const towns = game && game.map && Array.isArray(game.map.towns) ? game.map.towns : [];
  const graykeep = towns.find(function (town) {
    return town.id === "graykeep";
  });
  return Boolean(graykeep && graykeep.owner === "player");
}

function normalizeBooleanMap(value) {
  const result = {};
  if (!value || typeof value !== "object") {
    return result;
  }
  Object.keys(value).forEach(function (key) {
    result[key] = Boolean(value[key]);
  });
  return result;
}
