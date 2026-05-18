import { ARMORS, CONFIG, FACTIONS, SKILLS, TRINKETS, TROOP_TYPES, WEAPONS } from "./config.js";
import { addPlayerExp, getPlayerBattleBonus } from "./player.js";
import { getGeneralBattleBonus } from "./generals.js";
import { addWarReport } from "./reports.js";
import {
  addArmyExperience,
  applyCasualties,
  capMoraleAfterBattle,
  getTroopBattleStats,
  getVictoryRewards,
  hasArmy
} from "./troop.js";
import { occupyTown } from "./town.js";
import { clamp, distanceXY, rand, randInt } from "./utils.js";

// 战斗模块：横版自动战斗、阵型编排、技能释放和伤亡结算。

const BATTLE_MOVE_SPEED_MULTIPLIER = 2;
const BATTLE_HP_MULTIPLIER = 3;
const BATTLE_ATTACK_SPEED_MULTIPLIER = 0.6;
const ENEMY_ADVANCE_DELAY = 1;
const FORMATION_FRONT_X = 278;
const FORMATION_COLUMN_GAP = 38;
const FORMATION_COLUMN_SIZE = 10;
const FORMATION_ROW_START_Y = 104;
const FORMATION_ROW_GAP = 16;
const FORMATION_GENERAL_Y = 176;
const FORMATION_TROOP_PRIORITY = ["infantry", "pikeman", "cavalry", "archer", "mage"];
const EMPTY_WEAPON = {
  id: "none",
  name: "未装备",
  attack: 0,
  defense: 0,
  range: 30,
  crit: 0,
  color: "#8f8060"
};

export function startBattle(game, options) {
  const enemy = options.enemy;
  const isSiege = options.type === "siege";
  game.state = "battle";
  game.battle = createBattleState({
    player: game.player,
    enemy,
    enemyArmy: enemy.army || enemy.garrison,
    enemyName: enemy.name,
    enemyFaction: enemy.faction || enemy.owner || "wild",
    isSiege,
    targetTown: options.town || null
  });
  game.message = "遭遇 " + game.battle.enemyName;
}

function createBattleState({ player, enemy, enemyArmy, enemyName, enemyFaction, isSiege, targetTown }) {
  const battle = {
    time: 0,
    ended: false,
    result: null,
    finishTimer: 0,
    settled: false,
    summary: null,
    enemy,
    player,
    enemyName,
    enemyFaction,
    isSiege,
    targetTown,
    playerGeneral: player.general,
    enemyGeneral: enemy.general,
    logs: ["战斗开始：铁冠盟约 对阵 " + enemyName],
    effects: [],
    units: [],
    casualties: { player: {}, enemy: {} },
    playerAttackOrdered: false,
    paused: false,
    enemyAdvanceDelay: ENEMY_ADVANCE_DELAY
  };

  // 布置左军（玩家）
  deployFormation(battle, player.army, "left", getPlayerBattleBonus(player), Boolean(player.general));
  deployGeneral(battle, player.general, "left", getPlayerBattleBonus(player));
  // 布置右军（敌方）
  deployFormation(battle, enemyArmy, "right", null, Boolean(enemy.general));
  deployGeneral(battle, enemy.general, "right", null);

  return battle;
}

