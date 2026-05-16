export function addWarReport(game, text, kind = "neutral") {
  if (!game.reports) {
    game.reports = [];
  }
  game.reports.unshift({
    text,
    kind,
    time: Date.now()
  });
  game.reports = game.reports.slice(0, 8);
}

export function normalizeReports(reports) {
  return (reports || []).map((entry) => {
    if (typeof entry === "string") {
      return { text: entry, kind: "neutral", time: Date.now() };
    }
    return {
      text: entry.text || "",
      kind: entry.kind || "neutral",
      time: entry.time || Date.now()
    };
  }).filter((entry) => entry.text);
}
