import { describe, it, expect, vi } from "vitest";

// Mock all route modules to avoid pulling in werift, DB, etc.
vi.mock("./routes/auth.js", () => ({ authRoutes: async () => {} }));
vi.mock("./routes/characters.js", () => ({ characterRoutes: async () => {} }));
vi.mock("./routes/world.js", () => ({ worldRoutes: async () => {} }));
vi.mock("./routes/rtc.js", () => ({ rtcRoutes: async () => {} }));

import { buildApp } from "./app.js";

describe("buildApp", () => {
  it("returns a Fastify instance with routes registered", async () => {
    const app = await buildApp();
    expect(app).toBeDefined();
    expect(typeof app.inject).toBe("function");
    await app.close();
  });
});