function deployGeneral(battle, general, side, bonus) {
  if (!general) {
    return;
  }

  const weapon = WEAPONS[general.weapon] || EMPTY_WEAPON;
  const armor = side === "left" ? getEquippedGearBonus(battle, "armor") : EMPTY_WEAPON;
  const trinket = side === "left" ? getEquippedGearBonus(battle, "trinket") : EMPTY_WEAPON;
  const gearAttack = weapon.attack + (armor.attack || 0) + (trinket.attack || 0);
  const gearDefense = weapon.defense + (armor.defense || 0) + (trinket.defense || 0);
  const gearHp = (armor.hp || 0) + (trinket.hp || 0);
  const gearSpeed = (armor.speed || 0) + (trinket.speed || 0);
  const gearCrit = weapon.crit + (armor.crit || 0) + (trinket.crit || 0);
  const generalBonus = getGeneralBattleBonus(general);
  const dir = side === "left" ? 1 : -1;
  const level = general.level || 1;
  const hp = Math.round((130 + level * 22 + gearDefense * 8 + gearHp + generalBonus.hp) * (bonus ? 1 + bonus.morale / 220 : 1) * BATTLE_HP_MULTIPLIER);
  battle.units.push({
    id: side + "-general-" + Math.random().toString(16).slice(2),
    side,
    type: "general",
    stackLevel: level,
    x: getFormationColumnX(side, 0),
    y: FORMATION_GENERAL_Y,
    vx: 0,
    hp,
    maxHp: hp,
    attack: Math.round((18 + level * 4 + gearAttack + generalBonus.attack) * (bonus ? bonus.attack : 1)),
    defense: Math.round(6 + level + gearDefense + generalBonus.defense),
    range: weapon.range,
    speed: (38 + level * 1.5 + gearSpeed + generalBonus.speed) * (bonus ? bonus.speed : 1) * BATTLE_MOVE_SPEED_MULTIPLIER,
    crit: 0.08 + gearCrit + generalBonus.crit,
    color: side === "left" ? "#ffd56a" : FACTIONS[general.faction] ? FACTIONS[general.faction].color : "#f8e9bd",
    name: general.name || "将领",
    icon: "将",
    skill: weapon.range > 80 ? "arrowRain" : weapon.attack >= 18 ? "charge" : "warCry",
    attackTimer: rand(0.2, 0.8),
    skillTimer: rand(4, 7),
    deathTimer: 0,
    dead: false,
    dir,
    positioned: false,
    general: true,
    weapon,
    animSeed: Math.random() * 1000,
    attackPulse: 0,
    hitFlash: 0,
    skillPulse: 0
  });
}

function getEquippedGearBonus(battle, slot) {
  const player = battle && battle.player;
  const id = player && player.equipmentIds ? player.equipmentIds[slot] : null;
  if (slot === "armor") {
    return id && ARMORS[id] ? ARMORS[id] : EMPTY_WEAPON;
  }
  if (slot === "trinket") {
    return id && TRINKETS[id] ? TRINKETS[id] : EMPTY_WEAPON;
  }
  return EMPTY_WEAPON;
}

// 列阵规则：将领独立前排，士兵按兵种分列，每列最多 10 人。
function deployFormation(battle, army, side, bonus, hasGeneral) {
  const dir = side === "left" ? 1 : -1;
  const safeArmy = Array.isArray(army) ? army : [];
  const troopTypes = getFormationTroopTypes(safeArmy);
  let nextColumn = hasGeneral ? 1 : 0;

  for (const type of troopTypes) {
    const soldiers = getFormationSoldiersByType(safeArmy, type);
    if (!soldiers.length) {
      continue;
    }

    for (let i = 0; i < soldiers.length; i += 1) {
      const stack = soldiers[i];
      const stats = getTroopBattleStats(stack);
      const column = nextColumn + Math.floor(i / FORMATION_COLUMN_SIZE);
      const row = i % FORMATION_COLUMN_SIZE;
      const hp = Math.round(stats.hp * (bonus ? 1 + bonus.morale / 180 : 1) * BATTLE_HP_MULTIPLIER);

      battle.units.push({
        id: side + "-" + stack.type + "-lv" + stack.level + "-" + i + "-" + Math.random().toString(16).slice(2),
        side,
        type: stack.type,
        stackLevel: stack.level,
        x: getFormationColumnX(side, column),
        y: getFormationRowY(row),
        vx: 0,
        hp,
        maxHp: hp,
        attack: Math.round(stats.attack * (bonus ? bonus.attack : 1)),
        defense: stats.defense,
        range: stats.range,
        speed: stats.speed * (bonus ? bonus.speed : 1) * 1.55 * BATTLE_MOVE_SPEED_MULTIPLIER,
        crit: stats.crit,
        color: stats.color,
        name: stats.name,
        icon: stats.icon,
        skill: stats.skill,
        attackTimer: rand(0.3, 1.2),
        skillTimer: rand(2, 6),
        deathTimer: 0,
        dead: false,
        dir,
        positioned: false,
        animSeed: Math.random() * 1000,
        attackPulse: 0,
        hitFlash: 0,
        skillPulse: 0
      });
    }

    nextColumn += Math.ceil(soldiers.length / FORMATION_COLUMN_SIZE);
  }
}

