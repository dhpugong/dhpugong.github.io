import { config } from "./config.js";
import { createAiStats } from "./score.js";
import { storage } from "./storage.js";

export function createGameState() {
  const wallMode = storage.loadWallMode();

  return {
    snake: [],
    foods: [],
    particles: [],
    direction: config.directions.right,
    nextDirection: config.directions.right,
    directionChangedThisTick: false,
    score: 0,
    bestScore: storage.loadBestScore(wallMode),
    level: 1,
    eatenCount: 0,
    tickMs: config.difficulties.chill.baseTick,
    timerId: undefined,
    state: "ready",
    difficulty: "chill",
    skinName: storage.loadSkin(),
    wallMode,
    aiEnabled: false,
    aiAlgorithm: storage.loadAiAlgorithm(),
    aiStats: createAiStats(),
    aiRating: undefined,
  };
}
