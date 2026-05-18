export function createNotice(title, lines, duration = 2, kind = "default") {
  return {
    title,
    lines: Array.isArray(lines) ? lines : [],
    timer: duration,
    duration,
    kind
  };
}

export function setNotice(game, title, lines, duration, kind) {
  game.notice = createNotice(title, lines, duration, kind);
}

export function updateNotice(game, dt) {
  if (!game.notice) {
    return;
  }
  game.notice.timer -= dt;
  if (game.notice.timer <= 0) {
    game.notice = null;
  }
}
