export const directionOrder = ["up", "right", "down", "left"];

export const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function getLegalMoves(state) {
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

export function findPath(state, target, options = {}) {
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

export function stepState(state, directionNameValue) {
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

export function countReachableCells(state, start) {
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

export function closestFood(state) {
  const head = state.snake[0];

  if (!head || state.foods.length === 0) {
    return undefined;
  }

  return [...state.foods]
    .sort((a, b) => distanceToFood(head, a, state) - distanceToFood(head, b, state))[0];
}

export function solidWallPressure(point, state) {
  const edgeDistance = Math.min(
    point.x,
    point.y,
    state.tileCount - 1 - point.x,
    state.tileCount - 1 - point.y,
  );

  return Math.max(0, 2 - edgeDistance) * 24;
}

export function distanceToFood(point, food, state) {
  if (state.wallMode !== "wrap") {
    return Math.abs(point.x - food.x) + Math.abs(point.y - food.y);
  }

  const dx = Math.abs(point.x - food.x);
  const dy = Math.abs(point.y - food.y);
  return Math.min(dx, state.tileCount - dx) + Math.min(dy, state.tileCount - dy);
}

export function directionTowardFoodScore(direction, head, food, state) {
  const delta = shortestDelta(head, food, state);
  const distance = Math.abs(delta.x) + Math.abs(delta.y);

  if (distance === 0) {
    return 0;
  }

  return (direction.x * delta.x + direction.y * delta.y) / distance;
}

export function directionName(direction) {
  return Object.entries(directions).find(([, value]) => samePoint(value, direction))?.[0];
}

export function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

function getBlockedCells(state, options = {}) {
  const body = options.allowTail ? state.snake.slice(1, -1) : state.snake.slice(1);
  const blocked = new Set(body.map(pointKey));

  if (options.allowTargetTail && options.target) {
    blocked.delete(pointKey(options.target));
  }

  return blocked;
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

function isReverse(nextDirection, currentDirection) {
  return nextDirection.x + currentDirection.x === 0 && nextDirection.y + currentDirection.y === 0;
}

function isWallCollision(point, tileCount) {
  return point.x < 0 || point.x >= tileCount || point.y < 0 || point.y >= tileCount;
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
