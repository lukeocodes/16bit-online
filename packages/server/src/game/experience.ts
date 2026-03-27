/**
 * Experience & leveling system.
 * XP is awarded on NPC kill, levels up at thresholds.
 * Stats increase on level-up.
 */

// XP required per level — quadratic scaling
// Level 1→2: 100 XP, Level 2→3: 250 XP, etc.
function xpForLevel(level: number): number {
  return Math.floor(50 * level * level + 50 * level);
}

/** Total XP needed to reach a given level from level 1 */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += xpForLevel(l);
  }
  return total;
}

/** XP needed to go from current level to next */
export function xpToNextLevel(level: number): number {
  return xpForLevel(level);
}

/** XP awarded for killing an NPC based on its HP and damage */
export function xpForKill(npcMaxHp: number, npcDamage: number, npcLevel: number): number {
  // Base: 10 XP per kill, scaled by NPC power
  const powerFactor = (npcMaxHp + npcDamage * 3) / 10;
  const levelBonus = Math.max(1, npcLevel);
  return Math.floor(10 * powerFactor * levelBonus);
}

export interface LevelUpResult {
  newLevel: number;
  hpBonus: number;
  manaBonus: number;
  staminaBonus: number;
}

/**
 * Process XP gain — returns level-up info if player leveled.
 * Can level multiple times from a single XP award.
 */
export function processXpGain(
  currentXp: number,
  xpGained: number,
  currentLevel: number,
): { newXp: number; newLevel: number; levelUps: LevelUpResult[] } {
  let xp = currentXp + xpGained;
  let level = currentLevel;
  const levelUps: LevelUpResult[] = [];

  while (xp >= totalXpForLevel(level + 1)) {
    level++;
    levelUps.push({
      newLevel: level,
      hpBonus: 5,      // +5 max HP per level
      manaBonus: 3,     // +3 max mana per level
      staminaBonus: 2,  // +2 max stamina per level
    });
  }

  return { newXp: xp, newLevel: level, levelUps };
}
