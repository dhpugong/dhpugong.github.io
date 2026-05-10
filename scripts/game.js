import { chooseDirection, countLegalMoves } from "./ai.js";
import { SnakeAudio } from "./audio.js";
import { config } from "./config.js";
import { bindInput } from "./input.js";
import { SnakeRenderer } from "./render.js";
import {
  createAiSnapshot,
  createNextFood,
  getBaseTick,
  getFoodPoints,
  getLevelTick,
  getSkin,
  getStartMessage,
  isSnakeCollision,
  isWallCollision,
  resetRound,
  samePoint,
  spawnParticles,
  updateParticles,
  wrapPoint,
} from "./rules.js";
import { bindSettings } from "./settings.js";
import { calculateAiRating, createAiStats } from "./score.js";
import { createGameState } from "./state.js";
import { storage } from "./storage.js";
import {
  getElements,
  hideOverlay,
  showOverlay,
  syncAiAlgorithmButtons,
  syncAiToggle,
  syncDifficultyButtons,
  syncSkinButtons,
  syncWallModeButtons,
  updateHud,
  updatePauseIcon,
} from "./ui.js";

export function createGame() {
  const elements = getElements();
  const renderer = new SnakeRenderer(elements.canvas);
  const audio = new SnakeAudio(elements.soundToggle);
  const game = createGameState();

  function resetGame() {
    audio.syncEnabled();
    stopLoop();
    resetRound(game);
    updateHud(elements, game, getBaseTick, "准备开始一局漂亮的走位。");
    render();
    showOverlay(elements, "准备", "选择难度后开始游戏。", "开始");
    updatePauseIcon(elements, game);
  }

  function startGame() {
    if (game.state === "gameover") {
      resetGame();
    }

    game.state = "playing";
    hideOverlay(elements);
    startLoop();
    audio.startMusic(() => game.state);
    updateHud(elements, game, getBaseTick, getStartMessage(game));
    render();
  }

  function pauseGame() {
    if (game.state === "playing") {
      game.state = "paused";
      stopLoop();
      audio.stopMusic();
      showOverlay(elements, "已暂停", "调整一下节奏，然后继续。", "继续");
      updatePauseIcon(elements, game);
      return;
    }

    if (game.state === "paused" || game.state === "ready") {
      startGame();
    }
  }

  function startLoop() {
    stopLoop();
    game.timerId = window.setInterval(tick, game.tickMs);
    updatePauseIcon(elements, game);
  }

  function restartLoop() {
    if (game.state === "playing") {
      startLoop();
    }
  }

  function stopLoop() {
    if (game.timerId) {
      window.clearInterval(game.timerId);
      game.timerId = undefined;
    }
  }

  function tick() {
    applyAiDirection();
    game.direction = game.nextDirection;
    game.directionChangedThisTick = false;

    const head = game.snake[0];
    const nextPoint = {
      x: head.x + game.direction.x,
      y: head.y + game.direction.y,
    };

    if (game.wallMode === "solid" && isWallCollision(nextPoint)) {
      trackAiStep(false, "wall");
      endGame();
      return;
    }

    const nextHead = game.wallMode === "wrap" ? wrapPoint(nextPoint) : nextPoint;
    const foodIndex = game.foods.findIndex((item) => samePoint(item, nextHead));
    const willEat = foodIndex >= 0;

    if (isSnakeCollision(game, nextHead, willEat)) {
      trackAiStep(false, "snake");
      endGame();
      return;
    }

    game.snake.unshift(nextHead);

    if (willEat) {
      eatFood(foodIndex, nextHead);
    } else {
      game.snake.pop();
    }

    trackAiStep(willEat);
    updateParticles(game);
    updateHud(elements, game, getBaseTick);
    render();
  }

  function applyAiDirection() {
    if (!game.aiEnabled || game.state !== "playing") {
      return;
    }

    const directionName = chooseDirection(createAiSnapshot(game), game.aiAlgorithm);
    const nextDirection = config.directions[directionName];

    if (nextDirection && canTurn(nextDirection)) {
      game.nextDirection = nextDirection;
    }
  }

  function eatFood(foodIndex, position) {
    const food = game.foods.splice(foodIndex, 1)[0];
    const points = getFoodPoints(game, food);
    const skin = getSkin(game);
    game.score += points;
    game.eatenCount += 1;
    updateBestScore();
    spawnParticles(game, position, food.type === "bonus" ? food.color : skin.particle, food.type === "bonus" ? 14 : 8);
    audio.playTone(food.type === "bonus" ? 880 : 660, 0.12, food.type === "bonus" ? 0.1 : 0.085, "triangle");

    updateHud(elements, game, getBaseTick, food.type === "bonus" ? `奖励果实：+${points}` : `吃到果实：+${points}`);

    const nextLevel = Math.floor(game.eatenCount / 5) + 1;
    if (nextLevel > game.level) {
      game.level = nextLevel;
      game.tickMs = getLevelTick(game);
      audio.playTone(960, 0.16, 0.08, "square");
      restartLoop();
      updateHud(elements, game, getBaseTick, `等级 ${game.level}，速度提升。`);
    }

    game.foods = [createNextFood(game)];
  }

  function endGame() {
    game.state = "gameover";
    stopLoop();
    audio.stopMusic();
    updateBestScore();
    const rating = finishAiRating();
    audio.playTone(180, 0.24, 0.07, "sawtooth");
    updateHud(elements, game, getBaseTick, `本局结束，得分 ${game.score}。`);
    render();
    showOverlay(elements, "游戏结束", `本局 ${game.score} 分，最高 ${game.bestScore} 分。`, "再来一局");
    showOverlay(elements, "游戏结束", createGameOverText(rating), "再来一局");
    updatePauseIcon(elements, game);
  }

  function setDirection(newDirection) {
    if (game.state === "ready") {
      startGame();
    }

    if (game.state !== "playing" || game.directionChangedThisTick) {
      return;
    }

    if (canTurn(newDirection)) {
      game.nextDirection = newDirection;
      game.directionChangedThisTick = true;
    }
  }

  function canTurn(newDirection) {
    return newDirection.x + game.direction.x !== 0 || newDirection.y + game.direction.y !== 0;
  }

  function updateBestScore() {
    if (game.score > game.bestScore) {
      game.bestScore = game.score;
      storage.saveBestScore(game.bestScore);
    }
  }

  function render() {
    renderer.render({
      snake: game.snake,
      foods: game.foods,
      particles: game.particles,
      direction: game.direction,
      skin: getSkin(game),
    });
  }

  function setDifficulty(nextDifficulty) {
    if (!config.difficulties[nextDifficulty]) {
      return;
    }

    game.difficulty = nextDifficulty;
    syncDifficultyButtons(game);

    if (game.state !== "playing") {
      game.tickMs = getLevelTick(game);
      updateHud(elements, game, getBaseTick, `已选择${config.difficulties[game.difficulty].label}难度。`);
      return;
    }

    game.tickMs = getLevelTick(game);
    restartLoop();
    updateHud(elements, game, getBaseTick, `已切换为${config.difficulties[game.difficulty].label}难度。`);
  }

  function setSkin(nextSkinName) {
    if (!config.skins[nextSkinName]) {
      return;
    }

    game.skinName = nextSkinName;
    syncSkinButtons(game);
    storage.saveSkin(game.skinName);
    updateHud(elements, game, getBaseTick, `已换上${config.skins[game.skinName].label}皮肤。`);
    render();
  }

  function setWallMode(nextWallMode) {
    if (!config.wallModes[nextWallMode]) {
      return;
    }

    game.wallMode = nextWallMode;
    syncWallModeButtons(game);
    storage.saveWallMode(game.wallMode);
    updateHud(elements, game, getBaseTick, `已切换为${config.wallModes[game.wallMode].label}模式。`);
  }

  function setAiEnabled(enabled) {
    const wasEnabled = game.aiEnabled;
    game.aiEnabled = enabled;

    if (enabled && !wasEnabled) {
      game.aiStats = createAiStats();
      game.aiStats.scoreAtStart = game.score;
    }

    game.aiStats.algorithmName = game.aiAlgorithm;
    syncAiToggle(elements, game);
    updateHud(elements, game, getBaseTick, enabled ? "AI 控制已开启。" : "AI 控制已关闭。");
  }

  function setAiAlgorithm(nextAlgorithm) {
    if (!config.aiAlgorithms[nextAlgorithm]) {
      return;
    }

    game.aiAlgorithm = nextAlgorithm;
    game.aiStats = createAiStats();
    game.aiStats.scoreAtStart = game.score;
    game.aiStats.algorithmName = nextAlgorithm;
    syncAiAlgorithmButtons(game);
    storage.saveAiAlgorithm(game.aiAlgorithm);
    updateHud(elements, game, getBaseTick, `AI 算法：${config.aiAlgorithms[game.aiAlgorithm].label}`);
  }

  function trackAiStep(ateFood, deathReason) {
    if (!game.aiEnabled) {
      return;
    }

    game.aiStats.algorithmName = game.aiAlgorithm;

    if (deathReason) {
      game.aiStats.deathReason = deathReason;
      return;
    }

    game.aiStats.stepsSurvived += 1;

    if (ateFood) {
      game.aiStats.foodsEaten += 1;
      game.aiStats.currentNoFoodStreak = 0;
    } else {
      game.aiStats.currentNoFoodStreak += 1;
      game.aiStats.longestNoFoodStreak = Math.max(
        game.aiStats.longestNoFoodStreak,
        game.aiStats.currentNoFoodStreak,
      );
    }

    if (countLegalMoves(createAiSnapshot(game)) <= 1) {
      game.aiStats.dangerTicks += 1;
    }

  }

  function finishAiRating() {
    if (!game.aiEnabled || game.aiStats.stepsSurvived <= 0) {
      game.aiRating = undefined;
      return undefined;
    }

    const rating = calculateAiRating(game);
    storage.saveAiRating(rating.algorithmName, rating);
    game.aiRating = rating;
    return rating;
  }

  function createGameOverText(rating) {
    const baseText = `本局 ${game.score} 分，最高 ${game.bestScore} 分。`;

    if (!rating) {
      return baseText;
    }

    const algorithmLabel = config.aiAlgorithms[rating.algorithmName]?.label || rating.algorithmName;
    return `${baseText} AI ${algorithmLabel} 评分 ${rating.total} (${rating.grade})；得分 ${rating.parts.score} / 生存 ${rating.parts.survival} / 效率 ${rating.parts.efficiency} / 安全 ${rating.parts.safety} / 稳定 ${rating.parts.stability}`;
  }

  function syncSound() {
    const enabled = audio.syncEnabled();

    if (!enabled) {
      updateHud(elements, game, getBaseTick, "音乐与音效已关闭。");
      return;
    }

    if (game.state === "playing") {
      audio.startMusic(() => game.state);
    }

    audio.playTone(520, 0.08, 0.06, "triangle");
    updateHud(elements, game, getBaseTick, "音乐与音效已开启。");
  }

  function bindEvents() {
    bindInput({
      elements,
      directions: config.directions,
      game,
      setDirection,
      pauseGame,
      startGame,
    });
    bindSettings({
      elements,
      setDifficulty,
      setSkin,
      setWallMode,
      setAiEnabled,
      setAiAlgorithm,
      syncSound,
    });
    elements.startButton.addEventListener("click", startGame);
    elements.pauseButton.addEventListener("click", pauseGame);
    elements.mobilePauseButton.addEventListener("click", pauseGame);
    elements.restartButton.addEventListener("click", resetGame);
  }

  function init() {
    bindEvents();
    resetGame();
    setSkin(game.skinName);
    setWallMode(game.wallMode);
    syncAiAlgorithmButtons(game);
    setAiEnabled(false);
  }

  return { init };
}
