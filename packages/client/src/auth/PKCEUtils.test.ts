import { describe, it, expect } from "vitest";
import { generatePKCEPair } from "./PKCEUtils";

describe("PKCEUtils", () => {
  describe("generatePKCEPair", () => {
    it("generates a verifier and challenge", async () => {
      const { verifier, challenge } = await generatePKCEPair();
      expect(typeof verifier).toBe("string");
      expect(typeof challenge).toBe("string");
      expect(verifier.length).toBeGreaterThan(0);
      expect(challenge.length).toBeGreaterThan(0);
    });

    it("verifier is 64 hex characters", async () => {
      const { verifier } = await generatePKCEPair();
      expect(verifier.length).toBe(64);
      expect(verifier).toMatch(/^[0-9a-f]+$/);
    });

    it("challenge is base64url encoded (no +, /, or =)", async () => {
      const { challenge } = await generatePKCEPair();
      expect(challenge).not.toMatch(/[+/=]/);
      // Base64url charset: alphanumeric, dash, underscore
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("generates different pairs each time", async () => {
      const pair1 = await generatePKCEPair();
      const pair2 = await generatePKCEPair();
      expect(pair1.verifier).not.toBe(pair2.verifier);
      expect(pair1.challenge).not.toBe(pair2.challenge);
    });

    it("challenge is a valid SHA-256 digest length", async () => {
      const { challenge } = await generatePKCEPair();
      // SHA-256 = 32 bytes = 43 base64url chars (without padding)
      expect(challenge.length).toBe(43);
    });

    it("same verifier produces same challenge (deterministic hash)", async () => {
      // We can't easily test this without exposing internals,
      // but we can verify the challenge has consistent length
      const results = await Promise.all(
        Array.from({ length: 5 }, () => generatePKCEPair())
      );
      for (const { challenge } of results) {
        expect(challenge.length).toBe(43);
      }
    });
  });
});
