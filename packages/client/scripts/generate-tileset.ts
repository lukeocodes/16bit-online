/**
 * Generate a programmatic isometric tileset PNG using sharp.
 * Run: bun run scripts/generate-tileset.ts
 *
 * Tile IDs (12 tiles, 64x48 each, 4 columns):
 * 0: grass, 1: dirt, 2: stone, 3: sand, 4: water, 5: deep_water,
 * 6: forest_floor, 7: snow, 8: swamp, 9: mountain_rock, 10: path, 11: grass_dark
 */

const TILE_W = 64;
const TILE_H = 48;
const COLS = 4;

interface TileDef {
  name: string;
  topColor: [number, number, number];
  leftColor: [number, number, number];
  rightColor: [number, number, number];
  walkable: boolean;
}

const tiles: TileDef[] = [
  { name: "grass",         topColor: [76, 140, 50],  leftColor: [55, 100, 36],  rightColor: [65, 120, 42],  walkable: true },
  { name: "dirt",          topColor: [140, 110, 70], leftColor: [100, 80, 50],  rightColor: [120, 95, 60],  walkable: true },
  { name: "stone",         topColor: [140, 140, 140],leftColor: [100, 100, 100],rightColor: [120, 120, 120],walkable: true },
  { name: "sand",          topColor: [210, 190, 130],leftColor: [170, 150, 100],rightColor: [190, 170, 115],walkable: true },
  { name: "water",         topColor: [50, 100, 180], leftColor: [35, 70, 130],  rightColor: [42, 85, 155],  walkable: false },
  { name: "deep_water",    topColor: [25, 60, 130],  leftColor: [18, 42, 90],   rightColor: [22, 50, 110],  walkable: false },
  { name: "forest_floor",  topColor: [40, 90, 30],   leftColor: [28, 65, 22],   rightColor: [34, 78, 26],   walkable: true },
  { name: "snow",          topColor: [235, 235, 245],leftColor: [190, 190, 200],rightColor: [210, 210, 220],walkable: true },
  { name: "swamp",         topColor: [65, 85, 45],   leftColor: [45, 60, 32],   rightColor: [55, 72, 38],   walkable: true },
  { name: "mountain_rock", topColor: [90, 85, 80],   leftColor: [60, 57, 54],   rightColor: [75, 71, 67],   walkable: false },
  { name: "path",          topColor: [175, 150, 110],leftColor: [130, 110, 80], rightColor: [150, 130, 95], walkable: true },
  { name: "grass_dark",    topColor: [55, 110, 38],  leftColor: [40, 80, 28],   rightColor: [48, 95, 33],   walkable: true },
];

const ROWS = Math.ceil(tiles.length / COLS);
const SHEET_W = COLS * TILE_W;
const SHEET_H = ROWS * TILE_H;

// Create raw RGBA pixel buffer
const pixels = new Uint8Array(SHEET_W * SHEET_H * 4);

function setPixel(x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || x >= SHEET_W || y < 0 || y >= SHEET_H) return;
  const idx = (y * SHEET_W + x) * 4;
  pixels[idx] = r;
  pixels[idx + 1] = g;
  pixels[idx + 2] = b;
  pixels[idx + 3] = a;
}

function clamp(v: number): number { return Math.max(0, Math.min(255, Math.round(v))); }

function drawIsoDiamond(ox: number, oy: number, top: [number, number, number], left: [number, number, number], right: [number, number, number]) {
  const hw = TILE_W / 2;
  const hh = 16;
  const sideH = 16;

  // Top diamond face
  for (let dy = -hh; dy <= hh; dy++) {
    const halfWidth = Math.round(hw * (1 - Math.abs(dy) / hh));
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      const noise = (Math.sin(dx * 7.3 + dy * 13.1) * 0.5 + 0.5) * 12 - 6;
      setPixel(ox + hw + dx, oy + hh + dy, clamp(top[0] + noise), clamp(top[1] + noise * 0.8), clamp(top[2] + noise * 0.5));
    }
  }

  // Left side face
  for (let dy = 0; dy < sideH; dy++) {
    const fadeRatio = dy / sideH;
    for (let dx = 0; dx <= hw; dx++) {
      if (dx / hw <= 1 - fadeRatio) {
        const noise = (Math.sin(dx * 5.1 + dy * 9.7) * 0.5 + 0.5) * 8 - 4;
        setPixel(ox + dx, oy + hh * 2 + dy, clamp(left[0] + noise), clamp(left[1] + noise * 0.8), clamp(left[2] + noise * 0.5));
      }
    }
  }

  // Right side face
  for (let dy = 0; dy < sideH; dy++) {
    const fadeRatio = dy / sideH;
    for (let dx = 0; dx <= hw; dx++) {
      if (dx / hw <= 1 - fadeRatio) {
        const noise = (Math.sin(dx * 4.3 + dy * 11.2) * 0.5 + 0.5) * 8 - 4;
        setPixel(ox + TILE_W - 1 - dx, oy + hh * 2 + dy, clamp(right[0] + noise), clamp(right[1] + noise * 0.8), clamp(right[2] + noise * 0.5));
      }
    }
  }
}

