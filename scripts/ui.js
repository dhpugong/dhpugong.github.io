import { config } from "./config.js";

export function getElements() {
  return {
    canvas: document.getElementById("board"),
    score: document.getElementById("score"),
    bestScore: document.getElementById("bestScore"),
    level: document.getElementById("level"),
    length: document.getElementById("length"),
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
    aiToggle: document.getElementById("aiToggle"),
    aiAlgorithmSelect: document.getElementById("aiAlgorithmSelect"),
    aiAlgorithmSelectLabelText: document.getElementById("aiAlgorithmSelectLabelText"),
    aiAlgorithmSelectTrigger: document.getElementById("aiAlgorithmSelectTrigger"),
    skinSelect: document.getElementById("skinSelect"),
    skinSelectLabelText: document.getElementById("skinSelectLabelText"),
    skinSelectTrigger: document.getElementById("skinSelectTrigger"),
  };
}

export function updateHud(elements, game, getBaseTick, message) {
  elements.score.textContent = String(game.score);
  elements.bestScore.textContent = String(game.bestScore);
  elements.level.textContent = String(game.level);
  elements.length.textContent = String(game.snake.length);
  elements.speed.textContent = `${(getBaseTick(game) / game.tickMs).toFixed(1)}x`;
  elements.levelProgress.style.width = `${((game.eatenCount % 5) / 5) * 100}%`;

  if (message) {
    elements.eventText.textContent = message;
  }
}

export function showOverlay(elements, kicker, title, buttonText) {
  elements.overlayKicker.textContent = kicker;
  elements.overlayTitle.textContent = title;
  elements.startButton.textContent = buttonText;
  elements.overlay.classList.add("visible");
}

export function hideOverlay(elements) {
  elements.overlay.classList.remove("visible");
}

export function updatePauseIcon(elements, game) {
  const icon = game.state === "playing" ? "II" : ">";
  elements.pauseIcon.textContent = icon;
  elements.mobilePauseButton.textContent = icon;
}

export function syncDifficultyButtons(game) {
  document.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.classList.toggle("active", button.dataset.difficulty === game.difficulty);
  });
}

export function syncSkinButtons(game) {
  const skin = config.skins[game.skinName];
  document.documentElement.style.setProperty("--skin-accent", skin.head);
  document.documentElement.style.setProperty("--skin-preview-start", skin.head);
  document.documentElement.style.setProperty("--skin-preview-mid", skin.bodyStart);
  document.documentElement.style.setProperty("--skin-preview-end", skin.bodyEnd);
  if (document.getElementById("skinSelectLabelText")) {
    document.getElementById("skinSelectLabelText").textContent = skin.label;
  }
  if (document.getElementById("skinSelectTrigger")) {
    document.getElementById("skinSelectTrigger").dataset.skin = game.skinName;
  }
  document.querySelectorAll("[data-skin]").forEach((button) => {
    button.classList.toggle("active", button.dataset.skin === game.skinName);
    if (button.getAttribute("role") === "option") {
      button.setAttribute("aria-selected", String(button.dataset.skin === game.skinName));
    }
  });
}

export function syncWallModeButtons(game) {
  document.querySelectorAll("[data-wall-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.wallMode === game.wallMode);
  });
}

export function syncAiAlgorithmButtons(game) {
  const algorithm = config.aiAlgorithms[game.aiAlgorithm];
  if (document.getElementById("aiAlgorithmSelectLabelText")) {
    document.getElementById("aiAlgorithmSelectLabelText").textContent = algorithm.label;
  }
  if (document.getElementById("aiAlgorithmSelectTrigger")) {
    document.getElementById("aiAlgorithmSelectTrigger").dataset.aiAlgorithm = game.aiAlgorithm;
  }
  document.querySelectorAll("[data-ai-algorithm]").forEach((button) => {
    button.classList.toggle("active", button.dataset.aiAlgorithm === game.aiAlgorithm);
    if (button.getAttribute("role") === "option") {
      button.setAttribute("aria-selected", String(button.dataset.aiAlgorithm === game.aiAlgorithm));
    }
  });
}

export function syncAiToggle(elements, game) {
  elements.aiToggle.checked = game.aiEnabled;
}
