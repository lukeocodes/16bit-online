import type { Model } from "../types";
import { registry } from "../registry";

// Auto-discover every model class exported from files in this directory.
// Any exported class with getDrawCalls() and a non-empty id is registered.
const modules = import.meta.glob("./*.ts", { eager: true });
for (const [path, mod] of Object.entries(modules)) {
  if (path === "./index.ts") continue;
  for (const val of Object.values(mod as Record<string, unknown>)) {
    if (typeof val !== "function") continue;
    try {
      const inst = new (val as new () => unknown)();
      const m = inst as Partial<Model>;
      if (typeof m.getDrawCalls === "function" && typeof m.id === "string" && m.id) {
        registry.register(inst as Model);
      }
    } catch { /* constant, helper, or non-model class */ }
  }
}
