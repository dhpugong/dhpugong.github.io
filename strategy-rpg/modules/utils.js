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

const PANEL_THEMES = {
  parchment: {
    outer: "#73542f",
    inner: "#9b7444",
    wash: "rgba(230,188,112,0.08)",
    lineLight: "rgba(255,224,150,0.07)",
    lineDark: "rgba(48,32,16,0.14)",
    border: "#c89a50",
    inset: "#51381d",
    titleBack: "#6f4d25",
    titleLight: "rgba(232,186,101,0.12)",
    titleText: "#f4c95f",
    pattern: "scroll"
  },
  town: {
    outer: "#68715a",
    inner: "#8f9a76",
    wash: "rgba(224,220,164,0.08)",
    lineLight: "rgba(236,231,178,0.08)",
    lineDark: "rgba(41,53,32,0.14)",
    border: "#c4b968",
    inset: "#485339",
    titleBack: "#586541",
    titleLight: "rgba(226,214,128,0.12)",
    titleText: "#e8d879",
    pattern: "stone"
  },
  army: {
    outer: "#5d6b42",
    inner: "#85945d",
    wash: "rgba(215,201,121,0.08)",
    lineLight: "rgba(226,218,150,0.08)",
    lineDark: "rgba(35,50,24,0.15)",
    border: "#bfb35a",
    inset: "#40512c",
    titleBack: "#526134",
    titleLight: "rgba(218,207,112,0.12)",
    titleText: "#e8d76b",
    pattern: "canvas"
  },
  menu: {
    outer: "#536f73",
    inner: "#78928f",
    wash: "rgba(192,224,207,0.08)",
    lineLight: "rgba(207,235,229,0.08)",
    lineDark: "rgba(30,57,60,0.15)",
    border: "#9bc2b0",
    inset: "#3f5b61",
    titleBack: "#46676d",
    titleLight: "rgba(185,226,221,0.12)",
    titleText: "#d6e7bd",
    pattern: "ledger"
  },
  settings: {
    outer: "#7c553b",
    inner: "#a4774d",
    wash: "rgba(229,185,119,0.08)",
    lineLight: "rgba(240,207,154,0.08)",
    lineDark: "rgba(61,32,20,0.14)",
    border: "#c4975d",
    inset: "#5d3b28",
    titleBack: "#70482e",
    titleLight: "rgba(226,176,102,0.12)",
    titleText: "#e8c06d",
    pattern: "dots"
  },
  save: {
    outer: "#836235",
    inner: "#ad8751",
    wash: "rgba(233,198,129,0.09)",
    lineLight: "rgba(248,220,158,0.08)",
    lineDark: "rgba(63,42,20,0.13)",
    border: "#d2a65c",
    inset: "#604322",
    titleBack: "#77562a",
    titleLight: "rgba(230,190,109,0.12)",
    titleText: "#f0cf73",
    pattern: "scroll"
  },
  battle: {
    outer: "#805342",
    inner: "#a9785d",
    wash: "rgba(224,172,132,0.08)",
    lineLight: "rgba(240,199,163,0.08)",
    lineDark: "rgba(71,31,24,0.15)",
    border: "#c79462",
    inset: "#613a2c",
    titleBack: "#724032",
    titleLight: "rgba(218,154,112,0.12)",
    titleText: "#e8bd78",
    pattern: "diagonal"
  },
  victory: {
    outer: "#8e7837",
    inner: "#b89f55",
    wash: "rgba(238,216,132,0.1)",
    lineLight: "rgba(255,236,165,0.09)",
    lineDark: "rgba(76,58,21,0.14)",
    border: "#d6c06b",
    inset: "#6d572a",
    titleBack: "#80682e",
    titleLight: "rgba(238,216,132,0.14)",
    titleText: "#f2db83",
    pattern: "dots"
  }
};