// Draw all tiles
for (let i = 0; i < tiles.length; i++) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  drawIsoDiamond(col * TILE_W, row * TILE_H, tiles[i].topColor, tiles[i].leftColor, tiles[i].rightColor);
}

// Use Bun's built-in sharp-like API or write raw BMP that browsers can decode
// Actually, let's use a simple uncompressed BMP which all browsers handle perfectly
function writeBMP(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const rowBytes = width * 4;
  const pixelDataSize = rowBytes * height;
  const headerSize = 14 + 124; // BMP header + BITMAPV5HEADER
  const fileSize = headerSize + pixelDataSize;
  const buf = new Uint8Array(fileSize);
  const view = new DataView(buf.buffer);

  // BMP file header
  buf[0] = 0x42; buf[1] = 0x4D; // "BM"
  view.setUint32(2, fileSize, true);
  view.setUint32(10, headerSize, true);

  // BITMAPV5HEADER (124 bytes)
  view.setUint32(14, 124, true); // header size
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true); // negative = top-down
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 32, true); // bits per pixel
  view.setUint32(30, 3, true); // BI_BITFIELDS
  view.setUint32(34, pixelDataSize, true);
  view.setUint32(38, 2835, true); // x ppm
  view.setUint32(42, 2835, true); // y ppm
  // Color masks for BGRA
  view.setUint32(54, 0x00FF0000, true); // red mask
  view.setUint32(58, 0x0000FF00, true); // green mask
  view.setUint32(62, 0x000000FF, true); // blue mask
  view.setUint32(66, 0xFF000000, true); // alpha mask
  // LCS_sRGB
  view.setUint32(70, 0x73524742, true); // "sRGB"

  // Pixel data (BGRA order for BMP)
  let offset = headerSize;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      buf[offset++] = rgba[srcIdx + 2]; // B
      buf[offset++] = rgba[srcIdx + 1]; // G
      buf[offset++] = rgba[srcIdx];     // R
      buf[offset++] = rgba[srcIdx + 3]; // A
    }
  }

  return buf;
}

// Write as BMP (universally supported by browsers for Image/WebGL)
const bmpData = writeBMP(SHEET_W, SHEET_H, pixels);
const outPath = new URL("../public/tilesets/terrain.bmp", import.meta.url).pathname;
Bun.write(outPath, bmpData);
console.log(`Tileset written: ${outPath} (${SHEET_W}x${SHEET_H}, ${tiles.length} tiles, BMP format)`);

// Generate Tiled tileset JSON
const tilesetJson = {
  name: "terrain",
  tilewidth: TILE_W,
  tileheight: TILE_H,
  tilecount: tiles.length,
  columns: COLS,
  image: "terrain.bmp",
  imagewidth: SHEET_W,
  imageheight: SHEET_H,
  type: "tileset",
  version: "1.10",
  tiledversion: "1.11.0",
  tiles: tiles.map((t, i) => ({
    id: i,
    properties: [
      { name: "name", type: "string", value: t.name },
      { name: "walkable", type: "bool", value: t.walkable },
    ],
  })),
};

const tsjPath = new URL("../public/tilesets/terrain.tsj", import.meta.url).pathname;
Bun.write(tsjPath, JSON.stringify(tilesetJson, null, 2));
console.log(`Tileset JSON written: ${tsjPath}`);
