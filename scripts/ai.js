export const aiAlgorithms = {
  greedy: chooseGreedyDirection,
  bfs: chooseBfsDirection,
  lookahead: chooseLookaheadDirection,
  neural: chooseNeuralDirection,
};

const directionOrder = ["up", "right", "down", "left"];

const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const neuralWeights = {
  hidden: [
    [1.7, -0.3, 2.1, 0.9, 1.4, 0.7, -1.8, 1.6, 0.8, -0.4, -0.2],
    [-0.8, 2.0, 1.4, 1.6, -0.2, 1.8, -1.2, 0.7, 1.3, 0.5, -0.1],
    [1.2, 1.1, -0.9, 1.8, 2.0, -0.6, -1.5, 1.1, -0.4, 1.3, 0.2],
    [0.4, -1.4, 2.4, -0.8, 0.8, 2.1, -2.0, 1.5, 1.6, -0.2, 0.1],
    [2.0, 0.5, 0.7, 1.3, -1.2, 1.4, -0.9, 0.8, 1.8, 0.7, -0.3],
    [-1.0, 1.6, 0.5, 2.2, 1.6, -0.8, -1.4, 1.2, 0.2, 1.7, 0.4],
  ],
  output: [1.5, 1.2, 1.35, 1.1, 1.25, 1.15, -0.45],
};

export function chooseDirection(state, algorithmName = "lookahead") {
  const algorithm = aiAlgorithms[algorithmName] || aiAlgorithms.lookahead;
  return algorithm(state);
}

export function countLegalMoves(state) {
  return getLegalMoves(state).length;
}

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

function getLegalMoves(state) {
  const head = state.snake[0];

  if (!head) {
    return [];
  }

  return directionOrder
    .map((name) => ({
      name,
      direction: directions[name],
      nextPoint: normalizePoint({
        x: head.x + directions[name].x,
        y: head.y + directions[name].y,
      }, state),
    }))
    .filter((candidate) => !isReverse(candidate.direction, state.direction))
    .filter((candidate) => candidate.nextPoint && !willHitSnake(candidate.nextPoint, state));
}

function findPath(state, target, options = {}) {
  const start = state.snake[0];

  if (!start || !target) {
    return [];
  }

  if (samePoint(start, target)) {
    return [];
  }

  const startKey = pointKey(start);
  const queue = [start];
  const visited = new Set([startKey]);
  const previous = new Map();
  let queueIndex = 0;
  const blocked = getBlockedCells(state, {
    allowTail: true,
    allowTargetTail: options.allowTargetTail,
    target,
  });

  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    const currentKey = pointKey(current);
    const isFirstStep = currentKey === startKey;
    queueIndex += 1;

    for (const name of directionOrder) {
      const direction = directions[name];

      if (isFirstStep && isReverse(direction, state.direction)) {
        continue;
      }

      const nextPoint = normalizePoint({
        x: current.x + direction.x,
        y: current.y + direction.y,
      }, state);

      if (!nextPoint) {
        continue;
      }

      const key = pointKey(nextPoint);

      if (visited.has(key) || blocked.has(key)) {
        continue;
      }

      previous.set(key, { previousKey: currentKey, move: name });

      if (samePoint(nextPoint, target)) {
        return buildPath(previous, startKey, key);
      }

      visited.add(key);
      queue.push(nextPoint);
    }
  }

  return [];
}

function stepState(state, directionNameValue) {
  const direction = directions[directionNameValue];
  const head = state.snake[0];

  if (!direction || !head || isReverse(direction, state.direction)) {
    return undefined;
  }

  const nextPoint = normalizePoint({
    x: head.x + direction.x,
    y: head.y + direction.y,
  }, state);

  if (!nextPoint || willHitSnake(nextPoint, state)) {
    return undefined;
  }

  const willEat = state.foods.some((food) => samePoint(food, nextPoint));
  const nextSnake = [nextPoint, ...state.snake];

  if (!willEat) {
    nextSnake.pop();
  }

  return {
    ...state,
    snake: nextSnake,
    foods: willEat ? state.foods.filter((food) => !samePoint(food, nextPoint)) : state.foods,
    direction,
  };
}

function countReachableCells(state, start) {
  if (!start) {
    return 0;
  }

  const queue = [start];
  const visited = new Set([pointKey(start)]);
  const blocked = getBlockedCells(state, { allowTail: true });
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const point = queue[queueIndex];
    queueIndex += 1;

    for (const direction of Object.values(directions)) {
      const nextPoint = normalizePoint({
        x: point.x + direction.x,
        y: point.y + direction.y,
      }, state);

      if (!nextPoint) {
        continue;
      }

      const key = pointKey(nextPoint);

      if (visited.has(key) || blocked.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push(nextPoint);
    }
  }

  return visited.size;
}

function evaluateNeuralCandidate(state, candidate) {
  const nextState = stepState(state, candidate.name);

  if (!nextState) {
    return Number.NEGATIVE_INFINITY;
  }

  const features = createNeuralFeatures(state, nextState, candidate);
  const hidden = neuralWeights.hidden.map((weights) => activate(dot(weights, features)));
  return dot(neuralWeights.output, [...hidden, 1]);
}

