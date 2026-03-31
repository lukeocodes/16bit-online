import type { FastifyInstance } from "fastify";
import { db } from "../db/postgres.js";
import { savedModels } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Serve the base-models.json manifest from the workbench package */
function loadBaseModelsJson(): unknown {
  // When running from packages/server/src/routes/, the workbench is at ../../../../tools/model-workbench
  const candidates = [
    resolve(__dirname, "../../../../tools/model-workbench/src/models/base-models.json"),
    resolve(process.cwd(), "tools/model-workbench/src/models/base-models.json"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf8"));
    }
  }
  return { models: [] };
}

export async function modelRoutes(app: FastifyInstance) {
  // ─── GET /api/models/base — serve base-models.json manifest ─────────
  app.get("/base", async (_request, reply) => {
    const data = loadBaseModelsJson();
    reply.header("Cache-Control", "public, max-age=300");
    return data;
  });

  // ─── GET /api/models/saved — list saved models ────────────────────────
  app.get<{ Querystring: { tag?: string; baseId?: string } }>("/saved", async (request) => {
    const { tag, baseId } = request.query;

    const rows = await db.select().from(savedModels);

    const filtered = rows.filter(row => {
      if (baseId && row.baseModelId !== baseId) return false;
      if (tag) {
        const tags = (row.tags as string[]) ?? [];
        if (!tags.includes(tag)) return false;
      }
      return true;
    });

    return { models: filtered };
  });

  // ─── POST /api/models/saved — create new saved model ─────────────────
  app.post<{ Body: {
    name: string;
    description?: string;
    baseModelId: string;
    compositeConfig: unknown;
    tags?: string[];
    isNpc?: boolean;
  } }>("/saved", async (request, reply) => {
    const b = request.body;

    if (!b.name?.trim()) {
      return reply.status(400).send({ detail: "name is required" });
    }
    if (!b.baseModelId?.trim()) {
      return reply.status(400).send({ detail: "baseModelId is required" });
    }
    if (!b.compositeConfig || typeof b.compositeConfig !== "object") {
      return reply.status(400).send({ detail: "compositeConfig must be an object" });
    }

    const [created] = await db.insert(savedModels).values({
      name: b.name.trim().slice(0, 128),
      description: b.description ?? null,
      baseModelId: b.baseModelId.trim().slice(0, 64),
      compositeConfig: b.compositeConfig,
      tags: b.tags ?? [],
      isNpc: b.isNpc ?? false,
    }).returning();

    reply.status(201);
    return created;
  });

  // ─── PUT /api/models/saved/:id — update a saved model ────────────────
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      compositeConfig?: unknown;
      tags?: string[];
      isNpc?: boolean;
    };
  }>("/saved/:id", async (request, reply) => {
    const { id } = request.params;
    const b = request.body;

    const existing = await db.select().from(savedModels).where(eq(savedModels.id, id));
    if (existing.length === 0) {
      return reply.status(404).send({ detail: "Not found" });
    }

    const updates: Partial<typeof savedModels.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (b.name !== undefined) updates.name = b.name.trim().slice(0, 128);
    if (b.description !== undefined) updates.description = b.description;
    if (b.compositeConfig !== undefined) updates.compositeConfig = b.compositeConfig;
    if (b.tags !== undefined) updates.tags = b.tags;
    if (b.isNpc !== undefined) updates.isNpc = b.isNpc;

    const [updated] = await db.update(savedModels)
      .set(updates)
      .where(eq(savedModels.id, id))
      .returning();

    return updated;
  });

  // ─── DELETE /api/models/saved/:id ─────────────────────────────────────
  app.delete<{ Params: { id: string } }>("/saved/:id", async (request, reply) => {
    const { id } = request.params;

    const existing = await db.select().from(savedModels).where(eq(savedModels.id, id));
    if (existing.length === 0) {
      return reply.status(404).send({ detail: "Not found" });
    }

    await db.delete(savedModels).where(eq(savedModels.id, id));
    reply.status(204);
    return;
  });
}
