export function handlePrivilegeInput(game, textEvents, onRedeem) {
  if (!game.privilege || !game.privilege.open || !textEvents.length) {
    return;
  }
  for (const event of textEvents) {
    if (event.type === "char") {
      game.privilege.input = (game.privilege.input + event.value).slice(0, 32);
    } else if (event.type === "backspace") {
      game.privilege.input = game.privilege.input.slice(0, -1);
    } else if (event.type === "enter") {
      onRedeem();
    } else if (event.type === "escape") {
      game.privilege.open = false;
    }
  }
}

export async function redeemPrivilegeCode(game, privilegeFile, notify) {
  if (!game.privilege || !game.privilege.open || game.privilege.busy) {
    return;
  }
  const inputCode = (game.privilege.input || "").trim();
  if (!inputCode) {
    notify("兑换失败", ["请输入兑换码"], 1.6, "gold");
    return;
  }

  game.privilege.busy = true;
  try {
    const response = await fetch(privilegeFile, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("privilege file not found");
    }
    const text = await response.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const code = lines[0] || "";
    const gold = Math.max(0, Math.floor(Number(lines[1] || 0)));
    if (!code || gold <= 0) {
      notify("兑换失败", ["兑换码配置无效"], 1.8, "gold");
      return;
    }
    if (inputCode !== code) {
      notify("兑换失败", ["兑换码不正确"], 1.8, "gold");
      return;
    }
    if (hasUsedPrivilegeCode(game, code)) {
      notify("已兑换", ["该兑换码已经使用过"], 1.8, "gold");
      return;
    }
    markPrivilegeCodeUsed(game, code);
    game.player.gold += gold;
    game.privilege.open = false;
    game.privilege.input = "";
    notify("兑换成功", ["金币 +" + gold], 2, "gold");
  } catch (error) {
    console.warn("兑换码读取失败", error);
    notify("兑换失败", ["无法读取 privilege.txt"], 1.8, "gold");
  } finally {
    if (game.privilege) {
      game.privilege.busy = false;
    }
  }
}

export function ensurePrivilegeCodeState(game) {
  if (!game.player) {
    return;
  }
  if (!Array.isArray(game.player.usedPrivilegeCodes)) {
    game.player.usedPrivilegeCodes = [];
  }
}

function hasUsedPrivilegeCode(game, code) {
  ensurePrivilegeCodeState(game);
  return game.player.usedPrivilegeCodes.includes(code);
}

function markPrivilegeCodeUsed(game, code) {
  ensurePrivilegeCodeState(game);
  if (!game.player.usedPrivilegeCodes.includes(code)) {
    game.player.usedPrivilegeCodes.push(code);
  }
}
