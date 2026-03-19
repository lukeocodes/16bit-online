import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock jwt module
vi.mock("./jwt.js", () => ({
  decodeGameJwt: vi.fn(),
}));

// Mock database
vi.mock("../db/postgres.js", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("../db/schema.js", () => ({
  accounts: { id: "accounts.id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: any, b: any) => ({ a, b })),
}));

import { requireAuth } from "./middleware.js";
import { decodeGameJwt } from "./jwt.js";
import { db } from "../db/postgres.js";

// Build mock Fastify request/reply
function mockRequest(authHeader?: string) {
  return {
    headers: {
      authorization: authHeader,
    },
  } as any;
}

function mockReply() {
  const reply: any = {
    statusCode: 200,
    body: null,
    status(code: number) { reply.statusCode = code; return reply; },
    send(data: any) { reply.body = data; return reply; },
  };
  return reply;
}

describe("requireAuth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects request with no Authorization header", async () => {
    const req = mockRequest(undefined);
    const rep = mockReply();

    await requireAuth(req, rep);

    expect(rep.statusCode).toBe(401);
    expect(rep.body.detail).toBe("Missing token");
  });

  it("rejects request without Bearer prefix", async () => {
    const req = mockRequest("Basic abc123");
    const rep = mockReply();

    await requireAuth(req, rep);

    expect(rep.statusCode).toBe(401);
    expect(rep.body.detail).toBe("Missing token");
  });

  it("rejects invalid/expired JWT", async () => {
    (decodeGameJwt as any).mockImplementation(() => {
      throw new Error("jwt expired");
    });

    const req = mockRequest("Bearer expired-token");
    const rep = mockReply();

    await requireAuth(req, rep);

    expect(rep.statusCode).toBe(401);
    expect(rep.body.detail).toBe("Invalid or expired token");
  });

  it("rejects when account not found in DB", async () => {
    (decodeGameJwt as any).mockReturnValue({ sub: "missing-account", email: "x@y.com", jti: "j" });

    // Mock the chained query: db.select().from().where() → []
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    (db.select as any).mockReturnValue({ from: mockFrom });

    const req = mockRequest("Bearer valid-token");
    const rep = mockReply();

    await requireAuth(req, rep);

    expect(rep.statusCode).toBe(401);
    expect(rep.body.detail).toBe("Account not found");
  });

  it("attaches account to request on success", async () => {
    const fakeAccount = { id: "acc-1", email: "test@test.com", displayName: "Tester" };

    (decodeGameJwt as any).mockReturnValue({ sub: "acc-1", email: "test@test.com", jti: "j" });

    const mockWhere = vi.fn().mockResolvedValue([fakeAccount]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    (db.select as any).mockReturnValue({ from: mockFrom });

    const req = mockRequest("Bearer good-token");
    const rep = mockReply();

    await requireAuth(req, rep);

    // Should NOT have sent 401
    expect(rep.statusCode).toBe(200);
    // Account should be attached to request
    expect(req.account).toEqual(fakeAccount);
  });
});
