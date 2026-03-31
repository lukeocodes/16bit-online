import type { CompositeConfig, AttachmentSlot, ModelPalette } from "./models/types";
import type { AnimationState } from "./models/WorkbenchSpriteSheet";
import { registry } from "./models/registry";

export type ViewMode = "composite" | "individual";

export interface SavedModelEntry {
  id: string;
  name: string;
  description?: string;
  baseModelId: string;
  compositeConfig: CompositeConfig;
  tags: string[];
  isNpc: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkbenchState {
  viewMode: ViewMode;
  /** Model ID when in individual view */
  selectedModelId: string | null;
  direction: number;
  walkPhase: number;
  playing: boolean;
  animSpeed: number;
  compositeConfig: CompositeConfig;
  /** Show ghost body behind individual models for context */
  showGhostBody: boolean;
  /** Animation mode: peace walk, attack stationary, attack moving */
  animationState: AnimationState;
  /** Attack phase counter (0..ATTACK_PHASES-1) */
  attackPhase: number;
  /** If non-null, the walk phase is frozen at this index and animation is paused */
  frozenFrameIndex: number | null;
  /** DB-saved models loaded from server */
  savedModels: SavedModelEntry[];
  /** Whether the game server is reachable */
  serverOnline: boolean;
}

export interface WorkbenchAPI {
  // View control
  setView(mode: ViewMode, modelId?: string): void;
  setDirection(dir: number): void;
  setWalkPhase(phase: number): void;
  toggleAnimation(playing?: boolean): void;
  setAnimSpeed(speed: number): void;
  setShowGhostBody(show: boolean): void;
  setAnimationState(state: AnimationState): void;
  freezeFrame(index: number | null): void;

  // Composite config
  setSlot(slot: string, modelId: string | null): void;
  setColor(key: string, hex: string): void;
  setArmor(type: string): void;
  setBuild(build: number): void;
  setHeight(height: number): void;

  // DB persistence
  selectModel(id: string): void;
  getCompositeConfig(): CompositeConfig;
  saveModel(name: string, description?: string, isNpc?: boolean): Promise<string>;
  loadSavedModel(id: string): void;
  deleteSavedModel(id: string): Promise<void>;
  reloadSavedModels(): Promise<void>;

  // Queries
  getState(): WorkbenchState;
  getConfig(): CompositeConfig;
  listModels(category?: string): { id: string; name: string; category: string; slot: string }[];
  listCategories(): string[];
  getDirection(): number;
  isPlaying(): boolean;
  getSavedModels(): SavedModelEntry[];

  // Events
  onChange(callback: () => void): void;
}

/**
 * Create the workbench API. Exposed as window.__workbench in dev mode.
 * Provides programmatic control — saves tokens vs Playwright DOM clicking.
 */
export function createWorkbenchAPI(state: WorkbenchState): WorkbenchAPI {
  const listeners: Array<() => void> = [];

  function notify() {
    for (const cb of listeners) cb();
  }

  const api: WorkbenchAPI = {
    setView(mode, modelId) {
      state.viewMode = mode;
      state.selectedModelId = modelId ?? null;
      notify();
    },

    setDirection(dir) {
      state.direction = ((dir % 8) + 8) % 8;
      notify();
    },

    setWalkPhase(phase) {
      state.walkPhase = phase;
      notify();
    },

    toggleAnimation(playing) {
      state.playing = playing ?? !state.playing;
      notify();
    },

    setAnimSpeed(speed) {
      state.animSpeed = Math.max(0.1, Math.min(3, speed));
      notify();
    },

    setShowGhostBody(show) {
      state.showGhostBody = show;
      notify();
    },

    setAnimationState(animState) {
      state.animationState = animState;
      notify();
    },

    freezeFrame(index) {
      state.frozenFrameIndex = index;
      if (index !== null) state.playing = false;
      notify();
    },

    setSlot(slot, modelId) {
      const atts = state.compositeConfig.attachments;
      const idx = atts.findIndex((a) => a.slot === slot);
      if (modelId === null) {
        if (idx >= 0) atts.splice(idx, 1);
      } else {
        if (idx >= 0) {
          atts[idx].modelId = modelId;
        } else {
          atts.push({ slot: slot as AttachmentSlot, modelId });
        }
      }
      notify();
    },

    setColor(key, hex) {
      const color = parseInt(hex.replace("#", ""), 16);
      if (key in state.compositeConfig.palette) {
        (state.compositeConfig.palette as unknown as Record<string, number>)[key] = color;
      }
      notify();
    },

    setArmor(_type) {
      notify();
    },

    setBuild(build) {
      state.compositeConfig.build = Math.max(0.7, Math.min(1.3, build));
      notify();
    },

    setHeight(height) {
      state.compositeConfig.height = Math.max(0.85, Math.min(1.15, height));
      notify();
    },

    selectModel(id) {
      // Check base models first
      const model = registry.get(id);
      if (model) {
        if (model.slot === "root" && model.category !== "construction") {
          state.compositeConfig.baseModelId = id;
          api.setView("composite");
        } else {
          api.setView("individual", id);
        }
        return;
      }
      // Check saved models
      const saved = state.savedModels.find((m) => m.id === id);
      if (saved) {
        Object.assign(state.compositeConfig, saved.compositeConfig);
        state.compositeConfig.baseModelId = saved.baseModelId;
        state.viewMode = "composite";
        state.selectedModelId = null;
        notify();
      }
    },

    getCompositeConfig() {
      return { ...state.compositeConfig };
    },

    async saveModel(name, description, isNpc) {
      const body = {
        name,
        description: description ?? "",
        baseModelId: state.compositeConfig.baseModelId,
        compositeConfig: state.compositeConfig,
        tags: [] as string[],
        isNpc: isNpc ?? false,
      };
      const res = await fetch("/api/models/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.statusText}`);
      const data = await res.json() as { id: string };
      await api.reloadSavedModels();
      return data.id;
    },

    loadSavedModel(id) {
      const saved = state.savedModels.find((m) => m.id === id);
      if (!saved) return;
      Object.assign(state.compositeConfig, saved.compositeConfig);
      state.compositeConfig.baseModelId = saved.baseModelId;
      state.viewMode = "composite";
      state.selectedModelId = null;
      notify();
    },

    async deleteSavedModel(id) {
      const res = await fetch(`/api/models/saved/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`);
      await api.reloadSavedModels();
    },

    async reloadSavedModels() {
      try {
        const res = await fetch("/api/models/saved");
        if (!res.ok) { state.serverOnline = false; notify(); return; }
        const data = await res.json() as { models: SavedModelEntry[] };
        state.savedModels = data.models ?? [];
        state.serverOnline = true;
      } catch {
        state.serverOnline = false;
        state.savedModels = [];
      }
      notify();
    },

    getState() {
      return { ...state };
    },

    getConfig() {
      return state.compositeConfig;
    },

    listModels(category) {
      return registry.list(category as any).map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        slot: m.slot,
      }));
    },

    listCategories() {
      return registry.categories();
    },

    getDirection() {
      return state.direction;
    },

    isPlaying() {
      return state.playing;
    },

    getSavedModels() {
      return [...state.savedModels];
    },

    onChange(callback) {
      listeners.push(callback);
    },
  };

  return api;
}

/** Expose on window for Playwright/dev access */
export function exposeWorkbenchAPI(api: WorkbenchAPI): void {
  (window as any).__workbench = api;
}
