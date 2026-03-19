import { describe, it, expect } from "vitest";
import { config } from "./config.js";

describe("config", () => {
  describe("structure", () => {
    it("has oauth section", () => {
      expect(config.oauth).toBeDefined();
      expect(typeof config.oauth.issuer).toBe("string");
      expect(typeof config.oauth.clientId).toBe("string");
      expect(typeof config.oauth.redirectUri).toBe("string");
    });

    it("has postgres section", () => {
      expect(config.postgres).toBeDefined();
      expect(typeof config.postgres.url).toBe("string");
    });

    it("has redis section", () => {
      expect(config.redis).toBeDefined();
      expect(typeof config.redis.host).toBe("string");
      expect(typeof config.redis.port).toBe("number");
    });

    it("has jwt section", () => {
      expect(config.jwt).toBeDefined();
      expect(typeof config.jwt.secret).toBe("string");
      expect(typeof config.jwt.expiryHours).toBe("number");
    });

    it("has server section", () => {
      expect(config.server).toBeDefined();
      expect(typeof config.server.host).toBe("string");
      expect(typeof config.server.port).toBe("number");
    });
  });

  describe("defaults", () => {
    it("oauth issuer defaults to Deepgram", () => {
      expect(config.oauth.issuer).toContain("deepgram");
    });

    it("redirect URI defaults to localhost:5173", () => {
      expect(config.oauth.redirectUri).toContain("localhost:5173");
    });

    it("redis port defaults to 6379", () => {
      expect(config.redis.port).toBe(6379);
    });

    it("server port defaults to 8000", () => {
      expect(config.server.port).toBe(8000);
    });

    it("jwt expiry is positive hours", () => {
      expect(config.jwt.expiryHours).toBeGreaterThan(0);
    });

    it("postgres URL is a valid connection string", () => {
      expect(config.postgres.url).toMatch(/^postgresql:\/\//);
    });
  });
});
