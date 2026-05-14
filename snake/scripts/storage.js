import { config } from "./config.js";

const {
  aiAlgorithmStorageKey,
  aiAlgorithms,
  aiRatingsStorageKey,
  scoreStorageKey,
  skinStorageKey,
  skins,
  wallModeStorageKey,
  wallModes,
} = config;

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

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked; the game should still keep running.
  }
}

export const storage = {
  getBestScoreKey(wallMode) {
    return `${scoreStorageKey}-${wallModes[wallMode] ? wallMode : "wrap"}`;
  },
  loadBestScore(wallMode) {
    return readNumber(this.getBestScoreKey(wallMode), 0);
  },
  saveBestScore(wallMode, score) {
    writeValue(this.getBestScoreKey(wallMode), score);
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
  loadWallMode() {
    try {
      const storedWallMode = localStorage.getItem(wallModeStorageKey);
      return wallModes[storedWallMode] ? storedWallMode : "wrap";
    } catch {
      return "wrap";
    }
  },
  saveWallMode(wallMode) {
    writeValue(wallModeStorageKey, wallMode);
  },
  loadAiAlgorithm() {
    try {
      const storedAlgorithm = localStorage.getItem(aiAlgorithmStorageKey);
      if (storedAlgorithm === "adversarial") {
        return "reinforcement";
      }

      return aiAlgorithms[storedAlgorithm] ? storedAlgorithm : "lookahead";
    } catch {
      return "lookahead";
    }
  },
  saveAiAlgorithm(algorithmName) {
    writeValue(aiAlgorithmStorageKey, algorithmName);
  },
  loadAiRatings() {
    return readJson(aiRatingsStorageKey, {});
  },
  saveAiRating(algorithmName, rating) {
    const ratings = this.loadAiRatings();
    const current = ratings[algorithmName] || { games: 0, averageScore: 0 };
    const games = current.games + 1;
    const averageScore = ((current.averageScore * current.games) + rating.total) / games;

    ratings[algorithmName] = {
      games,
      averageScore,
      last: {
        total: rating.total,
        grade: rating.grade,
        parts: rating.parts,
        at: Date.now(),
      },
    };

    writeJson(aiRatingsStorageKey, ratings);
    return ratings[algorithmName];
  },
};