function getFormationTroopTypes(army) {
  const seen = new Set();
  const ordered = [];
  for (const type of FORMATION_TROOP_PRIORITY) {
    if (army.some((stack) => stack.type === type && stack.count > 0)) {
      seen.add(type);
      ordered.push(type);
    }
  }
  for (const stack of army) {
    if (stack.count > 0 && !seen.has(stack.type)) {
      seen.add(stack.type);
      ordered.push(stack.type);
    }
  }
  return ordered;
}

function getFormationSoldiersByType(army, type) {
  const soldiers = [];
  for (const stack of army) {
    if (stack.type !== type || stack.count <= 0) {
      continue;
    }
    for (let i = 0; i < stack.count; i += 1) {
      soldiers.push(stack);
    }
  }
  return soldiers;
}

function getFormationColumnX(side, column) {
  const dir = side === "left" ? 1 : -1;
  const front = side === "left" ? FORMATION_FRONT_X : CONFIG.battleWidth - FORMATION_FRONT_X;
  return clamp(front - dir * column * FORMATION_COLUMN_GAP, 56, CONFIG.battleWidth - 56);
}

function getFormationRowY(row) {
  return FORMATION_ROW_START_Y + row * FORMATION_ROW_GAP;
}

export function updateBattle(game, dt) {
  const battle = game.battle;
  if (!battle) return;

  if (battle.paused && !battle.ended) {
    return;
  }

  battle.time += dt;
  updateEffects(battle, dt);

  if (battle.ended) {
    return;
  }

  // 更新所有单位
  for (const unit of battle.units) {
    updateBattleUnit(battle, unit, dt);
  }

  // 结算
  const aliveLeft = battle.units.some((u) => u.side === "left" && !u.dead);
  const aliveRight = battle.units.some((u) => u.side === "right" && !u.dead);

  if (!aliveLeft || !aliveRight) {
    battle.ended = true;
    battle.result = aliveLeft ? "win" : "lose";
    battle.summary = settleBattle(game, battle);
    battle.logs.unshift(aliveLeft ? "敌阵崩溃！我军大获全胜！" : "我军溃败……必须撤退重整。");

    if (!aliveLeft) {
      battle.effects.push({
        type: "banner", x: CONFIG.battleWidth / 2, y: 160,
        color: "#c94f3f", life: 1.5, maxLife: 1.5
      });
    } else {
      battle.effects.push({
        type: "banner", x: CONFIG.battleWidth / 2, y: 160,
        color: "#ffd56a", life: 1.5, maxLife: 1.5
      });
    }
  }
}

export function fleeBattle(game) {
  const battle = game.battle;
  if (!battle || battle.ended) {
    return;
  }

  battle.ended = true;
  battle.result = "flee";
  battle.summary = settleBattle(game, battle);
  battle.logs.unshift("我军鸣金撤退，脱离战场。");
  battle.effects.push({
    type: "banner", x: CONFIG.battleWidth / 2, y: 160,
    color: "#c94f3f", life: 1.2, maxLife: 1.2
  });
}

