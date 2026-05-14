import { getAttackBox, getAttackPhase, getAttackProgress, getHurtBox, isAttackActive } from "./fighter.js";

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  function render(game) {
    drawStage(ctx, width, height, game);
    drawProjectiles(ctx, game.projectiles);
    drawFighter(ctx, game.p1);
    drawFighter(ctx, game.p2);
    drawEffects(ctx, game.effects);

    if (game.debugHitboxes) {
      drawHitboxes(ctx, game.p1);
      drawHitboxes(ctx, game.p2);
    }
  }

  return { render };
}

function drawStage(ctx, width, height, game) {
  ctx.clearRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#101820");
  sky.addColorStop(0.58, "#0b1016");
  sky.addColorStop(1, "#07090d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.11)";
  ctx.lineWidth = 1;
  for (let x = -80; x < width + 80; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x + game.stagePulse * 10, 0);
    ctx.lineTo(x - 160, height);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(98, 216, 255, 0.08)";
  ctx.fillRect(0, 310, width, 118);

  ctx.fillStyle = "#111923";
  ctx.fillRect(0, 428, width, height - 428);

  ctx.strokeStyle = "rgba(131, 255, 113, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(38, 428);
  ctx.lineTo(width - 38, 428);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 209, 102, 0.13)";
  ctx.fillRect(width / 2 - 2, 260, 4, 168);

  ctx.font = "900 13px Microsoft YaHei";
  ctx.fillStyle = "rgba(247, 251, 255, 0.18)";
  ctx.fillText("STICK FIGHT ARENA", 34, 48);
}

function drawFighter(ctx, fighter) {
  const phase = getAttackPhase(fighter);
  const attackProgress = getAttackProgress(fighter);
  const attackPose = getAttackPose(fighter, phase, attackProgress);
  const facing = fighter.attack?.direction || fighter.actionFacing || fighter.facing;
  const lean = fighter.vx * 0.012 + attackPose.bodyLean;
  const walk = Math.sin(fighter.poseTimer * 12) * (Math.abs(fighter.vx) > 20 && fighter.grounded ? 1 : 0);
  const attacking = Boolean(fighter.attack);
  const active = isAttackActive(fighter);
  const blocking = fighter.blocking;
  const color = fighter.invulnerable > 0 ? "#ffffff" : fighter.color;

  ctx.save();
  ctx.translate(fighter.x, fighter.y);
  ctx.scale(facing, 1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = fighter.invulnerable > 0 ? 18 : 10;
  ctx.lineWidth = 6;

  ctx.beginPath();
  ctx.arc(0, -112, 15, 0, Math.PI * 2);
  ctx.stroke();

  line(ctx, 0, -96, lean, -58);

  if (attacking) {
    drawAttackPose(ctx, attackPose);
  } else if (blocking) {
    line(ctx, 0, -86, 22, -76);
    line(ctx, 0, -82, 22, -62);
    ctx.strokeStyle = "rgba(98, 216, 255, 0.72)";
    ctx.lineWidth = 4;
    line(ctx, 30, -95, 30, -52);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
  } else {
    line(ctx, 0, -86, 20, -72 + walk * 6);
    line(ctx, 0, -82, -20, -69 - walk * 6);
  }

  line(ctx, lean, -58, 19 + attackPose.frontFoot, -18 + walk * 7);
  line(ctx, lean, -58, -18 + attackPose.backFoot, -18 - walk * 7);

  ctx.shadowBlur = 0;
  ctx.fillStyle = fighter.accent;
  ctx.fillRect(-18, -142, 36 * (fighter.hp / 100), 4);

  if (attacking) {
    drawActionCue(ctx, fighter, phase, attackProgress, attackPose);
  }

  ctx.restore();

  if (active) {
    drawAttackArc(ctx, fighter);
  }
}

function drawActionCue(ctx, fighter, phase, progress, pose) {
  const ranged = fighter.attack.type === "ranged";

  if (phase === "startup") {
    ctx.save();
    ctx.globalAlpha = 0.25 + progress * 0.35;
    ctx.strokeStyle = ranged ? "rgba(98, 216, 255, 0.85)" : "rgba(255, 209, 102, 0.78)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -82, 34 + progress * 9, -0.4, Math.PI * 1.25);
    ctx.stroke();
    ctx.restore();
  }

  if (phase === "active") {
    ctx.save();
    ctx.globalAlpha = 0.4 + pose.power * 0.35;
    ctx.fillStyle = ranged ? "rgba(98, 216, 255, 0.2)" : "rgba(255, 209, 102, 0.16)";
    ctx.beginPath();
    ctx.ellipse(pose.leadHandX + 12, pose.leadHandY + 2, ranged ? 30 : 26, ranged ? 30 : 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (phase === "recovery") {
    ctx.save();
    ctx.globalAlpha = 0.18 * (1 - progress);
    ctx.strokeStyle = "rgba(247, 251, 255, 0.7)";
    ctx.lineWidth = 2;
    line(ctx, pose.leadHandX - 18, pose.leadHandY - 6, pose.leadHandX + 8, pose.leadHandY - 6);
    ctx.restore();
  }
}

function getAttackPose(fighter, phase, progress) {
  if (!fighter.attack) {
    return {
      leadHandX: 20,
      leadHandY: -72,
      rearHandX: -20,
      rearHandY: -69,
      bodyLean: 0,
      frontFoot: 0,
      backFoot: 0,
      power: 0,
    };
  }

  const heavy = fighter.attack.type === "heavy";
  const ranged = fighter.attack.type === "ranged";

  if (phase === "startup") {
    const pull = easeOut(progress);
    return {
      leadHandX: ranged ? mix(18, 22, pull) : mix(18, -24, pull),
      leadHandY: ranged ? mix(-72, -88, pull) : mix(-72, -78, pull),
      rearHandX: mix(-18, -34, pull),
      rearHandY: mix(-68, -62, pull),
      bodyLean: ranged ? mix(0, -4, pull) : mix(0, -10, pull),
      frontFoot: mix(0, -5, pull),
      backFoot: mix(0, 8, pull),
      power: pull * (ranged ? 1.1 : heavy ? 1.2 : 0.8),
    };
  }

  if (phase === "active") {
    const punch = easeOut(progress);
    const reach = ranged ? 50 : heavy ? 78 : 60;
    return {
      leadHandX: ranged ? mix(22, reach, punch) : mix(-22, reach, punch),
      leadHandY: ranged ? mix(-88, -84, punch) : mix(-78, -88, punch),
      rearHandX: mix(-32, ranged ? -18 : -12, punch),
      rearHandY: mix(-62, -68, punch),
      bodyLean: mix(ranged ? -4 : -8, ranged ? 8 : heavy ? 18 : 12, punch),
      frontFoot: mix(-4, ranged ? 7 : heavy ? 16 : 10, punch),
      backFoot: mix(8, -12, punch),
      power: 1,
    };
  }

  if (phase === "recovery") {
    const back = easeInOut(progress);
    const reach = ranged ? 50 : heavy ? 78 : 60;
    return {
      leadHandX: mix(reach, 18, back),
      leadHandY: mix(ranged ? -84 : -88, -72, back),
      rearHandX: mix(-12, -20, back),
      rearHandY: mix(-68, -69, back),
      bodyLean: mix(ranged ? 8 : heavy ? 18 : 12, 0, back),
      frontFoot: mix(ranged ? 7 : heavy ? 16 : 10, 0, back),
      backFoot: mix(-12, 0, back),
      power: 1 - back,
    };
  }

  return {
    leadHandX: 20,
    leadHandY: -72,
    rearHandX: -20,
    rearHandY: -69,
    bodyLean: 0,
    frontFoot: 0,
    backFoot: 0,
    power: 0,
  };
}

function drawAttackPose(ctx, pose) {
  line(ctx, 0, -86, pose.leadHandX, pose.leadHandY);
  line(ctx, 0, -82, pose.rearHandX, pose.rearHandY);

  if (pose.power > 0.72) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, pose.power);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255, 209, 102, 0.82)";
    line(ctx, pose.leadHandX - 28, pose.leadHandY + 5, pose.leadHandX + 14, pose.leadHandY - 2);
    line(ctx, pose.leadHandX - 20, pose.leadHandY + 18, pose.leadHandX + 22, pose.leadHandY + 9);
    ctx.restore();
  }
}