export function drawPanel(ctx, x, y, w, h, title = "", themeName = "parchment") {
  const theme = PANEL_THEMES[themeName] || PANEL_THEMES.parchment;
  const px = Math.round(x);
  const py = Math.round(y);
  const pw = Math.round(w);
  const ph = Math.round(h);
  ctx.save();

  ctx.fillStyle = theme.outer;
  ctx.fillRect(px, py, pw, ph);
  ctx.fillStyle = theme.inner;
  ctx.fillRect(px + 3, py + 3, pw - 6, ph - 6);
  ctx.fillStyle = theme.wash;
  ctx.fillRect(px + 7, py + 7, pw - 14, ph - 14);

  drawPanelPattern(ctx, px, py, pw, ph, theme);

  ctx.fillStyle = theme.lineLight;
  ctx.fillRect(px + 6, py + 6, pw - 12, 3);
  ctx.fillStyle = theme.lineDark;
  ctx.fillRect(px + 6, py + ph - 9, pw - 12, 3);

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 0.5, py + 0.5, pw, ph);
  ctx.strokeStyle = theme.inset;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x + 4) + 0.5, Math.round(y + 4) + 0.5, Math.round(w - 8), Math.round(h - 8));
  if (title) {
    ctx.fillStyle = theme.titleBack;
    ctx.fillRect(Math.round(x + 12), Math.round(y - 11), Math.round(title.length * 16 + 28), 24);
    ctx.fillStyle = theme.titleLight;
    ctx.fillRect(Math.round(x + 15), Math.round(y - 8), Math.round(title.length * 16 + 22), 4);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x + 12) + 0.5, Math.round(y - 11) + 0.5, Math.round(title.length * 16 + 28), 24);
    drawPixelText(ctx, title, x + 24, y - 7, theme.titleText, 16);
  }
  ctx.restore();
}

function drawPanelPattern(ctx, px, py, pw, ph, theme) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(px + 8, py + 8, Math.max(0, pw - 16), Math.max(0, ph - 16));
  ctx.clip();

  if (theme.pattern === "stone") {
    ctx.fillStyle = theme.lineLight;
    for (let yy = py + 18; yy < py + ph - 10; yy += 24) {
      ctx.fillRect(px + 8, yy, pw - 16, 1);
    }
    ctx.fillStyle = theme.lineDark;
    for (let yy = py + 18; yy < py + ph - 10; yy += 24) {
      const offset = Math.floor((yy - py) / 24) % 2 ? 18 : 0;
      for (let xx = px + 14 + offset; xx < px + pw - 10; xx += 36) {
        ctx.fillRect(xx, yy - 10, 1, 20);
      }
    }
  } else if (theme.pattern === "canvas") {
    ctx.strokeStyle = theme.lineLight;
    ctx.lineWidth = 1;
    for (let d = -ph; d < pw; d += 18) {
      ctx.beginPath();
      ctx.moveTo(px + d, py + ph);
      ctx.lineTo(px + d + ph, py);
      ctx.stroke();
    }
    ctx.strokeStyle = theme.lineDark;
    for (let d = 0; d < pw + ph; d += 24) {
      ctx.beginPath();
      ctx.moveTo(px + d, py);
      ctx.lineTo(px + d - ph, py + ph);
      ctx.stroke();
    }
  } else if (theme.pattern === "ledger") {
    ctx.fillStyle = theme.lineLight;
    for (let yy = py + 14; yy < py + ph - 10; yy += 16) {
      ctx.fillRect(px + 8, yy, pw - 16, 1);
    }
    ctx.fillStyle = theme.lineDark;
    for (let xx = px + 18; xx < px + pw - 10; xx += 28) {
      ctx.fillRect(xx, py + 8, 1, ph - 16);
    }
  } else if (theme.pattern === "dots") {
    ctx.fillStyle = theme.lineLight;
    for (let yy = py + 14; yy < py + ph - 10; yy += 18) {
      for (let xx = px + 14; xx < px + pw - 10; xx += 22) {
        ctx.fillRect(xx, yy, 2, 2);
      }
    }
  } else if (theme.pattern === "diagonal") {
    ctx.fillStyle = theme.lineLight;
    for (let d = -ph; d < pw; d += 20) {
      for (let step = 0; step < ph; step += 10) {
        ctx.fillRect(px + d + step, py + ph - step, 8, 1);
      }
    }
    ctx.fillStyle = theme.lineDark;
    for (let yy = py + 18; yy < py + ph - 10; yy += 22) {
      ctx.fillRect(px + 8, yy, pw - 16, 1);
    }
  } else {
    ctx.fillStyle = theme.lineLight;
    for (let yy = py + 13; yy < py + ph - 10; yy += 18) {
      ctx.fillRect(px + 8, yy, pw - 16, 1);
    }
    ctx.fillStyle = theme.lineDark;
    for (let xx = px + 15; xx < px + pw - 10; xx += 24) {
      ctx.fillRect(xx, py + 8, 1, ph - 16);
    }
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