export function orderBattleAttack(game) {
  const battle = game.battle;
  if (!battle || battle.ended || battle.playerAttackOrdered) {
    return false;
  }
  battle.playerAttackOrdered = true;
  battle.logs.unshift("号角吹响，我军发起进攻！");
  battle.effects.push({
    type: "banner", x: 170, y: 140,
    color: "#ffd56a", life: 0.55, maxLife: 0.55
  });
  return true;
}

export function toggleBattlePause(game) {
  const battle = game.battle;
  if (!battle || battle.ended) {
    return false;
  }
  battle.paused = !battle.paused;
  battle.logs.unshift(battle.paused ? "战斗暂停" : "战斗继续");
  return true;
}

function updateBattleUnit(battle, unit, dt) {
  updateBattleAnimationTimers(unit, dt);

  if (unit.dead) {
    unit.deathTimer += dt;
    return;
  }

  unit.attackTimer -= dt;
  unit.skillTimer -= dt;

  const target = findBestTarget(battle, unit);
  if (!target) return;

  const dist = Math.abs(target.x - unit.x);
  const canAdvance = canUnitAdvance(battle, unit);

  // 移动至攻击范围
  if (canAdvance && dist > unit.range * 0.9) {
    unit.x += unit.dir * unit.speed * dt;
    unit.x = clamp(unit.x, 50, CONFIG.battleWidth - 50);
    unit.positioned = true;
  } else {
    // 微调位置，远程单位稍微后撤
    if (canAdvance && unit.range > 70 && dist < unit.range * 0.4) {
      unit.x -= unit.dir * unit.speed * 0.4 * dt;
    }
    unit.positioned = true;
  }

  // 攻击
  if (unit.attackTimer <= 0 && dist <= unit.range * 1.15) {
    performAttack(battle, unit, target);
    unit.attackTimer = getAttackDelay(unit);
  }

  // 技能
  if (unit.skillTimer <= 0 && dist <= unit.range * 1.2) {
    castSkill(battle, unit, target);
    unit.skillTimer = getSkillCooldown(unit.skill);
  }
}

function canUnitAdvance(battle, unit) {
  if (unit.side === "right") {
    return battle.time >= (battle.enemyAdvanceDelay || ENEMY_ADVANCE_DELAY);
  }
  return Boolean(battle.playerAttackOrdered);
}

function updateBattleAnimationTimers(unit, dt) {
  unit.attackPulse = Math.max(0, (unit.attackPulse || 0) - dt);
  unit.hitFlash = Math.max(0, (unit.hitFlash || 0) - dt);
  unit.skillPulse = Math.max(0, (unit.skillPulse || 0) - dt);
}

// 优先攻击最近的敌人，但远程优先攻击敌方远程
function findBestTarget(battle, unit) {
  const enemies = battle.units.filter((u) => u.side !== unit.side && !u.dead);
  if (!enemies.length) return null;

  let best = null;
  let bestScore = Infinity;

  for (const enemy of enemies) {
    const dist = distanceXY(unit.x, unit.y, enemy.x, enemy.y);
    // 远程单位优先攻击敌方远程/法师
    const priorityBias = (unit.range > 60 && (enemy.type === "archer" || enemy.type === "mage")) ? 0.6 : 1;
    const score = dist * priorityBias;
    if (score < bestScore) {
      bestScore = score;
      best = enemy;
    }
  }
  return best;
}

function performAttack(battle, unit, target) {
  const crit = Math.random() < unit.crit;
  const base = Math.max(2, unit.attack - target.defense * 0.5);
  const damage = Math.round(base * rand(0.8, 1.22) * (crit ? 1.9 : 1));
  unit.attackPulse = 0.22;
  damageUnit(battle, target, damage, unit.type);

  // 攻击特效
  const isRanged = unit.range > 60;
  battle.effects.push({
    type: isRanged ? "projectile" : "slash",
    fromX: unit.x,
    fromY: unit.y - 6,
    toX: target.x,
    toY: target.y - 6,
    color: crit ? "#ffd56a" : unit.color,
    life: isRanged ? 0.28 : 0.18,
    maxLife: isRanged ? 0.28 : 0.18
  });

  if (crit) {
    battle.logs.unshift(unit.name + " 暴击！造成 " + damage + " 点伤害");
  }
}