function drawAttackArc(ctx, fighter) {
  const box = getAttackBox(fighter);
  if (!box) {
    return;
  }

  const gradient = ctx.createLinearGradient(box.x, box.y, box.x + box.width, box.y);
  gradient.addColorStop(0, "rgba(255, 209, 102, 0)");
  gradient.addColorStop(0.5, "rgba(255, 209, 102, 0.58)");
  gradient.addColorStop(1, "rgba(255, 209, 102, 0)");

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(box.x + box.width / 2, box.y + box.height / 2, box.width / 2, box.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawProjectiles(ctx, projectiles) {
  projectiles.forEach((projectile) => {
    const pulse = 1 + Math.sin(projectile.age * 22) * 0.12;

    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.shadowColor = projectile.color;
    ctx.shadowBlur = 22;

    const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, projectile.radius * 1.6);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.35, projectile.color);
    gradient.addColorStop(1, "rgba(98, 216, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, projectile.radius * pulse * 1.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = projectile.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, projectile.radius * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = projectile.color;
    ctx.fillRect(projectile.vx > 0 ? -42 : 14, -2, 28, 4);
    ctx.restore();
  });
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function drawEffects(ctx, effects) {
  effects.forEach((effect) => {
    const progress = effect.age / effect.life;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = effect.color;
    ctx.fillStyle = effect.color;
    ctx.lineWidth = 4;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 16;

    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const inner = 10 + progress * 10;
      const outer = 28 + progress * 32;
      ctx.beginPath();
      ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
      ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
      ctx.stroke();
    }

    ctx.font = "900 18px Microsoft YaHei";
    ctx.fillText(effect.text, effect.x + 18, effect.y - 10 - progress * 18);
    ctx.restore();
  });
}

function drawHitboxes(ctx, fighter) {
  const hurt = getHurtBox(fighter);
  ctx.save();
  ctx.strokeStyle = "rgba(98, 216, 255, 0.55)";
  ctx.strokeRect(hurt.x, hurt.y, hurt.width, hurt.height);

  const attack = getAttackBox(fighter);
  if (attack && isAttackActive(fighter)) {
    ctx.strokeStyle = "rgba(255, 95, 126, 0.72)";
    ctx.strokeRect(attack.x, attack.y, attack.width, attack.height);
  }
  ctx.restore();
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
