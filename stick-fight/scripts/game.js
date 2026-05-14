import {
  consumeProjectile,
  createFighter,
  resetFighter,
  resolveAttack,
  updateFighter,
  updateProjectiles,
} from "./fighter.js";
import { createInput } from "./input.js";
import { createRenderer } from "./render.js";

const roundLength = 99;

export function createGame() {
  const canvas = document.getElementById("fightCanvas");
  const renderer = createRenderer(canvas);
  const input = createInput();
  const elements = {
    p1Health: document.getElementById("p1Health"),
    p2Health: document.getElementById("p2Health"),
    roundTime: document.getElementById("roundTime"),
    overlay: document.getElementById("overlay"),
    overlayKicker: document.getElementById("overlayKicker"),
    overlayTitle: document.getElementById("overlayTitle"),
    startButton: document.getElementById("startButton"),
    pauseButton: document.getElementById("pauseButton"),
    restartButton: document.getElementById("restartButton"),
  };

  const game = {
    state: "ready",
    timeLeft: roundLength,
    lastTime: 0,
    animationId: undefined,
    effects: [],
    projectiles: [],
    stagePulse: 0,
    debugHitboxes: false,
    p1: createFighter({
      id: "p1",
      name: "青锋",
      color: "#83ff71",
      accent: "#2fc778",
      x: 250,
      facing: 1,
      controls: {
        left: "a",
        right: "d",
        jump: "k",
        block: "s",
        light: "j",
        dash: "l",
        ranged: "u",
      },
    }),
    p2: createFighter({
      id: "p2",
      name: "苍雷",
      color: "#62d8ff",
      accent: "#208dc7",
      x: 710,
      facing: -1,
      controls: {
        left: "ArrowLeft",
        right: "ArrowRight",
        jump: "2",
        block: "ArrowDown",
        light: "1",
        dash: "3",
        ranged: "4",
      },
    }),
  };

  function init() {
    input.bind();
    bindEvents();
    resetRound();
    renderer.render(game);
  }

  function bindEvents() {
    elements.startButton.addEventListener("click", start);
    elements.pauseButton.addEventListener("click", togglePause);
    elements.restartButton.addEventListener("click", restart);
  }

  function resetRound() {
    game.state = "ready";
    game.timeLeft = roundLength;
    game.effects = [];
    game.projectiles = [];
    game.stagePulse = 0;
    resetFighter(game.p1, 250, 1);
    resetFighter(game.p2, 710, -1);
    updateHud();
    elements.pauseButton.textContent = "暂停";
    showOverlay("READY", "本地双人，一局定胜负。", "开始对抗");
  }

  function start() {
    if (game.state === "gameover") {
      resetRound();
    }

    game.state = "playing";
    game.lastTime = performance.now();
    elements.pauseButton.textContent = "暂停";
    hideOverlay();
    loop(game.lastTime);
  }

  function restart() {
    stopLoop();
    resetRound();
    renderer.render(game);
  }

  function togglePause() {
    if (game.state === "playing") {
      game.state = "paused";
      stopLoop();
      showOverlay("PAUSED", "节奏停住了，但拳头还热着。", "继续");
      elements.pauseButton.textContent = "继续";
      return;
    }

    if (game.state === "paused" || game.state === "ready") {
      elements.pauseButton.textContent = "暂停";
      start();
    }
  }

  function loop(now) {
    if (game.state !== "playing") {
      return;
    }

    const dt = Math.min(0.033, (now - game.lastTime) / 1000 || 0);
    game.lastTime = now;
    tick(dt);
    renderer.render(game);
    input.clearFrame();
    game.animationId = requestAnimationFrame(loop);
  }

  function tick(dt) {
    game.timeLeft = Math.max(0, game.timeLeft - dt);
    game.stagePulse += dt;

    updateFighter(game.p1, game.p2, input, dt, canvas.width);
    updateFighter(game.p2, game.p1, input, dt, canvas.width);
    addProjectile(consumeProjectile(game.p1));
    addProjectile(consumeProjectile(game.p2));
    resolveAttack(game.p1, game.p2, game.effects);
    resolveAttack(game.p2, game.p1, game.effects);
    game.projectiles = updateProjectiles(game.projectiles, [game.p1, game.p2], game.effects, dt, canvas.width);
    updateEffects(dt);
    updateHud();

    if (game.p1.hp <= 0 || game.p2.hp <= 0 || game.timeLeft <= 0) {
      finishRound();
    }
  }

  function updateEffects(dt) {
    game.effects.forEach((effect) => {
      effect.age += dt;
    });
    game.effects = game.effects.filter((effect) => effect.age < effect.life);
  }

  function addProjectile(projectile) {
    if (projectile) {
      game.projectiles.push(projectile);
    }
  }

  function finishRound() {
    game.state = "gameover";
    stopLoop();
    renderer.render(game);

    if (game.p1.hp === game.p2.hp) {
      showOverlay("DRAW", "平局，谁也没能压过谁。", "再来一局");
      return;
    }

    const winner = game.p1.hp > game.p2.hp ? "P1 青锋" : "P2 苍雷";
    showOverlay("K.O.", `${winner} 获胜。`, "再来一局");
  }

  function updateHud() {
    elements.p1Health.style.width = `${game.p1.hp}%`;
    elements.p2Health.style.width = `${game.p2.hp}%`;
    elements.roundTime.textContent = String(Math.ceil(game.timeLeft));
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

  function stopLoop() {
    if (game.animationId) {
      cancelAnimationFrame(game.animationId);
      game.animationId = undefined;
    }
  }

  return { init };
}
