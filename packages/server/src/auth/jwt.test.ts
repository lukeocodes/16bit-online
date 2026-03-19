import { describe, it, expect } from "vitest";
import { createGameJwt, decodeGameJwt } from "./jwt.js";

describe("JWT", () => {
  describe("createGameJwt", () => {
    it("creates a valid JWT string", () => {
      const token = createGameJwt("account-123", "test@example.com");
      expect(typeof token).toBe("string");
      // JWT has 3 parts separated by dots
      expect(token.split(".").length).toBe(3);
    });

    it("includes account ID as sub claim", () => {
      const token = createGameJwt("acc-42", "user@test.com");
      const payload = decodeGameJwt(token);
      expect(payload.sub).toBe("acc-42");
    });

    it("includes email claim", () => {
      const token = createGameJwt("acc-1", "player@game.com");
      const payload = decodeGameJwt(token);
      expect(payload.email).toBe("player@game.com");
    });

    it("includes a unique jti (JWT ID)", () => {
      const token1 = createGameJwt("acc-1", "a@b.com");
      const token2 = createGameJwt("acc-1", "a@b.com");
      const p1 = decodeGameJwt(token1);
      const p2 = decodeGameJwt(token2);
      expect(p1.jti).toBeTruthy();
      expect(p2.jti).toBeTruthy();
      expect(p1.jti).not.toBe(p2.jti); // Each token gets a unique ID
    });
  });

  describe("decodeGameJwt", () => {
    it("round-trips a token", () => {
      const token = createGameJwt("acc-99", "round@trip.com");
      const payload = decodeGameJwt(token);
      expect(payload.sub).toBe("acc-99");
      expect(payload.email).toBe("round@trip.com");
    });

    it("throws on invalid token", () => {
      expect(() => decodeGameJwt("not.a.valid.token")).toThrow();
    });

    it("throws on empty string", () => {
      expect(() => decodeGameJwt("")).toThrow();
    });

    it("throws on tampered token", () => {
      const token = createGameJwt("acc-1", "a@b.com");
      // Flip a character in the payload section
      const parts = token.split(".");
      parts[1] = parts[1].slice(0, -1) + (parts[1].slice(-1) === "A" ? "B" : "A");
      const tampered = parts.join(".");
      expect(() => decodeGameJwt(tampered)).toThrow();
    });
  });
});
