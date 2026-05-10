import { config } from "./config.js";

const ratingWeights = {
  score: 0.35,
  survival: 0.25,
  efficiency: 0.2,
  safety: 0.15,
  stability: 0.05,
};

export function createAiStats() {
  return {
    stepsSurvived: 0,
    foodsEaten: 0,
    dangerTicks: 0,
    longestNoFoodStreak: 0,
    currentNoFoodStreak: 0,
    deathReason: "",
    algorithmName: "lookahead",
    scoreAtStart: 0,
  };
}

export function calculateAiRating(game) {
  const stats = game.aiStats;
  const baseScore = config.difficulties[game.difficulty].score;
  const scoreTarget = baseScore * 120;
  const scoreDelta = Math.max(0, game.score - (stats.scoreAtStart || 0));
  const scorePart = clamp((scoreDelta / scoreTarget) * 100);
  const survivalPart = calculateSurvivalPart(game, stats);
  const efficiencyPart = calculateEfficiencyPart(stats);
  const safetyPart = calculateSafetyPart(stats);
  const stabilityPart = calculateStabilityPart(stats);
  const total = Math.round(
    scorePart * ratingWeights.score +
    survivalPart * ratingWeights.survival +
    efficiencyPart * ratingWeights.efficiency +
    safetyPart * ratingWeights.safety +
    stabilityPart * ratingWeights.stability,
  );

  return {
    total,
    grade: gradeRating(total),
    algorithmName: stats.algorithmName || game.aiAlgorithm,
    parts: {
      score: Math.round(scorePart),
      survival: Math.round(survivalPart),
      efficiency: Math.round(efficiencyPart),
      safety: Math.round(safetyPart),
      stability: Math.round(stabilityPart),
    },
  };
}

function calculateSurvivalPart(game, stats) {
  const stepPart = clamp((stats.stepsSurvived / 2500) * 70);
  const lengthPart = clamp(((game.snake.length - 3) / 100) * 25);
  const deathPenalty = stats.deathReason ? 15 : 0;
  return clamp(stepPart + lengthPart + 5 - deathPenalty);
}

function calculateEfficiencyPart(stats) {
  if (stats.stepsSurvived <= 0) {
    return 0;
  }

  const foodsPerHundredSteps = (stats.foodsEaten / stats.stepsSurvived) * 100;
  return clamp((foodsPerHundredSteps / 5) * 100);
}

function calculateSafetyPart(stats) {
  if (stats.stepsSurvived <= 0) {
    return 0;
  }

  const dangerRatio = stats.dangerTicks / stats.stepsSurvived;
  return clamp(100 - dangerRatio * 250);
}

function calculateStabilityPart(stats) {
  if (stats.longestNoFoodStreak <= 60) {
    return 100;
  }

  return clamp(100 - ((stats.longestNoFoodStreak - 60) / 240) * 100);
}

function gradeRating(total) {
  if (total >= 90) {
    return "S";
  }

  if (total >= 75) {
    return "A";
  }

  if (total >= 60) {
    return "B";
  }

  if (total >= 40) {
    return "C";
  }

  return "D";
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
