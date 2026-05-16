import { CONFIG } from "./config.js";
import { clamp, lerp } from "./utils.js";

// 摄像机只负责世界坐标与屏幕坐标转换，并平滑跟随主角。
export function createCamera() {
  return {
    x: 0,
    y: 0,
    width: CONFIG.canvasWidth,
    height: CONFIG.canvasHeight,
    shake: 0
  };
}

export function updateCamera(camera, target, map) {
  const wantedX = target.x - camera.width / 2;
  const wantedY = target.y - camera.height / 2;
  camera.x = lerp(camera.x, wantedX, CONFIG.cameraLerp);
  camera.y = lerp(camera.y, wantedY, CONFIG.cameraLerp);
  camera.x = clamp(camera.x, 0, Math.max(0, map.width - camera.width));
  camera.y = clamp(camera.y, 0, Math.max(0, map.height - camera.height));
  camera.shake = Math.max(0, camera.shake - 0.9);
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
