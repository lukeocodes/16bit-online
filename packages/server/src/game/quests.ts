/**
 * Quest System — simple kill quests with item/XP rewards.
 *
 * Quests are static templates. Players can accept quests from NPCs
 * and complete them by killing the required number of targets.
 */

import { connectionManager } from "../ws/connections.js";
import { Opcode, packReliable, packXpGain } from "./protocol.js";
import { getPlayerProgress } from "./world.js";
import { processXpGain, xpToNextLevel, totalXpForLevel } from "./experience.js";

export interface QuestTemplate {
  id: string;
  name: string;
  description: string;
  zone: string;              // Which zone this quest is available in
  levelMin: number;
  objectives: Array<{
    type: "kill";
    targetGroup: string;     // NPC group ID (e.g., "skeleton", "goblin")
    count: number;
  }>;
  rewards: {
    xp: number;
    items?: Array<{ itemId: string; qty: number }>;
  };
}

export interface QuestProgress {
  questId: string;
  objectives: number[];     // Current count per objective
  completed: boolean;
  turnedIn: boolean;
}

// --- Quest Definitions ---
export const QUESTS: Record<string, QuestTemplate> = {
  "kill-rabbits": {
    id: "kill-rabbits", name: "Rabbit Trouble",
    description: "The rabbits are eating the crops! Cull 5 of them.",
    zone: "human-meadows", levelMin: 1,
    objectives: [{ type: "kill", targetGroup: "rabbit", count: 5 }],
    rewards: { xp: 50, items: [{ itemId: "health-potion-small", qty: 3 }] },
  },
  "goblin-menace": {
    id: "goblin-menace", name: "Goblin Menace",
    description: "Goblins are raiding the roads. Kill 3 goblin grunts.",
    zone: "human-meadows", levelMin: 2,
    objectives: [{ type: "kill", targetGroup: "goblin", count: 3 }],
    rewards: { xp: 100, items: [{ itemId: "rusty-sword", qty: 1 }] },
  },
  "skeleton-threat": {
    id: "skeleton-threat", name: "Skeleton Threat",
    description: "The undead stir in the ruins. Destroy 5 skeletons.",
    zone: "crossroads", levelMin: 5,
    objectives: [{ type: "kill", targetGroup: "skeleton", count: 5 }],
    rewards: { xp: 200, items: [{ itemId: "bone-axe", qty: 1 }] },
  },
  "imp-infestation": {
    id: "imp-infestation", name: "Imp Infestation",
    description: "Imps are swarming the forest. Drive them back. Kill 4.",
    zone: "elf-grove", levelMin: 2,
    objectives: [{ type: "kill", targetGroup: "imp", count: 4 }],
    rewards: { xp: 80, items: [{ itemId: "gnarled-staff", qty: 1 }] },
  },
  "wasteland-warriors": {
    id: "wasteland-warriors", name: "Wasteland Warriors",
    description: "Skeleton warriors roam the wastes. Defeat 4 of them.",
    zone: "orc-wastes", levelMin: 2,
    objectives: [{ type: "kill", targetGroup: "skeleton", count: 4 }],
    rewards: { xp: 120, items: [{ itemId: "bone-helm", qty: 1 }] },
  },
};

// In-memory quest state per player
const playerQuests = new Map<string, QuestProgress[]>(); // entityId -> active quests

export function initPlayerQuests(entityId: string): void {
  playerQuests.set(entityId, []);
}

export function removePlayerQuests(entityId: string): void {
  playerQuests.delete(entityId);
}

/** Accept a quest (returns false if already accepted or completed) */
export function acceptQuest(entityId: string, questId: string): boolean {
  const quests = playerQuests.get(entityId);
  if (!quests) return false;
  if (quests.some(q => q.questId === questId)) return false;

  const template = QUESTS[questId];
  if (!template) return false;

  quests.push({
    questId,
    objectives: template.objectives.map(() => 0),
    completed: false,
    turnedIn: false,
  });

  sendQuestUpdate(entityId);
  return true;
}

/** Called when a player kills an NPC — updates quest progress */
export function onQuestKill(entityId: string, npcGroupId: string): void {
  const quests = playerQuests.get(entityId);
  if (!quests) return;

  let changed = false;
  for (const qp of quests) {
    if (qp.completed || qp.turnedIn) continue;
    const template = QUESTS[qp.questId];
    if (!template) continue;

    for (let i = 0; i < template.objectives.length; i++) {
      const obj = template.objectives[i];
      if (obj.type === "kill" && obj.targetGroup === npcGroupId && qp.objectives[i] < obj.count) {
        qp.objectives[i]++;
        changed = true;
      }
    }

    // Check if all objectives met
    const allDone = template.objectives.every((obj, i) => qp.objectives[i] >= obj.count);
    if (allDone && !qp.completed) {
      qp.completed = true;
      connectionManager.sendReliable(entityId,
        packReliable(Opcode.SYSTEM_MESSAGE, { message: `Quest complete: ${template.name}! Return to turn in.` }));
    }
  }

  if (changed) sendQuestUpdate(entityId);
}

/** Turn in a completed quest (returns rewards or null) */
export function turnInQuest(entityId: string, questId: string): QuestTemplate["rewards"] | null {
  const quests = playerQuests.get(entityId);
  if (!quests) return null;

  const qp = quests.find(q => q.questId === questId);
  if (!qp || !qp.completed || qp.turnedIn) return null;

  qp.turnedIn = true;
  sendQuestUpdate(entityId);

  const rewards = QUESTS[questId]?.rewards;
  if (!rewards) return null;

  // Apply XP reward
  if (rewards.xp > 0) {
    const prog = getPlayerProgress(entityId);
    if (prog) {
      const result = processXpGain(prog.xp, rewards.xp, prog.level);
      prog.xp = result.newXp;
      prog.level = result.newLevel;
      (prog as any).dirty = true;

      const xpNeeded = xpToNextLevel(prog.level);
      const xpIntoLevel = prog.xp - totalXpForLevel(prog.level);
      connectionManager.sendReliable(entityId,
        packXpGain(entityId, rewards.xp, xpIntoLevel, xpNeeded, prog.level));
    }
  }

  // Notify player
  connectionManager.sendReliable(entityId,
    packReliable(Opcode.SYSTEM_MESSAGE, {
      message: `Quest reward: +${rewards.xp} XP${rewards.items?.length ? " + items" : ""}`,
    }));

  return rewards;
}

/** Get available quests for a zone (not yet accepted by this player) */
export function getAvailableQuests(entityId: string, zoneId: string, playerLevel: number): QuestTemplate[] {
  const quests = playerQuests.get(entityId) ?? [];
  const accepted = new Set(quests.map(q => q.questId));

  return Object.values(QUESTS).filter(q =>
    q.zone === zoneId &&
    q.levelMin <= playerLevel &&
    !accepted.has(q.id)
  );
}

/** Send quest state to player */
function sendQuestUpdate(entityId: string): void {
  const quests = playerQuests.get(entityId) ?? [];
  const data = quests.filter(q => !q.turnedIn).map(qp => {
    const template = QUESTS[qp.questId];
    return {
      questId: qp.questId,
      name: template?.name ?? qp.questId,
      objectives: template?.objectives.map((obj, i) => ({
        description: `Kill ${obj.count} ${obj.targetGroup}`,
        current: qp.objectives[i],
        target: obj.count,
      })) ?? [],
      completed: qp.completed,
    };
  });

  connectionManager.sendReliable(entityId,
    packReliable(33 /* QUEST_UPDATE */, { quests: data }));
}
