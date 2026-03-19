import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionState } from "./SessionState";

// Mock sessionStorage for Node environment
const storage = new Map<string, string>();
const mockSessionStorage = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() { return storage.size; },
  key: vi.fn((_: number) => null),
};

vi.stubGlobal("sessionStorage", mockSessionStorage);

describe("SessionState", () => {
  let session: SessionState;

  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    session = new SessionState();
  });

  describe("setSession / getToken / isAuthenticated", () => {
    it("stores session data", () => {
      session.setSession("jwt-123", {
        id: "a-1", email: "test@test.com",
        displayName: "Tester", isOnboarded: true,
      }, []);

      expect(session.getToken()).toBe("jwt-123");
      expect(session.isAuthenticated()).toBe(true);
    });

    it("persists JWT to sessionStorage", () => {
      session.setSession("jwt-456", {
        id: "a-1", email: "", displayName: "", isOnboarded: true,
      }, []);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith("gameJwt", "jwt-456");
    });

    it("stores account and characters", () => {
      const account = { id: "a-1", email: "x@y.com", displayName: "X", isOnboarded: false };
      const chars = [{ id: "c-1", name: "Hero", race: "human", level: 1 }];

      session.setSession("jwt", account, chars);
      expect(session.getAccount()).toEqual(account);
      expect(session.getCharacters()).toEqual(chars);
    });
  });

  describe("clearSession", () => {
    it("clears all session data", () => {
      session.setSession("jwt", {
        id: "a-1", email: "", displayName: "", isOnboarded: true,
      }, [{ id: "c-1", name: "Hero", race: "human", level: 1 }]);

      session.clearSession();

      expect(session.getToken()).toBeNull();
      expect(session.isAuthenticated()).toBe(false);
      expect(session.getAccount()).toBeNull();
      expect(session.getCharacters()).toEqual([]);
    });

    it("removes JWT from sessionStorage", () => {
      session.setSession("jwt", {
        id: "a-1", email: "", displayName: "", isOnboarded: true,
      }, []);

      session.clearSession();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith("gameJwt");
    });
  });

  describe("isAuthenticated", () => {
    it("returns false when no session", () => {
      expect(session.isAuthenticated()).toBe(false);
    });

    it("falls back to sessionStorage", () => {
      storage.set("gameJwt", "stored-jwt");
      expect(session.isAuthenticated()).toBe(true);
    });
  });

  describe("getToken", () => {
    it("returns null when no session", () => {
      expect(session.getToken()).toBeNull();
    });

    it("falls back to sessionStorage", () => {
      storage.set("gameJwt", "stored-jwt");
      expect(session.getToken()).toBe("stored-jwt");
    });
  });

  describe("needsOnboarding", () => {
    it("returns true when account is not onboarded", () => {
      session.setSession("jwt", {
        id: "a-1", email: "", displayName: "", isOnboarded: false,
      }, []);
      expect(session.needsOnboarding()).toBe(true);
    });

    it("returns false when account is onboarded", () => {
      session.setSession("jwt", {
        id: "a-1", email: "", displayName: "", isOnboarded: true,
      }, []);
      expect(session.needsOnboarding()).toBe(false);
    });

    it("returns false when no account", () => {
      expect(session.needsOnboarding()).toBe(false);
    });
  });

  describe("setCharacters", () => {
    it("updates character list", () => {
      session.setCharacters([
        { id: "c-1", name: "A", race: "elf", level: 5 },
        { id: "c-2", name: "B", race: "dwarf", level: 3 },
      ]);
      expect(session.getCharacters().length).toBe(2);
    });
  });

  describe("PKCE verifier", () => {
    it("stores and retrieves verifier", () => {
      session.setPKCEVerifier("code-verifier-123");
      expect(session.getPKCEVerifier()).toBe("code-verifier-123");
    });

    it("persists to sessionStorage", () => {
      session.setPKCEVerifier("v123");
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith("pkce_verifier", "v123");
    });

    it("falls back to sessionStorage", () => {
      storage.set("pkce_verifier", "stored-verifier");
      expect(session.getPKCEVerifier()).toBe("stored-verifier");
    });

    it("clears verifier", () => {
      session.setPKCEVerifier("v123");
      session.clearPKCEVerifier();
      expect(session.getPKCEVerifier()).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith("pkce_verifier");
    });
  });
});
