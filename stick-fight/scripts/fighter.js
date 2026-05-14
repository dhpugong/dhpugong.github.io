const groundY = 428;
const gravity = 1700;
const moveSpeed = 285;
const jumpSpeed = 720;
const dashSpeed = 680;
const arenaPadding = 42;
const projectileSpeed = 560;

const attacks = {
  light: {
    label: "LIGHT",
    damage: 7,
    startup: 0.12,
    active: 0.13,
    recovery: 0.2,
    range: 72,
    knockback: 120,
  },
  ranged: {
    label: "RANGED",
    damage: 9,
    startup: 0.22,
    active: 0.1,
    recovery: 0.32,
    range: 62,
    knockback: 150,
  },
};

export function createFighter(options) {
  return {
    id: options.id,
    name: options.name,
    color: options.color,
    accent: options.accent,
    x: options.x,
    y: groundY,
    vx: 0,
    vy: 0,
    width: 48,
    height: 128,
    hp: 100,
    facing: options.facing,
    grounded: true,
    blocking: false,
    invulnerable: 0,
    stun: 0,
    dashTimer: 0,
    dashCooldown: 0,
    projectileCooldown: 0,
    attack: undefined,
    attackHasHit: false,
    actionFacing: options.facing,
    poseTimer: 0,
    controls: options.controls,
  };
}

export function resetFighter(fighter, x, facing) {
  fighter.x = x;
  fighter.y = groundY;
  fighter.vx = 0;
  fighter.vy = 0;
  fighter.hp = 100;
  fighter.facing = facing;
  fighter.grounded = true;
  fighter.blocking = false;
  fighter.invulnerable = 0;
  fighter.stun = 0;
  fighter.dashTimer = 0;
  fighter.dashCooldown = 0;
  fighter.projectileCooldown = 0;
  fighter.attack = undefined;
  fighter.attackHasHit = false;
  fighter.actionFacing = facing;
  fighter.poseTimer = 0;
}

export function updateFighter(fighter, opponent, input, dt, arenaWidth) {
  const controls = fighter.controls;
  const moveInput = getMoveInput(input, controls);

  if (!fighter.attack && fighter.stun <= 0 && fighter.dashTimer <= 0) {
    fighter.facing = moveInput || (opponent.x >= fighter.x ? 1 : -1);
    fighter.actionFacing = fighter.facing;
  }

  fighter.invulnerable = Math.max(0, fighter.invulnerable - dt);
  fighter.stun = Math.max(0, fighter.stun - dt);
  fighter.dashCooldown = Math.max(0, fighter.dashCooldown - dt);
  fighter.projectileCooldown = Math.max(0, fighter.projectileCooldown - dt);
  fighter.poseTimer += dt;

  if (fighter.attack) {
    fighter.attack.elapsed += dt;
    const doneAt = fighter.attack.startup + fighter.attack.active + fighter.attack.recovery;

    if (fighter.attack.elapsed >= doneAt) {
      fighter.attack = undefined;
      fighter.attackHasHit = false;
    }
  }

  const canMove = fighter.stun <= 0 && fighter.dashTimer <= 0;
  const canStartAction = canMove && !fighter.attack;

  if (canStartAction && input.wasPressed(controls.light)) {
    startAttack(fighter, "light", moveInput);
  } else if (canStartAction && input.wasPressed(controls.ranged) && fighter.projectileCooldown <= 0) {
    startAttack(fighter, "ranged", moveInput);
  } else if (canStartAction && input.wasPressed(controls.dash) && fighter.dashCooldown <= 0) {
    const dashFacing = moveInput || fighter.facing;
    fighter.dashTimer = 0.16;
    fighter.dashCooldown = 0.78;
    fighter.invulnerable = 0.16;
    fighter.facing = dashFacing;
    fighter.actionFacing = dashFacing;
    fighter.vx = fighter.actionFacing * dashSpeed;
  }

  fighter.blocking = canStartAction && input.isDown(controls.block) && fighter.grounded;

  if (fighter.dashTimer > 0) {
    fighter.dashTimer = Math.max(0, fighter.dashTimer - dt);
  } else if (canMove) {
    const attackMoveScale = fighter.attack ? getAttackMoveScale(fighter.attack.type) : 1;
    fighter.vx = moveInput * moveSpeed * attackMoveScale;

    if (fighter.blocking) {
      fighter.vx *= 0.35;
    }

    if (!fighter.attack && input.wasPressed(controls.jump) && fighter.grounded) {
      fighter.vy = -jumpSpeed;
      fighter.grounded = false;
    }
  } else if (fighter.stun > 0) {
    fighter.vx *= 0.92;
  }

  fighter.vy += gravity * dt;
  fighter.x += fighter.vx * dt;
  fighter.y += fighter.vy * dt;

  if (fighter.y >= groundY) {
    fighter.y = groundY;
    fighter.vy = 0;
    fighter.grounded = true;
  }

  fighter.x = clamp(fighter.x, arenaPadding, arenaWidth - arenaPadding);
}

export function consumeProjectile(fighter) {
  if (!fighter.attack || fighter.attack.type !== "ranged" || fighter.attack.projectileFired) {
    return undefined;
  }

  if (fighter.attack.elapsed < fighter.attack.startup) {
    return undefined;
  }

  fighter.attack.projectileFired = true;
  fighter.projectileCooldown = 0.68;

  return {
    ownerId: fighter.id,
    x: fighter.x + fighter.attack.direction * 44,
    y: fighter.y - 88,
    vx: fighter.attack.direction * projectileSpeed,
    radius: 13,
    damage: attacks.ranged.damage,
    knockback: attacks.ranged.knockback,
    age: 0,
    life: 1.2,
    color: fighter.accent,
  };
}