function castSkill(battle, unit, target) {
  const skillId = unit.skill;
  const skill = SKILLS[skillId];
  if (!skill) return;
  unit.attackPulse = Math.max(unit.attackPulse || 0, 0.35);
  unit.skillPulse = 0.48;

  if (skillId === "fireball") {
    const victims = battle.units.filter(
      (u) => u.side !== unit.side && !u.dead && distanceXY(target.x, target.y, u.x, u.y) < 56
    );
    for (const v of victims) {
      damageUnit(battle, v, unit.attack + randInt(6, 14), unit.type);
    }
    battle.effects.push({
      type: "burst", x: target.x, y: target.y,
      color: "#e66b3f", life: 0.5, maxLife: 0.5
    });
    battle.logs.unshift(skill.name + "：烈焰吞没敌阵" + (victims.length > 1 ? "（" + victims.length + "人）" : ""));
  } else if (skillId === "arrowRain") {
    const victims = battle.units.filter((u) => u.side !== unit.side && !u.dead).slice(0, 6);
    for (const v of victims) {
      damageUnit(battle, v, Math.round(unit.attack * 0.68), unit.type);
      battle.effects.push({
        type: "projectile",
        fromX: unit.x, fromY: unit.y - 24,
        toX: v.x, toY: v.y - 4,
        color: "#cfe6a2", life: 0.32, maxLife: 0.32
      });
    }
    battle.logs.unshift(skill.name + "：箭矢覆盖敌阵前排");
  } else if (skillId === "charge") {
    if (!canUnitAdvance(battle, unit)) {
      return;
    }
    unit.x += unit.dir * 40;
    damageUnit(battle, target, Math.round(unit.attack * 1.7), unit.type);
    battle.effects.push({
      type: "shock", x: target.x, y: target.y,
      color: "#ffd56a", life: 0.4, maxLife: 0.4
    });
    battle.logs.unshift(skill.name + "：骑兵撕裂敌阵！");
  } else if (skillId === "warCry") {
    const allies = battle.units.filter((u) => u.side === unit.side && !u.dead);
    for (const ally of allies) {
      ally.attackTimer = Math.min(ally.attackTimer, 0.2 / BATTLE_ATTACK_SPEED_MULTIPLIER);
      ally.attack += 2;
    }
    battle.effects.push({
      type: "banner", x: unit.x, y: unit.y - 20,
      color: "#ffd56a", life: 0.6, maxLife: 0.6
    });
    battle.logs.unshift(skill.name + "：全军士气高涨！");
  }
}

function damageUnit(battle, unit, amount, sourceType) {
  unit.hitFlash = 0.18;
  unit.hp -= amount;
  if (unit.hp <= 0 && !unit.dead) {
    unit.dead = true;
    unit.deathTimer = 0;
    const side = unit.side === "left" ? "player" : "enemy";
    if (unit.type !== "general") {
      const key = getCasualtyKey(unit);
      battle.casualties[side][key] = (battle.casualties[side][key] || 0) + 1;
    }
    battle.effects.push({
      type: "death", x: unit.x, y: unit.y,
      color: unit.color, life: 0.55, maxLife: 0.55
    });
    const sourceName = sourceType === "general" ? "将领" : TROOP_TYPES[sourceType] ? TROOP_TYPES[sourceType].name : "攻击";
    battle.logs.unshift(sourceName + " 击倒了 " + unit.name);
  }
}

function updateEffects(battle, dt) {
  for (const fx of battle.effects) {
    fx.life -= dt;
  }
  battle.effects = battle.effects.filter((fx) => fx.life > 0);
}

