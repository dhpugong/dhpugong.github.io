import {
  createMapCamera,
  screenToWorld,
  updateMapCamera,
  worldToScreen
} from "../map/camera.js";

// 摄像机只负责世界坐标与屏幕坐标转换，并平滑跟随主角。
export function createCamera() {
  return createMapCamera();
}

export function updateCamera(camera, target, map) {
  updateMapCamera(camera, target, map);
}

export { screenToWorld, worldToScreen };
