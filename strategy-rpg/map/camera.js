import { CONFIG } from "../modules/config.js";
import { clamp, lerp } from "../modules/utils.js";

export function createMapCamera() {
  return {
    x: 0,
    y: 0,
    width: CONFIG.canvasWidth,
    height: CONFIG.canvasHeight,
    shake: 0,
    locked: false
  };
}

export function updateMapCamera(camera, target, map) {
  if (!camera.locked && target) {
    const wantedX = target.x - camera.width / 2;
    const wantedY = target.y - camera.height / 2;
    camera.x = lerp(camera.x, wantedX, CONFIG.cameraLerp);
    camera.y = lerp(camera.y, wantedY, CONFIG.cameraLerp);
  }
  clampCamera(camera, map);
  camera.shake = Math.max(0, camera.shake - 0.9);
}

export function focusCameraOn(camera, x, y, map, immediate = false) {
  const wantedX = x - camera.width / 2;
  const wantedY = y - camera.height / 2;
  if (immediate) {
    camera.x = wantedX;
    camera.y = wantedY;
  } else {
    camera.x = lerp(camera.x, wantedX, 0.55);
    camera.y = lerp(camera.y, wantedY, 0.55);
  }
  clampCamera(camera, map);
}

export function panCameraTo(camera, x, y, map) {
  camera.locked = true;
  focusCameraOn(camera, x, y, map, true);
}

export function releaseCamera(camera) {
  camera.locked = false;
}

export function clampCamera(camera, map) {
  camera.x = clamp(camera.x, 0, Math.max(0, map.width - camera.width));
  camera.y = clamp(camera.y, 0, Math.max(0, map.height - camera.height));
}

export function worldToScreen(camera, x, y) {
  return {
    x: Math.round(x - camera.x),
    y: Math.round(y - camera.y)
  };
}

export function screenToWorld(camera, x, y) {
  return {
    x: x + camera.x,
    y: y + camera.y
  };
}
