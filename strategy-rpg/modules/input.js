import { CONFIG } from "./config.js";
import { rectContains } from "./utils.js";

// 输入模块统一收集键盘、鼠标和 UI 点击，不把 DOM 事件散落到业务模块。
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    textEvents: [],
    mouse: { x: 0, y: 0, down: false, clicked: false, worldClick: null },
    lastAction: null
  };

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const code = event.code.toLowerCase();
    input.keys.add(key);
    input.keys.add(code);
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      input.textEvents.push({ type: "char", value: event.key });
    } else if (key === "backspace") {
      input.textEvents.push({ type: "backspace" });
      event.preventDefault();
    } else if (key === "enter") {
      input.textEvents.push({ type: "enter" });
    } else if (key === "escape") {
      input.textEvents.push({ type: "escape" });
    }
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright", "keyw", "keya", "keys", "keyd"].includes(key) || ["space", "arrowup", "arrowdown", "arrowleft", "arrowright", "keyw", "keya", "keys", "keyd"].includes(code)) {
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    input.keys.delete(event.key.toLowerCase());
    input.keys.delete(event.code.toLowerCase());
  });

  canvas.addEventListener("mousemove", (event) => {
    const pos = getCanvasPoint(canvas, event);
    input.mouse.x = pos.x;
    input.mouse.y = pos.y;
  });

  canvas.addEventListener("mousedown", (event) => {
    const pos = getCanvasPoint(canvas, event);
    input.mouse.x = pos.x;
    input.mouse.y = pos.y;
    input.mouse.down = true;
  });

  window.addEventListener("mouseup", () => {
    input.mouse.down = false;
  });

  canvas.addEventListener("click", (event) => {
    const pos = getCanvasPoint(canvas, event);
    input.mouse.x = pos.x;
    input.mouse.y = pos.y;
    input.mouse.clicked = true;
  });

  return input;
}

export function getMovementVector(input) {
  let dx = 0;
  let dy = 0;
  if (input.keys.has("w") || input.keys.has("keyw") || input.keys.has("arrowup")) dy -= 1;
  if (input.keys.has("s") || input.keys.has("keys") || input.keys.has("arrowdown")) dy += 1;
  if (input.keys.has("a") || input.keys.has("keya") || input.keys.has("arrowleft")) dx -= 1;
  if (input.keys.has("d") || input.keys.has("keyd") || input.keys.has("arrowright")) dx += 1;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }
  return { dx, dy };
}

export function consumeClick(input) {
  if (!input.mouse.clicked) {
    return null;
  }
  input.mouse.clicked = false;
  return { x: input.mouse.x, y: input.mouse.y };
}

export function consumeTextInput(input) {
  if (!input.textEvents.length) {
    return [];
  }
  const events = input.textEvents.slice();
  input.textEvents.length = 0;
  return events;
}

export function consumeKey(input, key) {
  const lower = key.toLowerCase();
  if (input.keys.has(lower)) {
    input.keys.delete(lower);
    return true;
  }
  return false;
}

export function hitButton(buttons, point) {
  if (!point) {
    return null;
  }
  return buttons.find((button) => !button.disabled && rectContains(button, point.x, point.y)) || null;
}

function getCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * CONFIG.canvasWidth,
    y: ((event.clientY - rect.top) / rect.height) * CONFIG.canvasHeight
  };
}
