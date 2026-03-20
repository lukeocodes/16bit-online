import { describe, it, expect } from "vitest";
import { gzipSync } from "node:zlib";
import { NetworkManager } from "./NetworkManager";

/**
 * Build a WMAP binary buffer with the specified world map data.
 * Header (28 bytes): magic(u32LE), seed(u32LE), width(u16LE), height(u16LE),
 *   biomeMapLen(u32LE), elevBandsLen(u32LE), regionMapLen(u32LE), regionBiomesLen(u32LE)
 * Payload: biomeMap, elevBands, regionMap (raw bytes), regionBiomes
 */
function buildWorldMapBinary(
  seed: number,
  width: number,
  height: number,
  biomeMap: Uint8Array,
  elevBands: Uint8Array,
  regionMap: Uint16Array,
  regionBiomes: Uint8Array,
): Uint8Array {
  const regionMapBytes = new Uint8Array(regionMap.buffer, regionMap.byteOffset, regionMap.byteLength);
  const totalLen = 28 + biomeMap.length + elevBands.length + regionMapBytes.length + regionBiomes.length;
  const buf = new Uint8Array(totalLen);
  const view = new DataView(buf.buffer);

  let offset = 0;
  view.setUint32(offset, 0x574D4150, true); offset += 4; // "WMAP"
  view.setUint32(offset, seed, true); offset += 4;
  view.setUint16(offset, width, true); offset += 2;
  view.setUint16(offset, height, true); offset += 2;
  view.setUint32(offset, biomeMap.length, true); offset += 4;
  view.setUint32(offset, elevBands.length, true); offset += 4;
  view.setUint32(offset, regionMapBytes.length, true); offset += 4;
  view.setUint32(offset, regionBiomes.length, true); offset += 4;

  buf.set(biomeMap, offset); offset += biomeMap.length;
  buf.set(elevBands, offset); offset += elevBands.length;
  buf.set(regionMapBytes, offset); offset += regionMapBytes.length;
  buf.set(regionBiomes, offset);

  return buf;
}

/**
 * Gzip compress and base64 encode binary data for parseWorldMap input.
 * Uses Node.js zlib since DecompressionStream may not be in test env.
 */
function gzipAndBase64(data: Uint8Array): string {
  const compressed = gzipSync(Buffer.from(data));
  return Buffer.from(compressed).toString("base64");
}

describe("NetworkManager.parseWorldMap", () => {
  it("decodes a minimal 2x2 world map with correct values", async () => {
    const biomeMap = new Uint8Array([3, 7, 10, 5]);
    const elevBands = new Uint8Array([1, 4, 2, 6]);
    const regionMap = new Uint16Array([100, 200, 300, 400]);
    const regionBiomes = new Uint8Array([3, 7]);

    const binary = buildWorldMapBinary(42, 2, 2, biomeMap, elevBands, regionMap, regionBiomes);
    const base64 = gzipAndBase64(binary);

    const nm = new NetworkManager();
    const result = await nm.parseWorldMap(base64);

    expect(result.seed).toBe(42);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(Array.from(result.biomeMap)).toEqual([3, 7, 10, 5]);
    expect(Array.from(result.elevationBands)).toEqual([1, 4, 2, 6]);
    expect(Array.from(result.regionMap)).toEqual([100, 200, 300, 400]);
    expect(Array.from(result.regionBiomes)).toEqual([3, 7]);
  });

  it("throws on invalid magic bytes", async () => {
    const biomeMap = new Uint8Array([1]);
    const elevBands = new Uint8Array([1]);
    const regionMap = new Uint16Array([1]);
    const regionBiomes = new Uint8Array([1]);

    // Build binary with wrong magic (0x00000000 instead of 0x574D4150)
    const binary = buildWorldMapBinary(42, 1, 1, biomeMap, elevBands, regionMap, regionBiomes);
    // Overwrite magic bytes to 0x00000000
    binary[0] = 0; binary[1] = 0; binary[2] = 0; binary[3] = 0;
    const base64 = gzipAndBase64(binary);

    const nm = new NetworkManager();
    await expect(nm.parseWorldMap(base64)).rejects.toThrow("Invalid world map magic");
  });

  it("handles a 3x3 world map with larger arrays", async () => {
    const biomeMap = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const elevBands = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    const regionMap = new Uint16Array([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000]);
    const regionBiomes = new Uint8Array([11, 22, 33]);

    const binary = buildWorldMapBinary(12345, 3, 3, biomeMap, elevBands, regionMap, regionBiomes);
    const base64 = gzipAndBase64(binary);

    const nm = new NetworkManager();
    const result = await nm.parseWorldMap(base64);

    expect(result.seed).toBe(12345);
    expect(result.width).toBe(3);
    expect(result.height).toBe(3);
    expect(result.biomeMap.length).toBe(9);
    expect(result.elevationBands.length).toBe(9);
    expect(result.regionMap.length).toBe(9);
    expect(result.regionBiomes.length).toBe(3);
  });

  it("correctly extracts Uint16Array values with proper alignment", async () => {
    // Use odd-length arrays before regionMap to test alignment handling
    const biomeMap = new Uint8Array([10, 20, 30]); // 3 bytes
    const elevBands = new Uint8Array([40, 50, 60]); // 3 bytes
    // offset after header = 28 + 3 + 3 = 34 (even, but still tests slice-copy path)
    const regionMap = new Uint16Array([0xBEEF, 0xCAFE, 0xDEAD]);
    const regionBiomes = new Uint8Array([99]);

    const binary = buildWorldMapBinary(777, 3, 1, biomeMap, elevBands, regionMap, regionBiomes);
    const base64 = gzipAndBase64(binary);

    const nm = new NetworkManager();
    const result = await nm.parseWorldMap(base64);

    expect(result.regionMap[0]).toBe(0xBEEF);
    expect(result.regionMap[1]).toBe(0xCAFE);
    expect(result.regionMap[2]).toBe(0xDEAD);
  });
});