function createNeuralFeatures(state, nextState, candidate) {
  const head = state.snake[0];
  const nextHead = nextState.snake[0];
  const food = closestFood(state);
  const nextFood = closestFood(nextState) || food;
  const maxDistance = state.tileCount * 2;
  const currentFoodDistance = food ? distanceToFood(head, food, state) : maxDistance;
  const nextFoodDistance = nextFood ? distanceToFood(nextHead, nextFood, nextState) : maxDistance;
  const reachableRatio = countReachableCells(nextState, nextHead) / (state.tileCount * state.tileCount);
  const futureMoveRatio = getLegalMoves(nextState).length / 3;
  const tail = nextState.snake[nextState.snake.length - 1];
  const canReachTail = tail ? findPath(nextState, tail, { allowTargetTail: true }).length > 0 : true;
  const willEat = state.foods.some((foodItem) => samePoint(foodItem, candidate.nextPoint));
  const wallPressure = state.wallMode === "solid" ? solidWallPressure(candidate.nextPoint, state) / 48 : 0;
  const forwardAlignment = food ? directionTowardFoodScore(candidate.direction, head, food, state) : 0;
  const foodProgress = (currentFoodDistance - nextFoodDistance) / maxDistance;
  const bodyRatio = state.snake.length / (state.tileCount * state.tileCount);

  return [
    clamp01((foodProgress + 1) / 2),
    clamp01(1 - nextFoodDistance / maxDistance),
    clamp01(reachableRatio),
    clamp01(futureMoveRatio),
    canReachTail ? 1 : 0,
    willEat ? 1 : 0,
    clamp01(wallPressure),
    clamp01((forwardAlignment + 1) / 2),
    clamp01(1 - bodyRatio),
    state.wallMode === "wrap" ? 1 : 0,
    1,
  ];
}

function directionTowardFoodScore(direction, head, food, state) {
  const delta = shortestDelta(head, food, state);
  const distance = Math.abs(delta.x) + Math.abs(delta.y);

  if (distance === 0) {
    return 0;
  }

  return (direction.x * delta.x + direction.y * delta.y) / distance;
}

function shortestDelta(from, to, state) {
  if (state.wallMode !== "wrap") {
    return {
      x: to.x - from.x,
      y: to.y - from.y,
    };
  }

  return {
    x: wrappedDelta(to.x - from.x, state.tileCount),
    y: wrappedDelta(to.y - from.y, state.tileCount),
  };
}

function wrappedDelta(delta, tileCount) {
  if (Math.abs(delta) <= tileCount / 2) {
    return delta;
  }

  return delta > 0 ? delta - tileCount : delta + tileCount;
}

function dot(weights, values) {
  return weights.reduce((sum, weight, index) => sum + weight * values[index], 0);
}

function activate(value) {
  return Math.tanh(value);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function getBlockedCells(state, options = {}) {
  const body = options.allowTail ? state.snake.slice(1, -1) : state.snake.slice(1);
  const blocked = new Set(body.map(pointKey));

  if (options.allowTargetTail && options.target) {
    blocked.delete(pointKey(options.target));
  }

  return blocked;
}

function closestFood(state) {
  const head = state.snake[0];

  if (!head || state.foods.length === 0) {
    return undefined;
  }

  return [...state.foods]
    .sort((a, b) => distanceToFood(head, a, state) - distanceToFood(head, b, state))[0];
}

function solidWallPressure(point, state) {
  const edgeDistance = Math.min(
    point.x,
    point.y,
    state.tileCount - 1 - point.x,
    state.tileCount - 1 - point.y,
  );

  return Math.max(0, 2 - edgeDistance) * 24;
}

function normalizePoint(point, state) {
  if (state.wallMode === "solid" && isWallCollision(point, state.tileCount)) {
    return undefined;
  }

  if (state.wallMode === "wrap") {
    return {
      x: (point.x + state.tileCount) % state.tileCount,
      y: (point.y + state.tileCount) % state.tileCount,
    };
  }

  return point;
}

function willHitSnake(point, state) {
  const willEat = state.foods.some((food) => samePoint(food, point));
  const body = willEat ? state.snake : state.snake.slice(0, -1);
  return body.some((segment) => samePoint(segment, point));
}

function distanceToFood(point, food, state) {
  if (state.wallMode !== "wrap") {
    return Math.abs(point.x - food.x) + Math.abs(point.y - food.y);
  }

  const dx = Math.abs(point.x - food.x);
  const dy = Math.abs(point.y - food.y);
  return Math.min(dx, state.tileCount - dx) + Math.min(dy, state.tileCount - dy);
}

function isReverse(nextDirection, currentDirection) {
  return nextDirection.x + currentDirection.x === 0 && nextDirection.y + currentDirection.y === 0;
}

function isWallCollision(point, tileCount) {
  return point.x < 0 || point.x >= tileCount || point.y < 0 || point.y >= tileCount;
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

function directionName(direction) {
  return Object.entries(directions).find(([, value]) => samePoint(value, direction))?.[0];
}

function pointKey(point) {
  return `${point.x},${point.y}`;
}

function buildPath(previous, startKey, endKey) {
  const path = [];
  let key = endKey;

  while (key !== startKey) {
    const step = previous.get(key);

    if (!step) {
      return [];
    }

    path.push(step.move);
    key = step.previousKey;
  }

  return path.reverse();
}
