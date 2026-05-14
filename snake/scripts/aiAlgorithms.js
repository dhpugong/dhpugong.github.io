import { createCandidateEvaluation, createNeuralFeatures } from "./aiFeatures.js";
import { neuralWeights, reinforcementWeights, runNetwork } from "./aiNetworks.js";
import {
  closestFood,
  countReachableCells,
  directionName,
  directionOrder,
  distanceToFood,
  findPath,
  getLegalMoves,
  samePoint,
  solidWallPressure,
  stepState,
} from "./aiShared.js";

export const aiAlgorithms = {
  greedy: chooseGreedyDirection,
  bfs: chooseBfsDirection,
  lookahead: chooseLookaheadDirection,
  safe: chooseSafePathDirection,
  neural: chooseNeuralDirection,
  reinforcement: chooseReinforcementLearningDirection,
};

const reinforcementLookaheadDepth = 1;
const reinforcementDiscount = 0.78;
const learnedValueMix = 0.35;

function chooseGreedyDirection(state) {
  const candidates = getLegalMoves(state);
  const food = closestFood(state);

  if (candidates.length === 0) {
    return directionName(state.direction) || "right";
  }

  if (!food) {
    return candidates[0].name;
  }

  return candidates
    .map((candidate) => ({
      ...candidate,
      distance: distanceToFood(candidate.nextPoint, food, state),
    }))
    .sort((a, b) => a.distance - b.distance || directionOrder.indexOf(a.name) - directionOrder.indexOf(b.name))[0].name;
}

function chooseBfsDirection(state) {
  const food = closestFood(state);
  const pathToFood = food ? findPath(state, food) : [];

  if (pathToFood.length > 0) {
    return pathToFood[0];
  }

  return getLegalMoves(state)[0]?.name || directionName(state.direction) || "right";
}

function chooseLookaheadDirection(state) {
  const candidates = getLegalMoves(state);

  if (candidates.length === 0) {
    return directionName(state.direction) || "right";
  }

  return candidates
    .map((candidate) => {
      const nextState = stepState(state, candidate.name);

      if (!nextState) {
        return { name: candidate.name, score: Number.NEGATIVE_INFINITY };
      }

      const food = closestFood(nextState);
      const foodDistance = food ? distanceToFood(nextState.snake[0], food, nextState) : 0;
      const reachable = countReachableCells(nextState, nextState.snake[0]);
      const futureMoves = getLegalMoves(nextState).length;
      const tail = nextState.snake[nextState.snake.length - 1];
      const canReachTail = tail ? findPath(nextState, tail, { allowTargetTail: true }).length > 0 : true;
      const willEat = state.foods.some((foodItem) => samePoint(foodItem, candidate.nextPoint));
      const wallPenalty = state.wallMode === "solid" ? solidWallPressure(candidate.nextPoint, state) : 0;
      const dangerPenalty = futureMoves <= 1 ? 500 : 0;
      const tailPenalty = canReachTail ? 0 : 350;
      const pathToFood = food ? findPath(nextState, food) : [];
      const foodPathDistance = pathToFood.length > 0 ? pathToFood.length : foodDistance + 12;
      const foodBonus = willEat ? 260 : 0;
      const score = foodBonus +
        reachable * 4 +
        futureMoves * 70 +
        (canReachTail ? 220 : 0) -
        foodDistance * 12 -
        foodPathDistance * 18 -
        wallPenalty -
        dangerPenalty -
        tailPenalty;

      return { name: candidate.name, score };
    })
    .sort((a, b) => b.score - a.score || directionOrder.indexOf(a.name) - directionOrder.indexOf(b.name))[0].name;
}

