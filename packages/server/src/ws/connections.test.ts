import { describe, it, expect, beforeEach, vi } from "vitest";
import { connectionManager, type PlayerConnection } from "./connections.js";

function mockConnection(entityId: string, channelState = "open"): PlayerConnection {
  return {
    pc: { close: vi.fn().mockResolvedValue(undefined) } as any,
    positionChannel: {
      readyState: channelState,
      send: vi.fn(),
    } as any,
    reliableChannel: {
      readyState: channelState,
      send: vi.fn(),
    } as any,
    accountId: "acc-1",
    characterId: "char-1",
    entityId,
  };
}

describe("ConnectionManager (real)", () => {
  beforeEach(() => {
    // Clear the singleton between tests
    for (const conn of connectionManager.getAll()) {
      connectionManager.remove(conn.entityId);
    }
    vi.clearAllMocks();
  });

  describe("add / get / getAll", () => {
    it("stores and retrieves a connection", () => {
      const conn = mockConnection("p1");
      connectionManager.add(conn);
      expect(connectionManager.get("p1")).toBe(conn);
    });

    it("returns undefined for unknown entity", () => {
      expect(connectionManager.get("nope")).toBeUndefined();
    });

    it("returns all connections", () => {
      connectionManager.add(mockConnection("p1"));
      connectionManager.add(mockConnection("p2"));
      expect(connectionManager.getAll().length).toBe(2);
    });
  });

  describe("remove", () => {
    it("removes connection and closes peer connection", async () => {
      const conn = mockConnection("p1");
      connectionManager.add(conn);

      connectionManager.remove("p1");
      expect(connectionManager.get("p1")).toBeUndefined();
      expect(conn.pc.close).toHaveBeenCalled();
      expect(conn.positionChannel).toBeNull();
      expect(conn.reliableChannel).toBeNull();
    });

    it("is safe for non-existent entity", () => {
      expect(() => connectionManager.remove("ghost")).not.toThrow();
    });

    it("handles pc.close() rejection gracefully", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const conn = mockConnection("p1");
      (conn.pc.close as any).mockRejectedValue(new Error("close failed"));

      connectionManager.add(conn);
      connectionManager.remove("p1");

      // Wait for the rejected promise to be caught
      await new Promise(r => setTimeout(r, 10));
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("sendReliable", () => {
    it("sends data on open reliable channel", () => {
      const conn = mockConnection("p1", "open");
      connectionManager.add(conn);

      connectionManager.sendReliable("p1", '{"op":2}');
      expect(conn.reliableChannel!.send).toHaveBeenCalled();
    });

    it("does not send on closed channel", () => {
      const conn = mockConnection("p1", "closed");
      connectionManager.add(conn);

      connectionManager.sendReliable("p1", "data");
      expect(conn.reliableChannel!.send).not.toHaveBeenCalled();
    });

    it("does not send to unknown entity", () => {
      connectionManager.sendReliable("ghost", "data");
      // No error thrown
    });
  });

  describe("sendPosition", () => {
    it("sends buffer on open position channel", () => {
      const conn = mockConnection("p1", "open");
      connectionManager.add(conn);

      const buf = Buffer.alloc(24);
      connectionManager.sendPosition("p1", buf);
      expect(conn.positionChannel!.send).toHaveBeenCalledWith(buf);
    });

    it("does not send on closed channel", () => {
      const conn = mockConnection("p1", "closed");
      connectionManager.add(conn);

      connectionManager.sendPosition("p1", Buffer.alloc(24));
      expect(conn.positionChannel!.send).not.toHaveBeenCalled();
    });
  });

  describe("broadcastReliable", () => {
    it("sends to all connections with open channels", () => {
      const c1 = mockConnection("p1", "open");
      const c2 = mockConnection("p2", "open");
      connectionManager.add(c1);
      connectionManager.add(c2);

      connectionManager.broadcastReliable('{"op":51}');
      expect(c1.reliableChannel!.send).toHaveBeenCalled();
      expect(c2.reliableChannel!.send).toHaveBeenCalled();
    });

    it("excludes specified entity", () => {
      const c1 = mockConnection("p1", "open");
      const c2 = mockConnection("p2", "open");
      connectionManager.add(c1);
      connectionManager.add(c2);

      connectionManager.broadcastReliable('{"op":2}', "p1");
      expect(c1.reliableChannel!.send).not.toHaveBeenCalled();
      expect(c2.reliableChannel!.send).toHaveBeenCalled();
    });

    it("skips connections with closed channels", () => {
      const open = mockConnection("p1", "open");
      const closed = mockConnection("p2", "closed");
      connectionManager.add(open);
      connectionManager.add(closed);

      connectionManager.broadcastReliable("data");
      expect(open.reliableChannel!.send).toHaveBeenCalled();
      expect(closed.reliableChannel!.send).not.toHaveBeenCalled();
    });
  });
});
