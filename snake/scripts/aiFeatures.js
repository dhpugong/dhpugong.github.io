import {
  closestFood,
  countReachableCells,
  directionTowardFoodScore,
  distanceToFood,
  findPath,
  getLegalMoves,
  samePoint,
  solidWallPressure,
} from "./aiShared.js";

export function createNeuralFeatures(state, nextState, candidate) {
  return createCandidateEvaluation(state, nextState, candidate).features;
}

export function estimateImmediateReward(state, nextState, candidate) {
  return createCandidateEvaluation(state, nextState, candidate).immediateReward;
}

export function createCandidateEvaluation(state, nextState, candidate) {
  const head = state.snake[0];
  const nextHead = nextState.snake[0];
  const food = closestFood(state);
  const nextFood = closestFood(nextState) || food;
  const maxDistance = state.tileCount * 2;
  const currentFoodDistance = food ? distanceToFood(head, food, state) : maxDistance;
  const nextFoodDistance = nextFood ? distanceToFood(nextHead, nextFood, nextState) : maxDistance;
  const futureMoves = getLegalMoves(nextState);
  const futureMoveCount = futureMoves.length;
  const reachable = countReachableCells(nextState, nextHead);
  const reachableRatio = reachable / (state.tileCount * state.tileCount);
  const tail = nextState.snake[nextState.snake.length - 1];
  const canReachTail = tail ? findPath(nextState, tail, { allowTargetTail: true }).length > 0 : true;
  const willEat = state.foods.some((foodItem) => samePoint(foodItem, candidate.nextPoint));
  const pathToFood = food && !willEat ? findPath(nextState, food) : [];
  const canReachFood = !food || willEat || pathToFood.length > 0;
  const foodPathDistance = pathToFood.length > 0 ? pathToFood.length : willEat ? 0 : nextFoodDistance + 8;
  const wallPressure = state.wallMode === "solid" ? solidWallPressure(candidate.nextPoint, state) / 48 : 0;
  const forwardAlignment = food ? directionTowardFoodScore(candidate.direction, head, food, state) : 0;
  const foodProgress = (currentFoodDistance - nextFoodDistance) / maxDistance;
  const bodyRatio = state.snake.length / (state.tileCount * state.tileCount);
  const crampedPenalty = reachable < state.snake.length * 2 ? 2.8 : 0;
  const deadEndPenalty = futureMoveCount <= 1 ? 4.2 : futureMoveCount === 2 ? 0.9 : 0;
  const immediateReward = (willEat ? 4.8 : 0) +
    (currentFoodDistance - nextFoodDistance) * 0.28 +
    futureMoveCount * 0.58 +
    reachableRatio * 7.5 +
    (canReachTail ? 1.8 : -4.2) +
    (canReachFood ? 1.0 : -2.5) -
    foodPathDistance * 0.04 -
    bodyRatio * 1.2 -
    crampedPenalty -
    deadEndPenalty -
    wallPressure * 2.4 -
    0.08;

  const features = [
    clamp01((foodProgress + 1) / 2),
    clamp01(1 - nextFoodDistance / maxDistance),
    clamp01(reachableRatio),
    clamp01(futureMoveCount / 3),
    canReachTail ? 1 : 0,
    willEat ? 1 : 0,
    clamp01(wallPressure),
    clamp01((forwardAlignment + 1) / 2),
    clamp01(1 - bodyRatio),
    state.wallMode === "wrap" ? 1 : 0,
    1,
  ];

  return {
    features,
    futureMoves,
    immediateReward,
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
