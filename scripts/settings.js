export function bindSettings({
  elements,
  setDifficulty,
  setSkin,
  setWallMode,
  setAiEnabled,
  setAiAlgorithm,
  syncSound,
}) {
  elements.soundToggle.addEventListener("change", syncSound);
  elements.aiToggle.addEventListener("change", () => setAiEnabled(elements.aiToggle.checked));
  elements.skinSelectTrigger?.addEventListener("click", () => toggleSkinMenu(elements));
  elements.aiAlgorithmSelectTrigger?.addEventListener("click", () => toggleAiMenu(elements));

  document.querySelectorAll("[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => setDifficulty(button.dataset.difficulty));
  });

  document.querySelectorAll("[data-wall-mode]").forEach((button) => {
    button.addEventListener("click", () => setWallMode(button.dataset.wallMode));
  });

  document.querySelectorAll("[data-ai-algorithm]").forEach((button) => {
    button.addEventListener("click", () => {
      setAiAlgorithm(button.dataset.aiAlgorithm);
      closeAiMenu(elements);
    });
  });

  document.querySelectorAll("[data-skin]").forEach((button) => {
    button.addEventListener("click", () => {
      setSkin(button.dataset.skin);
      closeSkinMenu(elements);
    });
  });

  document.addEventListener("click", (event) => {
    if (!elements.skinSelect?.contains(event.target)) {
      closeSkinMenu(elements);
    }
    if (!elements.aiAlgorithmSelect?.contains(event.target)) {
      closeAiMenu(elements);
    }
  });
}

function toggleSkinMenu(elements) {
  const isOpen = elements.skinSelect.dataset.open === "true";
  elements.skinSelect.dataset.open = String(!isOpen);
  elements.skinSelectTrigger.setAttribute("aria-expanded", String(!isOpen));
}

function closeSkinMenu(elements) {
  if (!elements.skinSelect) {
    return;
  }

  elements.skinSelect.dataset.open = "false";
  elements.skinSelectTrigger?.setAttribute("aria-expanded", "false");
}

function toggleAiMenu(elements) {
  const isOpen = elements.aiAlgorithmSelect.dataset.open === "true";
  elements.aiAlgorithmSelect.dataset.open = String(!isOpen);
  elements.aiAlgorithmSelectTrigger.setAttribute("aria-expanded", String(!isOpen));
}

function closeAiMenu(elements) {
  if (!elements.aiAlgorithmSelect) {
    return;
  }

  elements.aiAlgorithmSelect.dataset.open = "false";
  elements.aiAlgorithmSelectTrigger?.setAttribute("aria-expanded", "false");
}