function chooseSafePathDirection(state) {
  const candidates = getLegalMoves(state);

  if (candidates.length === 0) {
    return directionName(state.direction) || "right";
  }

  const food = closestFood(state);
  const pathToFood = food ? findPath(state, food) : [];
  const foodPathState = pathToFood.length > 0 ? stepThroughPath(state, pathToFood) : undefined;

  if (foodPathState && canReachTail(foodPathState)) {
    return pathToFood[0];
  }

  const tail = state.snake[state.snake.length - 1];
  const pathToTail = tail ? findPath(state, tail, { allowTargetTail: true }) : [];

  if (pathToTail.length > 0) {
    return pathToTail[0];
  }

  return candidates
    .map((candidate) => {
      const nextState = stepState(state, candidate.name);
      return {
        name: candidate.name,
        space: nextState ? countReachableCells(nextState, nextState.snake[0]) : -1,
      };
    })
    .sort((a, b) => b.space - a.space || directionOrder.indexOf(a.name) - directionOrder.indexOf(b.name))[0].name;
}

function chooseNeuralDirection(state) {
  const candidates = getLegalMoves(state);

  if (candidates.length === 0) {
    return directionName(state.direction) || "right";
  }

  return candidates
    .map((candidate) => ({
      name: candidate.name,
      score: evaluateNeuralCandidate(state, candidate),
    }))
    .sort((a, b) => b.score - a.score || directionOrder.indexOf(a.name) - directionOrder.indexOf(b.name))[0].name;
}

function chooseReinforcementLearningDirection(state) {
  const candidates = getLegalMoves(state);

  if (candidates.length === 0) {
    return directionName(state.direction) || "right";
  }

  const cache = new Map();

  return candidates
    .map((candidate) => ({
      name: candidate.name,
      score: evaluateReinforcementCandidate(state, candidate, reinforcementLookaheadDepth, cache),
    }))
    .sort((a, b) => b.score - a.score || directionOrder.indexOf(a.name) - directionOrder.indexOf(b.name))[0].name;
}

function evaluateNeuralCandidate(state, candidate) {
  const nextState = stepState(state, candidate.name);

  if (!nextState) {
    return Number.NEGATIVE_INFINITY;
  }

  const features = createNeuralFeatures(state, nextState, candidate);
  return runNetwork(neuralWeights, features);
}

function stepThroughPath(state, path) {
  return path.reduce((currentState, direction) => {
    if (!currentState) {
      return undefined;
    }

    return stepState(currentState, direction);
  }, state);
}

function canReachTail(state) {
  const tail = state.snake[state.snake.length - 1];
  return tail ? findPath(state, tail, { allowTargetTail: true }).length > 0 : true;
}

function evaluateReinforcementCandidate(state, candidate, depth, cache) {
  const nextState = stepState(state, candidate.name);

  if (!nextState) {
    return Number.NEGATIVE_INFINITY;
  }

  const cacheKey = `${depth}|${candidate.name}|${stateKey(state)}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const evaluation = createCandidateEvaluation(state, nextState, candidate);
  const learnedValue = runNetwork(reinforcementWeights, evaluation.features);

  if (depth <= 0) {
    const value = evaluation.immediateReward + learnedValue * reinforcementDiscount;
    cache.set(cacheKey, value);
    return value;
  }

  if (evaluation.futureMoves.length === 0) {
    const value = evaluation.immediateReward - 9;
    cache.set(cacheKey, value);
    return value;
  }

  const rolloutValue = Math.max(
    ...evaluation.futureMoves.map((futureMove) => evaluateReinforcementCandidate(nextState, futureMove, depth - 1, cache)),
  );
  const blendedFutureValue = rolloutValue * (1 - learnedValueMix) + learnedValue * learnedValueMix;
  const value = evaluation.immediateReward + reinforcementDiscount * blendedFutureValue;

  cache.set(cacheKey, value);
  return value;
}

function stateKey(state) {
  const head = state.snake[0];
  return [
    head?.x,
    head?.y,
    state.direction.x,
    state.direction.y,
    state.foods.map((food) => `${food.x},${food.y}`).join(";"),
    state.snake.map((segment) => `${segment.x},${segment.y}`).join(";"),
    state.wallMode,
  ].join("|");
}
