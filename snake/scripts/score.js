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
    tightTicks: 0,
    legalMoveTotal: 0,
    longestNoFoodStreak: 0,
    currentNoFoodStreak: 0,
    totalFoodIntervalSteps: 0,
    deathReason: "",
    algorithmName: "lookahead",
    scoreAtStart: 0,
  };
}

export function calculateAiRating(game) {
  const stats = game.aiStats;
  const baseScore = config.difficulties[game.difficulty].score;
  const scoreDelta = Math.max(0, game.score - (stats.scoreAtStart || 0));
  const scorePart = calculateScorePart(scoreDelta, baseScore);
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

function calculateScorePart(scoreDelta, baseScore) {
  const scoreUnits = baseScore > 0 ? scoreDelta / baseScore : 0;
  return softCap(scoreUnits, 180);
}

function calculateSurvivalPart(game, stats) {
  const stepPart = softCap(stats.stepsSurvived, 1800) * 0.75;
  const lengthPart = softCap(Math.max(0, game.snake.length - 3), 80) * 0.25;
  return clamp(stepPart + lengthPart - deathPenalty(stats.deathReason));
}

function calculateEfficiencyPart(stats) {
  if (stats.stepsSurvived <= 0) {
    return 0;
  }

  const foodsPerHundredSteps = (stats.foodsEaten / stats.stepsSurvived) * 100;
  return softCap(foodsPerHundredSteps, 4);
}

function calculateSafetyPart(stats) {
  if (stats.stepsSurvived <= 0) {
    return 0;
  }

  const dangerRatio = stats.dangerTicks / stats.stepsSurvived;
  const tightRatio = (stats.tightTicks || 0) / stats.stepsSurvived;
  const averageLegalMoves = (stats.legalMoveTotal || 0) / stats.stepsSurvived;
  const legalMovePart = clamp(((averageLegalMoves - 1) / 2) * 100);
  return clamp(100 - dangerRatio * 360 - tightRatio * 85 + legalMovePart * 0.18);
}

function calculateStabilityPart(stats) {
  if (stats.foodsEaten <= 0) {
    return 0;
  }

  const averageFoodInterval = (stats.totalFoodIntervalSteps || stats.stepsSurvived) / stats.foodsEaten;
  const averageIntervalPart = 100 * Math.exp(-Math.max(0, averageFoodInterval - 20) / 95);
  const longestStreakPart = 100 * Math.exp(-Math.max(0, stats.longestNoFoodStreak - 45) / 150);
  return clamp(averageIntervalPart * 0.7 + longestStreakPart * 0.3);
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

function softCap(value, scale) {
  if (value <= 0) {
    return 0;
  }

  return clamp(100 * (1 - Math.exp(-value / scale)));
}

function deathPenalty(reason) {
  if (reason === "snake") {
    return 18;
  }

  if (reason === "wall") {
    return 12;
  }

  return reason ? 15 : 0;
}