export function updateProjectiles(projectiles, fighters, effects, dt, arenaWidth) {
  projectiles.forEach((projectile) => {
    projectile.age += dt;
    projectile.x += projectile.vx * dt;

    const target = fighters.find((fighter) => fighter.id !== projectile.ownerId);

    if (!target || projectile.hit || target.invulnerable > 0) {
      return;
    }

    const targetBox = getHurtBox(target);
    const projectileBox = {
      x: projectile.x - projectile.radius,
      y: projectile.y - projectile.radius,
      width: projectile.radius * 2,
      height: projectile.radius * 2,
    };

    if (!boxesOverlap(projectileBox, targetBox)) {
      return;
    }

    const facingHit = Math.sign(projectile.x - target.x) === target.facing;
    const blocked = target.blocking && target.grounded && facingHit;
    const damage = blocked ? Math.ceil(projectile.damage * 0.35) : projectile.damage;

    target.hp = Math.max(0, target.hp - damage);
    target.stun = blocked ? 0.1 : 0.22;
    target.vx = Math.sign(projectile.vx) * (blocked ? projectile.knockback * 0.3 : projectile.knockback);
    projectile.hit = true;

    effects.push({
      x: projectile.x,
      y: projectile.y,
      age: 0,
      life: 0.28,
      color: blocked ? "#62d8ff" : projectile.color,
      text: blocked ? "GUARD" : String(damage),
    });
  });

  return projectiles.filter(
    (projectile) =>
      !projectile.hit &&
      projectile.age < projectile.life &&
      projectile.x > -projectile.radius &&
      projectile.x < arenaWidth + projectile.radius,
  );
}

export function resolveAttack(attacker, defender, effects) {
  if (!attacker.attack || attacker.attackHasHit || attacker.attack.elapsed < attacker.attack.startup) {
    return;
  }

  if (attacker.attack.type === "ranged") {
    return;
  }

  if (attacker.attack.elapsed > attacker.attack.startup + attacker.attack.active) {
    return;
  }

  const spec = attacks[attacker.attack.type];
  const hitbox = getAttackBox(attacker);
  const defenderBox = getHurtBox(defender);

  if (!boxesOverlap(hitbox, defenderBox) || defender.invulnerable > 0) {
    return;
  }

  const facingHit = Math.sign(attacker.x - defender.x) === defender.facing;
  const blocked = defender.blocking && defender.grounded && facingHit;
  const damage = blocked ? Math.ceil(spec.damage * 0.35) : spec.damage;

  defender.hp = Math.max(0, defender.hp - damage);
  defender.stun = blocked ? 0.12 : 0.28;
  defender.vx = attacker.attack.direction * (blocked ? spec.knockback * 0.35 : spec.knockback);
  defender.vy = blocked ? defender.vy : Math.min(defender.vy, -90);
  attacker.attackHasHit = true;

  effects.push({
    x: defender.x - defender.facing * 34,
    y: defender.y - 84,
    age: 0,
    life: 0.28,
    color: blocked ? "#62d8ff" : "#ffd166",
    text: blocked ? "GUARD" : String(damage),
  });
}

export function getHurtBox(fighter) {
  return {
    x: fighter.x - 24,
    y: fighter.y - fighter.height,
    width: 48,
    height: fighter.height,
  };
}

export function getAttackBox(fighter) {
  if (!fighter.attack) {
    return undefined;
  }

  const spec = attacks[fighter.attack.type];
  const direction = fighter.attack.direction;
  return {
    x: direction > 0 ? fighter.x + 18 : fighter.x - 18 - spec.range,
    y: fighter.y - 104,
    width: spec.range,
    height: 50,
  };
}

export function getAttackPhase(fighter) {
  if (!fighter.attack) {
    return "idle";
  }

  const { elapsed, startup, active, recovery } = fighter.attack;

  if (elapsed < startup) {
    return "startup";
  }

  if (elapsed < startup + active) {
    return "active";
  }

  if (elapsed < startup + active + recovery) {
    return "recovery";
  }

  return "idle";
}

export function getAttackProgress(fighter) {
  if (!fighter.attack) {
    return 0;
  }

  const phase = getAttackPhase(fighter);
  const { elapsed, startup, active, recovery } = fighter.attack;

  if (phase === "startup") {
    return elapsed / startup;
  }

  if (phase === "active") {
    return (elapsed - startup) / active;
  }

  if (phase === "recovery") {
    return (elapsed - startup - active) / recovery;
  }

  return 0;
}

export function isAttackActive(fighter) {
  return Boolean(
    fighter.attack &&
      fighter.attack.elapsed >= fighter.attack.startup &&
      fighter.attack.elapsed <= fighter.attack.startup + fighter.attack.active,
  );
}

function startAttack(fighter, type, moveInput) {
  const spec = attacks[type];
  const attackDirection = moveInput || fighter.facing;

  fighter.attack = {
    type,
    elapsed: 0,
    startup: spec.startup,
    active: spec.active,
    recovery: spec.recovery,
    direction: attackDirection,
  };
  fighter.facing = attackDirection;
  fighter.actionFacing = attackDirection;
  fighter.attackHasHit = false;
  fighter.vx *= 0.35;
}

function getMoveInput(input, controls) {
  const left = input.isDown(controls.left) ? -1 : 0;
  const right = input.isDown(controls.right) ? 1 : 0;
  return left + right;
}

function getAttackMoveScale(type) {
  return type === "ranged" ? 0.42 : 0.68;
}

function boxesOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
