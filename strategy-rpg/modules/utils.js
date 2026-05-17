// 通用工具函数：游戏内所有模块共享，避免重复实现数学和数据处理。
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceXY(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function normalize(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len <= 0.0001) {
    return { x: 0, y: 0 };
  }
  return { x: dx / len, y: dy / len };
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function formatNumber(value) {
  return Math.floor(value).toLocaleString("zh-CN");
}

export function rectContains(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function moveToward(entity, targetX, targetY, speed, dt) {
  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const len = Math.hypot(dx, dy);
  if (len <= speed * dt || len < 0.1) {
    entity.x = targetX;
    entity.y = targetY;
    return true;
  }
  entity.x += (dx / len) * speed * dt;
  entity.y += (dy / len) * speed * dt;
  return false;
}

export const UI_FONT_FAMILY = '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
export const NUMBER_FONT_FAMILY = 'Consolas, "Microsoft YaHei UI", "Microsoft YaHei", monospace';

export function drawPixelText(ctx, text, x, y, color = "#f8e9bd", size = 14, align = "left") {
  const fontSize = normalizeUiFontSize(size);
  const weight = getUiFontWeight(fontSize);
  const px = Math.round(x);
  const py = Math.round(y);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fontKerning = "none";
  ctx.fillStyle = color;
  ctx.font = `${weight} ${fontSize}px ${UI_FONT_FAMILY}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  if (fontSize >= 10) {
    ctx.lineWidth = Math.max(2, Math.round(fontSize / 10));
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(5, 8, 12, 0.78)";
    ctx.strokeText(String(text), px, py);
  }
  if (fontSize >= 16) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
  }
  ctx.fillText(String(text), px, py);
  ctx.restore();
}

export function setupCanvasFont(ctx, size = 14, weight = 700, family = UI_FONT_FAMILY, align = "left", baseline = "top") {
  ctx.imageSmoothingEnabled = false;
  ctx.fontKerning = "none";
  ctx.font = `${weight} ${normalizeUiFontSize(size)}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
}

export function normalizeUiFontSize(size) {
  const requested = Math.round(Number(size) || 14);
  if (requested <= 10) return Math.max(10, requested);
  if (requested <= 12) return 12;
  if (requested <= 15) return 14;
  if (requested <= 17) return 16;
  if (requested <= 21) return 20;
  if (requested <= 25) return 24;
  if (requested <= 33) return 32;
  return requested;
}

function getUiFontWeight(size) {
  if (size >= 24) return 900;
  if (size >= 18) return 800;
  if (size >= 12) return 700;
  return 650;
}

export function drawBar(ctx, x, y, w, h, ratio, fill, back = "#28170c", border = "#8f682e") {
  const safeRatio = clamp(ratio, 0, 1);
  ctx.fillStyle = back;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w * safeRatio), Math.round(h));
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
}

export function drawPanel(ctx, x, y, w, h, title = "") {
  ctx.save();
  ctx.fillStyle = "rgba(20, 14, 8, 0.86)";
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.strokeStyle = "#d6a84f";
  ctx.lineWidth = 2;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
  ctx.strokeStyle = "#5f3f17";
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x + 4) + 0.5, Math.round(y + 4) + 0.5, Math.round(w - 8), Math.round(h - 8));
  if (title) {
    ctx.fillStyle = "#0b0805";
    ctx.fillRect(Math.round(x + 12), Math.round(y - 11), Math.round(title.length * 16 + 28), 24);
    drawPixelText(ctx, title, x + 24, y - 7, "#ffd56a", 16);
  }
  ctx.restore();
}

export function wrapText(ctx, text, maxWidth) {
  const words = Array.from(text);
  const lines = [];
  let line = "";
  for (const char of words) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}
