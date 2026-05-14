import { config } from "./config.js";
import { createAiStats } from "./score.js";

export const tileCount = config.boardSize / config.gridSize;

export function resetRound(game) {
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
  game.eatenCount = 0;
  game.aiStats = createAiStats();
  game.aiStats.algorithmName = game.aiAlgorithm;
  game.aiRating = undefined;
  game.tickMs = getBaseTick(game);
  game.state = "ready";
  game.foods = [createNextFood(game)];
}

export function createNextFood(game) {
  const shouldCreateBonus = game.eatenCount > 0 && (Math.random() < 0.22 || game.eatenCount % 6 === 0);
  return createFood(game, shouldCreateBonus ? "bonus" : "normal");
}

export function createFood(game, type) {
  const variants = {
    normal: { type: "normal", color: "#ffd166", pulse: Math.random() * Math.PI * 2 },
    bonus: { type: "bonus", color: "#b48cff", pulse: Math.random() * Math.PI * 2 },
  };

  return {
    ...variants[type],
    ...createEmptyPoint(game),
  };
}

export function createEmptyPoint(game) {
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

export function getFoodPoints(game, food) {
  const base = config.difficulties[game.difficulty].score;
  return food.type === "bonus" ? base * 3 : base;
}

export function getBaseTick(game) {
  return config.difficulties[game.difficulty].baseTick;
}

export function getLevelTick(game) {
  const speedMultiplier = 1 + (game.level - 1) * 0.1;
  return getBaseTick(game) / speedMultiplier;
}

export function getSkin(game) {
  return config.skins[game.skinName] || config.skins.bamboo;
}

export function getStartMessage(game) {
  return game.wallMode === "solid" ? "开始！小心边界，撞墙会结束。" : "开始！撞墙会从对面出来。";
}

export function wrapPoint(point) {
  return {
    x: (point.x + tileCount) % tileCount,
    y: (point.y + tileCount) % tileCount,
  };
}

export function isWallCollision(point) {
  return point.x < 0 || point.x >= tileCount || point.y < 0 || point.y >= tileCount;
}

export function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

export function isSnakeCollision(game, point, includeTail) {
  const body = includeTail ? game.snake : game.snake.slice(0, -1);
  return body.some((segment) => samePoint(segment, point));
}

export function spawnParticles(game, point, color, amount) {
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

export function updateParticles(game) {
  game.particles = game.particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx,
      y: particle.y + particle.vy,
      life: particle.life - 0.16,
    }))
    .filter((particle) => particle.life > 0);
}

export function createAiSnapshot(game) {
  return {
    snake: game.snake.map((segment) => ({ ...segment })),
    foods: game.foods.map((food) => ({ ...food })),
    direction: { ...game.direction },
    wallMode: game.wallMode,
    tileCount,
  };
}
