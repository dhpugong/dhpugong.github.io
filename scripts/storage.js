(function () {
  const { scoreStorageKey, skinStorageKey, skins } = window.SnakeConfig;

  function readNumber(key, fallback) {
    try {
      const value = Number.parseInt(localStorage.getItem(key), 10);
      return Number.isFinite(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function writeValue(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Storage can be blocked; the game should still keep running.
    }
  }

  window.SnakeStorage = {
    loadBestScore() {
      return readNumber(scoreStorageKey, 0);
    },
    saveBestScore(score) {
      writeValue(scoreStorageKey, score);
    },
    loadSkin() {
      try {
        const storedSkin = localStorage.getItem(skinStorageKey);
        return skins[storedSkin] ? storedSkin : "bamboo";
      } catch {
        return "bamboo";
      }
    },
    saveSkin(skinName) {
      writeValue(skinStorageKey, skinName);
    },
  };
})();