function getAttackDelay(unit) {
  let delay = 1.0;
  if (unit.type === "cavalry") delay = 1.1;
  if (unit.type === "archer") delay = 1.4;
  if (unit.type === "mage") delay = 1.6;
  return delay / BATTLE_ATTACK_SPEED_MULTIPLIER;
}

function getSkillCooldown(skillId) {
  return SKILLS[skillId] ? SKILLS[skillId].cooldown : 15;
}

function settleBattle(game, battle) {
  if (battle.settled) {
    return battle.summary;
  }
  battle.settled = true;

  const won = battle.result === "win";
  const fled = battle.result === "flee";
  const playerLosses = countCasualties(battle.casualties.player);
  const enemyLosses = countCasualties(battle.casualties.enemy);
  const playerFatalities = rollFatalities(battle.casualties.player);
  const enemyFatalities = rollFatalities(battle.casualties.enemy);
  const playerDeaths = countCasualties(playerFatalities);
  const enemyDeaths = countCasualties(enemyFatalities);
  const summary = {
    result: battle.result,
    title: won ? "战斗胜利" : fled ? "撤退成功" : "战斗失败",
    rewards: { gold: 0, exp: 0 },
    playerLosses,
    enemyLosses,
    playerDeaths,
    enemyDeaths,
    lines: []
  };

  game.player.army = applyCasualties(game.player.army, playerFatalities);
  capMoraleAfterBattle(game.player.army, won);

  const enemyArmy = battle.enemy.army || battle.enemy.garrison;
  const rewards = won ? getVictoryRewards(enemyArmy, battle.isSiege) : { gold: 0, exp: 0 };
  const remainingEnemy = applyCasualties(enemyArmy, enemyFatalities);
  if (battle.enemy.army) {
    battle.enemy.army = remainingEnemy;
  } else {
    battle.enemy.garrison = remainingEnemy;
  }

  if (won) {
    summary.rewards = rewards;
    game.player.gold += rewards.gold;
    addArmyExperience(game.player.army, rewards.exp);
    const levelMsgs = addPlayerExp(game.player, rewards.exp);
    summary.lines.push("获得金币 +" + rewards.gold);
    summary.lines.push("获得经验 +" + rewards.exp);
    summary.lines.push(formatPlayerLossLine(playerLosses, playerDeaths));
    for (const msg of levelMsgs) {
      summary.lines.push(msg);
    }

    const dropped = rollWeaponDrop(game, battle);
    if (dropped) {
      summary.lines.push("缴获武器：" + dropped.name);
    }

    if (battle.enemy.alive !== undefined && !battle.isSiege) {
      battle.enemy.alive = false;
      summary.lines.push(battle.enemy.name + " 已被击溃");
    } else if (battle.enemy.alive !== undefined && !hasArmy(battle.enemy.army)) {
      battle.enemy.alive = false;
      summary.lines.push(battle.enemy.name + " 已被击溃");
    }

    if (battle.isSiege && battle.targetTown) {
      occupyTown(game, battle.targetTown);
      summary.lines.push("占领 " + battle.targetTown.name);
      addWarReport(game, "我军攻下 " + battle.targetTown.name, "good");
    }
  } else {
    game.player.x = Math.max(80, game.player.x - rand(40, 90));
    game.player.y = Math.max(80, game.player.y - rand(30, 70));
    if (fled) {
      summary.lines.push("主动撤退，没有获得奖励");
    } else {
      const lostGold = game.player.gold - Math.max(0, Math.floor(game.player.gold * 0.55));
      game.player.gold = Math.max(0, Math.floor(game.player.gold * 0.55));
      summary.lines.push("损失金币 -" + lostGold);
    }
    summary.lines.push(formatPlayerLossLine(playerLosses, playerDeaths));
    summary.lines.push(fled ? "部队脱离战场" : "部队撤退至安全地带");
  }

  if (!hasArmy(game.player.army)) {
    game.player.army = [{ type: "infantry", count: 5, level: 1, xp: 0, morale: 35 }];
    summary.lines.push("残兵重整：步兵 +5");
  }

  return summary;
}

