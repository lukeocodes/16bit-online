import { describe, it, expect, beforeEach, vi } from "vitest";
import { TokenStore } from "./TokenStore";

// Mock sessionStorage
const storage = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
});

// Helper: create a fake JWT with a given exp timestamp (seconds)
function fakeJwt(exp: number): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: "acc-1", email: "a@b.com", exp }));
  return `${header}.${payload}.fakesignature`;
}

describe("TokenStore", () => {
  let store: TokenStore;

  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    store = new TokenStore();
  });

  describe("setToken / getToken", () => {
    it("stores and retrieves a token", () => {
      store.setToken("jwt-123");
      expect(store.getToken()).toBe("jwt-123");
    });

    it("persists to sessionStorage", () => {
      store.setToken("jwt-456");
      expect(storage.get("gameJwt")).toBe("jwt-456");
    });

    it("falls back to sessionStorage", () => {
      storage.set("gameJwt", "stored-jwt");
      const freshStore = new TokenStore();
      expect(freshStore.getToken()).toBe("stored-jwt");
    });

    it("returns null when empty", () => {
      expect(store.getToken()).toBeNull();
    });
  });

  describe("clearToken", () => {
    it("clears in-memory and sessionStorage", () => {
      store.setToken("jwt-123");
      store.clearToken();
      expect(store.getToken()).toBeNull();
      expect(storage.has("gameJwt")).toBe(false);
    });
  });

  describe("isValid", () => {
    it("returns true for non-expired token", () => {
      // Expires 1 hour from now
      const exp = Math.floor(Date.now() / 1000) + 3600;
      store.setToken(fakeJwt(exp));
      expect(store.isValid()).toBe(true);
    });

    it("returns false for expired token", () => {
      // Expired 1 hour ago
      const exp = Math.floor(Date.now() / 1000) - 3600;
      store.setToken(fakeJwt(exp));
      expect(store.isValid()).toBe(false);
    });

    it("returns false when no token", () => {
      expect(store.isValid()).toBe(false);
    });

    it("returns false for malformed token", () => {
      store.setToken("not.a.valid.jwt");
      expect(store.isValid()).toBe(false);
    });

    it("returns false for non-base64 payload", () => {
      store.setToken("header.!!!invalid!!!.sig");
      expect(store.isValid()).toBe(false);
    });
  });
});
