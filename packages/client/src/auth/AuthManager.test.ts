import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionState } from "../state/SessionState";
import { AuthManager } from "./AuthManager";

// Mock sessionStorage
const storage = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
});

// Mock browser globals
const mockLocation = { href: "" };
const mockHistory = { replaceState: vi.fn() };
const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);
vi.stubGlobal("window", {
  location: mockLocation,
  history: mockHistory,
});

function jsonResponse(data: any, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe("AuthManager", () => {
  let session: SessionState;
  let auth: AuthManager;

  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    session = new SessionState();
    auth = new AuthManager(session);
    mockLocation.href = "";
  });

  describe("fetchConfig", () => {
    it("fetches and returns auth config", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        clientId: "test-client",
        issuer: "https://auth.example.com",
        redirectUri: "http://localhost:5173/auth/callback",
      }));

      const config = await auth.fetchConfig();
      expect(config.clientId).toBe("test-client");
      expect(config.issuer).toBe("https://auth.example.com");
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/config");
    });

    it("caches config on subsequent calls", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ clientId: "c", issuer: "i", redirectUri: "r" }));

      await auth.fetchConfig();
      await auth.fetchConfig();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one fetch
    });
  });

  describe("startLogin", () => {
    it("constructs OAuth URL and redirects", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        clientId: "my-app",
        issuer: "https://auth.example.com",
        redirectUri: "http://localhost:5173/auth/callback",
      }));

      await auth.startLogin();

      // Should have set window.location.href to the OAuth URL
      expect(mockLocation.href).toContain("https://auth.example.com/oauth2/auth?");
      expect(mockLocation.href).toContain("client_id=my-app");
      expect(mockLocation.href).toContain("response_type=code");
      expect(mockLocation.href).toContain("scope=openid+profile+email");
      expect(mockLocation.href).toContain("code_challenge_method=S256");
      expect(mockLocation.href).toContain("code_challenge=");
    });

    it("stores PKCE verifier before redirect", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        clientId: "app", issuer: "https://auth.test", redirectUri: "http://localhost/cb",
      }));

      await auth.startLogin();

      expect(session.getPKCEVerifier()).toBeTruthy();
      expect(session.getPKCEVerifier()!.length).toBe(64);
    });
  });

  describe("handleCallback", () => {
    it("exchanges code for session", async () => {
      session.setPKCEVerifier("verifier-123");

      mockFetch.mockReturnValueOnce(jsonResponse({
        gameJwt: "jwt-abc",
        account: { id: "a-1", email: "x@y.com", displayName: "X", isOnboarded: true },
        characters: [{ id: "c-1", name: "Hero", race: "human", level: 1 }],
      }));

      await auth.handleCallback("auth-code-xyz");

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/callback", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "auth-code-xyz", code_verifier: "verifier-123" }),
      }));
      expect(session.getToken()).toBe("jwt-abc");
      expect(session.getAccount()?.id).toBe("a-1");
      expect(session.getPKCEVerifier()).toBeNull(); // Cleared after use
    });

    it("throws when no PKCE verifier stored", async () => {
      await expect(auth.handleCallback("code")).rejects.toThrow("Missing PKCE verifier");
    });

    it("throws on failed callback response", async () => {
      session.setPKCEVerifier("v");
      mockFetch.mockReturnValueOnce(jsonResponse({ detail: "Token exchange failed" }, false, 400));

      await expect(auth.handleCallback("bad-code")).rejects.toThrow("Token exchange failed");
    });

    it("handles non-JSON error response", async () => {
      session.setPKCEVerifier("v");
      mockFetch.mockReturnValueOnce(Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("not json")),
      }));

      await expect(auth.handleCallback("code")).rejects.toThrow("Auth failed");
    });
  });

  describe("refreshSession", () => {
    it("refreshes with existing token", async () => {
      session.setSession("old-jwt", {
        id: "a-1", email: "x@y.com", displayName: "X", isOnboarded: true,
      }, []);

      mockFetch.mockReturnValueOnce(jsonResponse({
        gameJwt: "new-jwt",
        account: { id: "a-1", email: "x@y.com", displayName: "X", isOnboarded: true },
        characters: [],
      }));

      await auth.refreshSession();
      expect(session.getToken()).toBe("new-jwt");
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/refresh", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer old-jwt" }),
      }));
    });

    it("throws when no token exists", async () => {
      await expect(auth.refreshSession()).rejects.toThrow("No token to refresh");
    });

    it("clears session on failed refresh", async () => {
      session.setSession("expired-jwt", {
        id: "a-1", email: "", displayName: "", isOnboarded: true,
      }, []);

      mockFetch.mockReturnValueOnce(jsonResponse({}, false, 401));

      await expect(auth.refreshSession()).rejects.toThrow("Session refresh failed");
      expect(session.getToken()).toBeNull();
    });
  });

  describe("devLogin", () => {
    it("logs in with username/password", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        gameJwt: "dev-jwt",
        account: { id: "a-dev", email: "dev@dev.local", displayName: "tester", isOnboarded: false },
        characters: [],
      }));

      await auth.devLogin("tester", "pass");
      expect(session.getToken()).toBe("dev-jwt");
      expect(session.getAccount()?.displayName).toBe("tester");
    });

    it("throws on failed dev login", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ detail: "Username required" }, false, 400));

      await expect(auth.devLogin("", "")).rejects.toThrow("Username required");
    });
  });

  describe("logout", () => {
    it("clears the session", () => {
      session.setSession("jwt", {
        id: "a-1", email: "", displayName: "", isOnboarded: true,
      }, []);

      auth.logout();
      expect(session.getToken()).toBeNull();
      expect(session.isAuthenticated()).toBe(false);
    });
  });
});
