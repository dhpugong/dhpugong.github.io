import { CONFIG } from "./config.js";

const MIN_DPR = 1;
const MAX_DPR = 3;
const FRAME_MARGIN = 24;
const SCALE_SNAP_EPSILON = 0.04;

export function createDisplay(canvas) {
  const display = {
    canvas,
    baseWidth: CONFIG.canvasWidth,
    baseHeight: CONFIG.canvasHeight,
    cssWidth: CONFIG.canvasWidth,
    cssHeight: CONFIG.canvasHeight,
    backingWidth: CONFIG.canvasWidth,
    backingHeight: CONFIG.canvasHeight,
    dpr: 1,
    scale: 1,
    mapScale: 1,
    uiScale: 1
  };
  updateDisplay(display);
  return display;
}

export function updateDisplay(display) {
  const viewportWidth = Math.max(1, window.innerWidth || display.baseWidth);
  const viewportHeight = Math.max(1, window.innerHeight || display.baseHeight);
  const margin = document.fullscreenElement ? 0 : FRAME_MARGIN;
  const availableWidth = Math.max(320, viewportWidth - margin);
  const availableHeight = Math.max(180, viewportHeight - margin);
  const rawScale = Math.min(availableWidth / display.baseWidth, availableHeight / display.baseHeight);
  const scale = snapScale(rawScale);
  const dpr = clamp(window.devicePixelRatio || 1, MIN_DPR, MAX_DPR);

  display.dpr = dpr;
  display.scale = scale;
  display.mapScale = scale;
  display.uiScale = scale;
  display.cssWidth = Math.max(1, Math.round(display.baseWidth * scale));
  display.cssHeight = Math.max(1, Math.round(display.baseHeight * scale));
  display.backingWidth = Math.max(1, Math.round(display.cssWidth * dpr));
  display.backingHeight = Math.max(1, Math.round(display.cssHeight * dpr));

  applyCanvasSize(display);
  return display;
}

export function prepareFrame(ctx, display) {
  ctx.setTransform(display.dpr * display.scale, 0, 0, display.dpr * display.scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, display.baseWidth, display.baseHeight);
}

export function canvasPointToGame(display, event) {
  const rect = display.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * display.baseWidth,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * display.baseHeight
  };
}

function applyCanvasSize(display) {
  const canvas = display.canvas;
  canvas.style.width = `${display.cssWidth}px`;
  canvas.style.height = `${display.cssHeight}px`;
  if (canvas.width !== display.backingWidth) {
    canvas.width = display.backingWidth;
  }
  if (canvas.height !== display.backingHeight) {
    canvas.height = display.backingHeight;
  }
  canvas.dataset.dpr = display.dpr.toFixed(2);
  canvas.dataset.uiScale = display.uiScale.toFixed(4);
}

function snapScale(scale) {
  const rounded = Math.round(scale);
  if (rounded >= 1 && Math.abs(scale - rounded) <= SCALE_SNAP_EPSILON) {
    return rounded;
  }
  return Math.max(0.5, scale);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
