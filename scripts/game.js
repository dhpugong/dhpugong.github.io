(function () {
  const config = window.SnakeConfig;
  const storage = window.SnakeStorage;

  const elements = {
    canvas: document.getElementById("board"),
    score: document.getElementById("score"),
    bestScore: document.getElementById("bestScore"),
    level: document.getElementById("level"),
    length: document.getElementById("length"),
    combo: document.getElementById("combo"),
    speed: document.getElementById("speed"),
    eventText: document.getElementById("eventText"),
    levelProgress: document.getElementById("levelProgress"),
    overlay: document.getElementById("overlay"),
    overlayKicker: document.getElementById("overlayKicker"),
    overlayTitle: document.getElementById("overlayTitle"),
    startButton: document.getElementById("startButton"),
    pauseButton: document.getElementById("pauseButton"),
    mobilePauseButton: document.getElementById("mobilePauseButton"),
    pauseIcon: document.getElementById("pauseIcon"),
    restartButton: document.getElementById("restartButton"),
    soundToggle: document.getElementById("soundToggle"),
  };

  const renderer = new window.SnakeRenderer(elements.canvas);
  const audio = new window.SnakeAudio(elements.soundToggle);
  const tileCount = config.boardSize / config.gridSize;

  const game = {
    snake: [],
    foods: [],
    particles: [],
    direction: config.directions.right,
    nextDirection: config.directions.right,
    directionChangedThisTick: false,
    score: 0,
    bestScore: storage.loadBestScore(),
    level: 1,
    combo: 1,
    eatenCount: 0,
    tickMs: config.difficulties.chill.baseTick,
    timerId: undefined,
    state: "ready",
    difficulty: "chill",
    skinName: storage.loadSkin(),
    touchStart: undefined,
  };

  function resetGame() {
    audio.syncEnabled();
    game.snake = [
      { x: 11, y: 12 },
      { x: 10, y: 12 },
      { x: 9, y: 12 },
    ];
    game.foods = [];
    game.particles = [];
    game.direction = config.directions.right;
    game.nextDirection = config.directions.right;
    game.directionChangedThisTick = false;
    game.score = 0;
    game.level = 1;
    game.combo = 1;
    game.eatenCount = 0;
    game.tickMs = getBaseTick();
    game.state = "ready";
    stopLoop();
    game.foods = [createNextFood()];
    updateHud("准备开始一局漂亮的走位。");
    render();
    showOverlay("准备", "选择难度后开始游戏。", "开始");
    updatePauseIcon();
  }

  function startGame() {
    if (game.state === "gameover") {
      resetGame();
    }

    game.state = "playing";
    hideOverlay();
    startLoop();
    audio.startMusic(() => game.state);
    updateHud("开始！撞墙会从对面出来。");
    render();
  }

  function pauseGame() {
    if (game.state === "playing") {
      game.state = "paused";
      stopLoop();
      audio.stopMusic();
      showOverlay("已暂停", "调整一下节奏，然后继续。", "继续");
      updatePauseIcon();
      return;
    }

    if (game.state === "paused" || game.state === "ready") {
      startGame();
    }
  }

  function startLoop() {
    stopLoop();
    game.timerId = window.setInterval(tick, game.tickMs);
    updatePauseIcon();
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
    game.direction = game.nextDirection;
    game.directionChangedThisTick = false;

    const head = game.snake[0];
    const nextHead = wrapPoint({
      x: head.x + game.direction.x,
      y: head.y + game.direction.y,
    });

    const foodIndex = game.foods.findIndex((item) => samePoint(item, nextHead));
    const willEat = foodIndex >= 0;

    if (isSnakeCollision(nextHead, willEat)) {
      endGame();
      return;
    }

    game.snake.unshift(nextHead);

    if (willEat) {
      eatFood(foodIndex, nextHead);
    } else {
      game.snake.pop();
      game.combo = 1;
    }

    updateParticles();
    updateHud();
    render();
  }

  function eatFood(foodIndex, position) {
    const food = game.foods.splice(foodIndex, 1)[0];
    const points = getFoodPoints(food);
    const skin = getSkin();
    game.score += points;
    game.combo = Math.min(game.combo + 1, 9);
    game.eatenCount += 1;
    updateBestScore();
    spawnParticles(position, food.type === "bonus" ? food.color : skin.particle, food.type === "bonus" ? 14 : 8);
    audio.playTone(food.type === "bonus" ? 880 : 660, 0.12, food.type === "bonus" ? 0.1 : 0.085, "triangle");

    updateHud(food.type === "bonus" ? `奖励果实：+${points}` : `吃到果实：+${points}`);

    const nextLevel = Math.floor(game.eatenCount / 5) + 1;
    if (nextLevel > game.level) {
      game.level = nextLevel;
      game.tickMs = Math.max(48, getBaseTick() - (game.level - 1) * 7);
      audio.playTone(960, 0.16, 0.08, "square");
      restartLoop();
      updateHud(`等级 ${game.level}，速度提升。`);
    }

    game.foods = [createNextFood()];
  }

  function endGame() {
    game.state = "gameover";
    stopLoop();
    audio.stopMusic();
    updateBestScore();
    audio.playTone(180, 0.24, 0.07, "sawtooth");
    updateHud(`本局结束，得分 ${game.score}。`);
    render();
    showOverlay("游戏结束", `本局 ${game.score} 分，最高 ${game.bestScore} 分。`, "再来一局");
    updatePauseIcon();
  }

  function createNextFood() {
    const shouldCreateBonus = game.eatenCount > 0 && (Math.random() < 0.22 || game.eatenCount % 6 === 0);
    return createFood(shouldCreateBonus ? "bonus" : "normal");
  }

  function createFood(type) {
    const variants = {
      normal: { type: "normal", color: "#ffd166", pulse: Math.random() * Math.PI * 2 },
      bonus: { type: "bonus", color: "#b48cff", pulse: Math.random() * Math.PI * 2 },
    };

    return {
      ...variants[type],
      ...createEmptyPoint(),
    };
  }

  function createEmptyPoint() {
    let attempts = 0;

    while (attempts < 1000) {
      const candidate = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
      };

      if (!game.snake.some((segment) => samePoint(segment, candidate)) &&
        !game.foods.some((item) => samePoint(item, candidate))) {
        return candidate;
      }

      attempts += 1;
    }

    return { x: 1, y: 1 };
  }

  function getFoodPoints(food) {
    const base = config.difficulties[game.difficulty].score;
    return food.type === "bonus" ? base * 3 * game.combo : base * game.combo;
  }

  function getBaseTick() {
    return config.difficulties[game.difficulty].baseTick;
  }

  function getSkin() {
    return config.skins[game.skinName] || config.skins.bamboo;
  }

  function wrapPoint(point) {
    return {
      x: (point.x + tileCount) % tileCount,
      y: (point.y + tileCount) % tileCount,
    };
  }

  function samePoint(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function isSnakeCollision(point, includeTail) {
    const body = includeTail ? game.snake : game.snake.slice(0, -1);
    return body.some((segment) => samePoint(segment, point));
  }

  function setDirection(newDirection) {
    if (game.state === "ready") {
      startGame();
    }

    if (game.state !== "playing" || game.directionChangedThisTick) {
      return;
    }

    const reversing = newDirection.x + game.direction.x === 0 && newDirection.y + game.direction.y === 0;

    if (!reversing) {
      game.nextDirection = newDirection;
      game.directionChangedThisTick = true;
    }
  }

  function updateHud(message) {
    elements.score.textContent = String(game.score);
    elements.bestScore.textContent = String(game.bestScore);
    elements.level.textContent = String(game.level);
    elements.length.textContent = String(game.snake.length);
    elements.combo.textContent = `x${game.combo}`;
    elements.speed.textContent = `${(getBaseTick() / game.tickMs).toFixed(1)}x`;
    elements.levelProgress.style.width = `${((game.eatenCount % 5) / 5) * 100}%`;

    if (message) {
      elements.eventText.textContent = message;
    }
  }

  function updateBestScore() {
    if (game.score > game.bestScore) {
      game.bestScore = game.score;
      storage.saveBestScore(game.bestScore);
    }
  }

  function showOverlay(kicker, title, buttonText) {
    elements.overlayKicker.textContent = kicker;
    elements.overlayTitle.textContent = title;
    elements.startButton.textContent = buttonText;
    elements.overlay.classList.add("visible");
  }

  function hideOverlay() {
    elements.overlay.classList.remove("visible");
  }

  function updatePauseIcon() {
    const icon = game.state === "playing" ? "II" : ">";
    elements.pauseIcon.textContent = icon;
    elements.mobilePauseButton.textContent = icon;
  }

  function render() {
    renderer.render({
      snake: game.snake,
      foods: game.foods,
      particles: game.particles,
      direction: game.direction,
      skin: getSkin(),
    });
  }

  function spawnParticles(point, color, amount) {
    const originX = point.x * config.gridSize + config.gridSize / 2;
    const originY = point.y * config.gridSize + config.gridSize / 2;

    for (let i = 0; i < amount; i += 1) {
      const angle = (Math.PI * 2 * i) / amount;
      game.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * (1.8 + Math.random() * 1.6),
        vy: Math.sin(angle) * (1.8 + Math.random() * 1.6),
        life: 1,
        color,
      });
    }
  }

  function updateParticles() {
    game.particles = game.particles
      .map((particle) => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        life: particle.life - 0.16,
      }))
      .filter((particle) => particle.life > 0);
  }

  function handleKeydown(event) {
    const keyDirections = {
      ArrowUp: config.directions.up,
      KeyW: config.directions.up,
      ArrowDown: config.directions.down,
      KeyS: config.directions.down,
      ArrowLeft: config.directions.left,
      KeyA: config.directions.left,
      ArrowRight: config.directions.right,
      KeyD: config.directions.right,
    };

    if (event.code === "Space" || event.code === "KeyP") {
      event.preventDefault();
      pauseGame();
      return;
    }

    if (event.code === "Enter" && game.state !== "playing") {
      event.preventDefault();
      startGame();
      return;
    }

    const newDirection = keyDirections[event.code];

    if (newDirection) {
      event.preventDefault();
      setDirection(newDirection);
    }
  }

  function handleTouchStart(event) {
    const touch = event.changedTouches[0];
    game.touchStart = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event) {
    if (!game.touchStart) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - game.touchStart.x;
    const deltaY = touch.clientY - game.touchStart.y;

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 20) {
      game.touchStart = undefined;
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDirection(deltaX > 0 ? config.directions.right : config.directions.left);
    } else {
      setDirection(deltaY > 0 ? config.directions.down : config.directions.up);
    }

    game.touchStart = undefined;
  }

  function setDifficulty(nextDifficulty) {
    game.difficulty = nextDifficulty;
    document.querySelectorAll("[data-difficulty]").forEach((button) => {
      button.classList.toggle("active", button.dataset.difficulty === game.difficulty);
    });

    if (game.state !== "playing") {
      game.tickMs = getBaseTick();
      updateHud(`已选择${config.difficulties[game.difficulty].label}难度。`);
      return;
    }

    game.tickMs = Math.max(48, getBaseTick() - (game.level - 1) * 7);
    restartLoop();
    updateHud(`已切换为${config.difficulties[game.difficulty].label}难度。`);
  }

  function setSkin(nextSkinName) {
    if (!config.skins[nextSkinName]) {
      return;
    }

    game.skinName = nextSkinName;
    document.documentElement.style.setProperty("--skin-accent", config.skins[game.skinName].head);
    document.querySelectorAll("[data-skin]").forEach((button) => {
      button.classList.toggle("active", button.dataset.skin === game.skinName);
    });
    storage.saveSkin(game.skinName);
    updateHud(`已换上${config.skins[game.skinName].label}皮肤。`);
    render();
  }

  function syncOptions() {
    const enabled = audio.syncEnabled();

    if (!enabled) {
      updateHud("音乐与音效已关闭。");
      return;
    }

    if (game.state === "playing") {
      audio.startMusic(() => game.state);
    }

    audio.playTone(520, 0.08, 0.06, "triangle");
    updateHud("音乐与音效已开启。");
  }

  function bindEvents() {
    document.addEventListener("keydown", handleKeydown);
    elements.canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    elements.canvas.addEventListener("touchend", handleTouchEnd, { passive: true });
    elements.startButton.addEventListener("click", startGame);
    elements.pauseButton.addEventListener("click", pauseGame);
    elements.mobilePauseButton.addEventListener("click", pauseGame);
    elements.restartButton.addEventListener("click", resetGame);
    elements.soundToggle.addEventListener("change", syncOptions);
    document.querySelectorAll("[data-direction]").forEach((button) => {
      button.addEventListener("click", () => setDirection(config.directions[button.dataset.direction]));
    });
    document.querySelectorAll("[data-difficulty]").forEach((button) => {
      button.addEventListener("click", () => setDifficulty(button.dataset.difficulty));
    });
    document.querySelectorAll("[data-skin]").forEach((button) => {
      button.addEventListener("click", () => setSkin(button.dataset.skin));
    });
  }

  bindEvents();
  resetGame();
  setSkin(game.skinName);
})();
