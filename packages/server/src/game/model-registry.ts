/**
 * Server-side model registry — loads saved composite models from the DB into memory.
 *
 * Used to:
 * - Attach savedModelId to entities so the client can resolve the composite config
 * - Send the full saved model list to clients on connect via SAVED_MODELS_SYNC
 */

import { db } from "../db/postgres.js";
import { savedModels } from "../db/schema.js";

export interface SavedModelConfig {
  id: string;
  name: string;
  description: string | null;
  baseModelId: string;
  compositeConfig: unknown;
  tags: string[];
  isNpc: boolean;
}

const modelCache = new Map<string, SavedModelConfig>();
let loaded = false;

/** Load all saved models from the DB into memory. Call once at server startup. */
export async function loadSavedModelsFromDB(): Promise<void> {
  try {
    const rows = await db.select().from(savedModels);
    modelCache.clear();
    for (const row of rows) {
      modelCache.set(row.id, {
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        baseModelId: row.baseModelId,
        compositeConfig: row.compositeConfig,
        tags: (row.tags as string[]) ?? [],
        isNpc: row.isNpc ?? false,
      });
    }
    loaded = true;
    console.log(`[ModelRegistry] Loaded ${modelCache.size} saved models from DB`);
  } catch (err) {
    // DB may not be migrated yet — log and continue
    console.warn("[ModelRegistry] Could not load saved models:", (err as Error).message);
  }
}

/** Get a saved model by ID. Returns undefined if not found. */
export function getSavedModel(id: string): SavedModelConfig | undefined {
  return modelCache.get(id);
}

/** Get all saved models as an array (for SAVED_MODELS_SYNC message). */
export function getAllSavedModels(): SavedModelConfig[] {
  return [...modelCache.values()];
}

/** Invalidate cache entry so next request reloads from DB. */
export function invalidateSavedModel(id: string): void {
  modelCache.delete(id);
}

/** True after the initial DB load has completed (even if it loaded 0 models). */
export function isModelRegistryLoaded(): boolean {
  return loaded;
}
