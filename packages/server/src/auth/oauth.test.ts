import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { exchangeCode, getUserinfo } from "./oauth.js";

function jsonResponse(data: any, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(data) });
}

describe("oauth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exchangeCode", () => {
    it("sends token exchange request", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ access_token: "at-123", id_token: "it-456" }));

      const result = await exchangeCode("auth-code", "pkce-verifier");

      expect(result.access_token).toBe("at-123");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/oauth2/token");
      expect(opts.method).toBe("POST");
      expect(opts.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

      const body = opts.body as URLSearchParams;
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("code")).toBe("auth-code");
      expect(body.get("code_verifier")).toBe("pkce-verifier");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({}, false));

      await expect(exchangeCode("bad", "bad")).rejects.toThrow("Token exchange failed");
    });
  });

  describe("getUserinfo", () => {
    it("fetches userinfo with bearer token", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        sub: "user-123", email: "test@example.com", name: "Test User",
      }));

      const result = await getUserinfo("access-token-xyz");

      expect(result.sub).toBe("user-123");
      expect(result.email).toBe("test@example.com");

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/oauth2/userInfo");
      expect(opts.headers.Authorization).toBe("Bearer access-token-xyz");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({}, false));

      await expect(getUserinfo("bad-token")).rejects.toThrow("Userinfo fetch failed");
    });
  });
});
