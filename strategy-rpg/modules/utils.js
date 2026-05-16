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

export function drawPixelText(ctx, text, x, y, color = "#f8e9bd", size = 14, align = "left") {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  ctx.font = `${size >= 12 ? 600 : 500} ${size}px "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  if (size >= 11) {
    ctx.lineWidth = Math.max(2, Math.round(size / 8));
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(5, 3, 2, 0.72)";
    ctx.strokeText(text, Math.round(x), Math.round(y));
  }
  ctx.fillText(text, Math.round(x), Math.round(y));
  ctx.restore();
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
    ctx.fillRect(Math.round(x + 12), Math.round(y - 10), Math.round(title.length * 16 + 24), 22);
    drawPixelText(ctx, title, x + 24, y - 6, "#ffd56a", 15);
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
