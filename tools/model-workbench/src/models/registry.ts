import type { Model, ModelCategory } from "./types";

class ModelRegistry {
  private models = new Map<string, Model>();

  register(model: Model): void {
    this.models.set(model.id, model);
  }

  get(id: string): Model | undefined {
    return this.models.get(id);
  }

  list(category?: ModelCategory): Model[] {
    const all = [...this.models.values()];
    return category ? all.filter((m) => m.category === category) : all;
  }

  categories(): ModelCategory[] {
    const cats = new Set<ModelCategory>();
    for (const m of this.models.values()) cats.add(m.category);
    return [...cats];
  }

  has(id: string): boolean {
    return this.models.has(id);
  }
}

export const registry = new ModelRegistry();