function rollFatalities(casualtyMap) {
  const fatalities = {};
  for (const type in casualtyMap) {
    if (!Object.prototype.hasOwnProperty.call(casualtyMap, type)) {
      continue;
    }
    const casualties = casualtyMap[type] || 0;
    if (casualties <= 0) {
      continue;
    }
    const deathRate = rand(0.2, 0.4);
    let dead = 0;
    for (let i = 0; i < casualties; i += 1) {
      if (Math.random() < deathRate) {
        dead += 1;
      }
    }
    if (dead > 0) {
      fatalities[type] = Math.min(casualties, dead);
    }
  }
  return fatalities;
}

function formatPlayerLossLine(playerLosses, playerDeaths) {
  if (playerLosses <= 0 && playerDeaths <= 0) {
    return "我军无明显伤亡";
  }
  return "我军倒下 " + playerLosses + "，实际阵亡 " + playerDeaths;
}

function rollWeaponDrop(game, battle) {
  const general = battle.enemyGeneral;
  if (!general || !general.weapon) {
    return null;
  }

  const weapon = WEAPONS[general.weapon];
  if (!weapon || Math.random() > weapon.dropChance) {
    return null;
  }

  addWeaponToInventory(game.player, weapon.id);
  if (game.player.general) {
    const currentWeaponId = getEquippedWeaponId(game.player);
    const current = currentWeaponId ? WEAPONS[currentWeaponId] : EMPTY_WEAPON;
    if (weapon.attack + weapon.defense > current.attack + current.defense) {
      removeWeaponFromInventory(game.player, weapon.id);
      if (currentWeaponId) {
        addWeaponToInventory(game.player, currentWeaponId);
      }
      game.player.general.weapon = weapon.id;
      if (!game.player.equipment) {
        game.player.equipment = { weapon: "未装备", armor: "未装备", trinket: "未装备" };
      }
      game.player.equipment.weapon = weapon.name;
    }
  }
  addWarReport(game, "缴获 " + weapon.name, "good");
  return weapon;
}

function getEquippedWeaponId(player) {
  const weaponId = player && player.general ? player.general.weapon : null;
  return weaponId && WEAPONS[weaponId] ? weaponId : null;
}

function addWeaponToInventory(player, weaponId) {
  if (!WEAPONS[weaponId]) {
    return;
  }
  if (!player.inventory) {
    player.inventory = [];
  }
  removeWeaponFromInventory(player, weaponId);
  player.inventory.push(weaponId);
}

function removeWeaponFromInventory(player, weaponId) {
  if (!player.inventory) {
    player.inventory = [];
    return;
  }
  player.inventory = player.inventory.filter((id) => id !== weaponId);
}

function countCasualties(map) {
  return Object.values(map || {}).reduce((sum, value) => sum + value, 0);
}

function getCasualtyKey(unit) {
  return unit.type + ":" + Math.max(1, Math.floor(unit.stackLevel || 1));
}

export function finishBattle(game) {
  const battle = game.battle;
  if (!battle) return;

  if (!battle.settled) {
    battle.summary = settleBattle(game, battle);
  }
  const won = battle.result === "win";
  game.player.target = null;
  game.state = "world";
  game.battle = null;
  game.pendingEncounter = null;
  game.message = won ? "战斗胜利" : battle.result === "flee" ? "部队已撤退" : "战斗失败，请补充兵力";
}

export function getBattleTitle(battle) {
  if (!battle) return "";
  const faction = FACTIONS[battle.enemyFaction] ? FACTIONS[battle.enemyFaction].name : battle.enemyName;
  return (battle.isSiege ? "攻城战" : "遭遇战") + " / " + faction;
}
