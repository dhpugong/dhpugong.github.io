const FONT_FAMILIES = {
  ui: '"RPG UI Pixel", "Fusion Pixel 12px Proportional zh_hans", sans-serif',
  title: '"RPG Title Pixel", "Ark Pixel 16px Proportional zh_cn", sans-serif',
  mini: '"RPG Mini Pixel", "RPG UI Pixel", sans-serif',
  number: '"RPG Number Pixel", "RPG Title Pixel", monospace'
};

export const FONT_PROFILES = {
  desktop: {
    name: "desktop",
    families: FONT_FAMILIES,
    minSizes: { ui: 10, mini: 10, number: 24 },
    titleSize: 48
  },
  compact: {
    name: "compact",
    families: {
      ui: FONT_FAMILIES.ui,
      title: FONT_FAMILIES.title,
      mini: FONT_FAMILIES.ui,
      number: FONT_FAMILIES.number
    },
    minSizes: { ui: 12, mini: 12, number: 24 },
    titleSize: 32
  },
  mobile: {
    name: "mobile",
    families: {
      ui: FONT_FAMILIES.title,
      title: FONT_FAMILIES.title,
      mini: FONT_FAMILIES.ui,
      number: FONT_FAMILIES.number
    },
    minSizes: { ui: 16, mini: 12, number: 24 },
    titleSize: 32
  }
};

export const FONT = {
  get ui() {
    return getFontProfile().families.ui;
  },
  get title() {
    return getFontProfile().families.title;
  },
  get mini() {
    return getFontProfile().families.mini;
  },
  get number() {
    return getFontProfile().families.number;
  }
};

const ALLOWED_FONT_SIZES = [8, 9, 10, 11, 12, 16, 20, 24, 32, 36, 48, 64];
const FONT_LOADS = [
  '12px "RPG UI Pixel"',
  '16px "RPG Title Pixel"',
  '10px "RPG Mini Pixel"',
  '32px "RPG Number Pixel"'
];
const VIEWPORT_CANVAS_FILL_RATIO = 0.8;

export function getFontProfile(width = window.innerWidth, height = window.innerHeight) {
  if (width <= 760 || height <= 520) {
    return FONT_PROFILES.mobile;
  }
  if (width <= 1180 || height <= 720) {
    return FONT_PROFILES.compact;
  }
  return FONT_PROFILES.desktop;
}

export function normalizePixelFontSize(size, context = "ui") {
  const profile = getFontProfile();
  let requested = Math.round(Number(size) || 12);
  if (context === "title") {
    if (requested >= 24) {
      return Math.min(profile.titleSize, nearestAllowedSize(requested));
    }
    return nearestAllowedSize(requested);
  }
  if (context === "mini") {
    requested = Math.max(profile.minSizes.mini, requested <= 9 ? 10 : requested);
    return nearestAllowedSize(requested);
  }
  if (context === "number") {
    if (requested < profile.minSizes.number) return profile.minSizes.number;
    return nearestAllowedSize(requested);
  }
  if (requested === 13 || requested === 14 || requested === 15) {
    requested = requested < 14 ? 12 : 16;
  }
  if (profile.name === "mobile" && requested < 12) {
    requested = 12;
  } else {
    requested = Math.max(profile.minSizes.ui, requested);
  }
  return nearestAllowedSize(requested);
}

export function setupPixelText(ctx, family = FONT.ui, size = 12, align = "left", baseline = "top") {
  ctx.imageSmoothingEnabled = false;
  ctx.textRendering = "geometricPrecision";
  ctx.fontKerning = "none";
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.font = `${Math.round(size)}px ${family}`;
}

export function drawHardText(ctx, text, x, y, color = "#f8e9bd", options = {}) {
  const family = options.family || FONT.ui;
  const context = options.context || ((options.size || 12) >= 24 ? "title" : "ui");
  const size = normalizePixelFontSize(options.size || 12, context);
  const align = options.align || "left";
  const baseline = options.baseline || "top";
  const outline = options.outline === false ? null : (options.outline || "#050302");
  const outlineSize = Math.max(1, Math.round(options.outlineSize || (context === "number" ? 2 : 1)));
  const px = Math.round(x);
  const py = Math.round(y);

  ctx.save();
  setupPixelText(ctx, family, size, align, baseline);
  if (outline) {
    ctx.fillStyle = outline;
    for (let dx = -outlineSize; dx <= outlineSize; dx += 1) {
      for (let dy = -outlineSize; dy <= outlineSize; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        if (context !== "number" && Math.abs(dx) + Math.abs(dy) > outlineSize) continue;
        ctx.fillText(String(text), px + dx, py + dy);
      }
    }
  }
  ctx.fillStyle = color;
  ctx.fillText(String(text), px, py);
  ctx.restore();
  return size;
}

export function measurePixelText(ctx, text, size = 12, family = FONT.ui, context = "ui") {
  const normalizedSize = normalizePixelFontSize(size, context);
  ctx.save();
  setupPixelText(ctx, family, normalizedSize);
  const width = ctx.measureText(String(text || "")).width;
  ctx.restore();
  return width;
}

export async function loadPixelFonts() {
  if (!document.fonts) {
    return;
  }
  try {
    await Promise.all(FONT_LOADS.map((font) => document.fonts.load(font)));
    await document.fonts.ready;
  } catch (error) {
    console.warn("Pixel font loading failed; using fallback fonts.", error);
  }
}

export function getViewportCanvasScale(canvas) {
  const baseWidth = canvas.width || 960;
  const baseHeight = canvas.height || 540;
  const style = getComputedStyle(canvas);
  const horizontalFrame = parseFloat(style.borderLeftWidth)
    + parseFloat(style.borderRightWidth)
    + parseFloat(style.outlineWidth) * 2;
  const verticalFrame = parseFloat(style.borderTopWidth)
    + parseFloat(style.borderBottomWidth)
    + parseFloat(style.outlineWidth) * 2;
  const availableWidth = Math.max(1, (window.innerWidth || baseWidth) * VIEWPORT_CANVAS_FILL_RATIO - horizontalFrame);
  const availableHeight = Math.max(1, (window.innerHeight || baseHeight) * VIEWPORT_CANVAS_FILL_RATIO - verticalFrame);
  return Math.max(0.1, Math.min(availableWidth / baseWidth, availableHeight / baseHeight));
}

export function applyViewportCanvasScale(canvas) {
  const scale = getViewportCanvasScale(canvas);
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
  canvas.dataset.pixelScale = scale.toFixed(4);
  canvas.dataset.fontProfile = getFontProfile().name;
}

function nearestAllowedSize(size) {
  let best = ALLOWED_FONT_SIZES[0];
  let bestDiff = Math.abs(size - best);
  for (const candidate of ALLOWED_FONT_SIZES) {
    const diff = Math.abs(size - candidate);
    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }
  return best;
}
