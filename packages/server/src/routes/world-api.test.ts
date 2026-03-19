import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

// Mock auth middleware to bypass JWT/DB checks
vi.mock("../auth/middleware.js", () => ({
  requireAuth: vi.fn(async (request: any) => {
    request.account = { id: "acc-test", email: "t@t.com", displayName: "Tester", isOnboarded: true };
  }),
}));

import { worldRoutes } from "./world.js";

async function buildApp() {
  const app = Fastify();
  await app.register(worldRoutes, { prefix: "/" });
  return app;
}

describe("world API routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = await buildApp();
  });

  describe("GET /chunks", () => {
    it("returns chunk data for origin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/chunks?x=0&y=0",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.x).toBe(0);
      expect(body.y).toBe(0);
      expect(body.z).toBe(0);
      expect(body.tileData).toHaveLength(32 * 32);
    });

    it("origin chunk contains stone near center", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/chunks?x=0&y=0",
      });
      const { tileData } = JSON.parse(res.body);
      // Tile (0,0) — distance 0 from world origin → stone (3)
      expect(tileData[0]).toBe(3);
    });

    it("far chunk has no stone tiles", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/chunks?x=10&y=10",
      });
      const { tileData } = JSON.parse(res.body);
      for (const tile of tileData) {
        expect(tile).not.toBe(3);
      }
    });

    it("returns correct chunk coordinates", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/chunks?x=3&y=-2",
      });
      const body = JSON.parse(res.body);
      expect(body.x).toBe(3);
      expect(body.y).toBe(-2);
    });
  });
});
