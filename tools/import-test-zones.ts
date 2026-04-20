/**
 * Import Mana Seed sample maps as self-contained test zones.
 *
 * For each zone:
 *   1. Parse TMX to find all <tileset source="TSX files/foo.tsx">
 *   2. Copy TMX → /maps/test-zones/<id>/map.tmx (rewrite source paths to flat)
 *   3. For each referenced TSX: parse <image source="..."/>, copy TSX + image
 *      into /maps/test-zones/<id>/{foo.tsx, images/bar.png} (rewrite image path)
 *   4. Emit minimal server JSON at /maps/test-zones/<id>/map.json with a
 *      centre player spawn and all-walkable ground.
 *
 * Broken TSX image paths (e.g. "../../Unity Projects/...") are resolved by
 * searching the pack root for a file of the same basename.
 *
 * Run from repo root:   bun tools/import-test-zones.ts
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const MAPS_OUT  = resolve(REPO_ROOT, "packages/client/public/maps/test-zones");

interface ZoneSrc {
  id:        string;
  name:      string;
  packRoot:  string;   // for fallback image lookup
  tmxPath:   string;
  musicTag:  string;
}

const A = (p: string) => resolve(REPO_ROOT, "assets", p);

const ZONES: ZoneSrc[] = [
  {
    id: "summer-forest",
    name: "Summer Forest",
    packRoot: A("20.04c - Summer Forest 4.3"),
    tmxPath: A("20.04c - Summer Forest 4.3/sample map/summer forest sample map.tmx"),
    musicTag: "field",
  },
  {
    id: "summer-waterfall",
    name: "Summer Waterfall",
    packRoot: A("20.04c - Summer Forest 4.3"),
    tmxPath: A("20.04c - Summer Forest 4.3/sample map/summer forest waterfall demo.tmx"),
    musicTag: "field",
  },
  {
    id: "spring-forest",
    name: "Spring Forest",
    packRoot: A("20.05c - Spring Forest 4.3"),
    tmxPath: A("20.05c - Spring Forest 4.3/sample map/spring forest sample map.tmx"),
    musicTag: "field",
  },
  {
    id: "autumn-forest",
    name: "Autumn Forest",
    packRoot: A("20.06a - Autumn Forest 4.3"),
    tmxPath: A("20.06a - Autumn Forest 4.3/sample map/autumn forest sample map.tmx"),
    musicTag: "field",
  },
  {
    id: "winter-forest",
    name: "Winter Forest",
    packRoot: A("20.07a - Winter Forest 4.3"),
    tmxPath: A("20.07a - Winter Forest 4.3/sample map/winter forest sample map.tmx"),
    musicTag: "field",
  },
  {
    id: "thatch-home",
    name: "Thatch Roof Home",
    packRoot: A("20.01b - Thatch Roof Home 4.1"),
    tmxPath: A("20.01b - Thatch Roof Home 4.1/sample map/room sample.tmx"),
    musicTag: "town",
  },
  {
    id: "timber-home",
    name: "Timber Roof Home",
    packRoot: A("20.05a - Timber Roof Home 4.2"),
    tmxPath: A("20.05a - Timber Roof Home 4.2/sample map/room sample.tmx"),
    musicTag: "town",
  },
  {
    id: "half-timber-home",
    name: "Half-Timber Home",
    packRoot: A("21.04a - Half-Timber Home 4.2"),
    tmxPath: A("21.04a - Half-Timber Home 4.2/sample map/room sample.tmx"),
    musicTag: "town",
  },
  {
    id: "stonework-home",
    name: "Stonework Home",
    packRoot: A("22.09a - Stonework Home 3.2"),
    tmxPath: A("22.09a - Stonework Home 3.2/sample map/room sample.tmx"),
    musicTag: "town",
  },
];

function readText(p: string)                  { return readFileSync(p, "utf8"); }
function writeText(p: string, c: string)      { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, c); }
function decodeXml(s: string)                 { return s.replace(/&amp;/g, "&"); }

/** Walk `root` recursively, return first file whose basename === `name`. */
function findByBasename(root: string, name: string): string | null {
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      const hit = findByBasename(full, name);
      if (hit) return hit;
    } else if (entry === name) {
      return full;
    }
  }
  return null;
}

function importZone(src: ZoneSrc): void {
  console.log(`\n[${src.id}] ${src.name}`);
  console.log(`  src: ${src.tmxPath}`);

  const tmx    = readText(src.tmxPath);
  const tmxDir = dirname(src.tmxPath);
  const outDir = resolve(MAPS_OUT, src.id);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(resolve(outDir, "images"), { recursive: true });

  // --- 1. TSX refs in TMX
  const tsxRefs = [...tmx.matchAll(/source="([^"]+\.tsx)"/g)].map((m) => decodeXml(m[1]));
  console.log(`  TSXes: ${tsxRefs.length}`);

  // --- 2. Write TMX with flat source paths (basename only)
  let newTmx = tmx;
  for (const ref of tsxRefs) {
    const bn = basename(ref);
    // Escape & in the new name for the XML attr
    const bnXml  = bn.replace(/&/g, "&amp;");
    const refXml = ref.replace(/&/g, "&amp;");
    newTmx = newTmx.split(`source="${refXml}"`).join(`source="${bnXml}"`);
  }
  writeText(resolve(outDir, "map.tmx"), newTmx);

  // --- 3. Copy each TSX + its image
  for (const ref of tsxRefs) {
    const tsxPath = resolve(tmxDir, ref);
    if (!existsSync(tsxPath)) { console.warn(`  MISSING TSX: ${tsxPath}`); continue; }
    const tsx = readText(tsxPath);

    const imgM = tsx.match(/<image([^>]*?)source="([^"]+)"/);
    if (!imgM) { console.warn(`  no <image> in ${tsxPath}`); continue; }

    const imgRefRaw = decodeXml(imgM[2]);
    let imgPath = resolve(dirname(tsxPath), imgRefRaw);
    if (!existsSync(imgPath)) {
      const bn = basename(imgRefRaw);
      const found = findByBasename(src.packRoot, bn);
      if (found) {
        console.log(`    resolved ${bn} → ${found.replace(src.packRoot + "/", "")}`);
        imgPath = found;
      } else {
        console.warn(`  MISSING IMG: ${bn} (referenced by ${basename(tsxPath)})`);
        continue;
      }
    }

    const imgName    = basename(imgPath);
    const imgNameXml = imgName.replace(/&/g, "&amp;");
    // Rewrite the TSX's image path to images/<name>
    const newTsx = tsx.replace(
      /<image([^>]*?)source="[^"]+"/,
      `<image$1source="images/${imgNameXml}"`,
    );

    const tsxOutName = basename(ref);
    writeText(resolve(outDir, tsxOutName), newTsx);
    copyFileSync(imgPath, resolve(outDir, "images", imgName));
  }

  // --- 4. Minimal server JSON (all walkable, player spawn at centre)
  const dim = tmx.match(/width="(\d+)" height="(\d+)" tilewidth="(\d+)" tileheight="(\d+)"/);
  if (!dim) throw new Error(`Cannot parse dims from ${src.tmxPath}`);
  const w  = Number(dim[1]);
  const h  = Number(dim[2]);
  const tw = Number(dim[3]);
  const th = Number(dim[4]);
  const cells = w * h;
  const groundData    = new Array(cells).fill(1);
  const collisionData = new Array(cells).fill(0);
  const spawnTileX = Math.floor(w / 2);
  const spawnTileZ = Math.floor(h / 2);

  const serverJson = {
    compressionlevel: -1,
    height: h,
    infinite: false,
    layers: [
      {
        data: groundData, height: h, id: 1, name: "ground", opacity: 1,
        type: "tilelayer", visible: true, width: w, x: 0, y: 0,
      },
      {
        data: collisionData, height: h, id: 2, name: "collision", opacity: 1,
        type: "tilelayer", visible: true, width: w, x: 0, y: 0,
      },
      {
        draworder: "topdown", id: 3, name: "objects", opacity: 1,
        type: "objectgroup", visible: true, x: 0, y: 0,
        objects: [
          {
            class: "", height: th, id: 1, name: "player", rotation: 0,
            type: "spawn", visible: true, width: tw,
            x: spawnTileX * tw, y: spawnTileZ * th,
            properties: [{ name: "spawnType", type: "string", value: "player" }],
          },
        ],
      },
    ],
    nextlayerid: 4, nextobjectid: 2,
    orientation: "orthogonal", renderorder: "right-down",
    tiledversion: "1.11.0", tileheight: th, tilewidth: tw,
    tilesets: [] as unknown[],
    type: "map", version: "1.10", width: w,
  };
  writeText(resolve(outDir, "map.json"), JSON.stringify(serverJson));

  console.log(`  → ${outDir.replace(REPO_ROOT + "/", "")}  ${w}x${h} spawn=(${spawnTileX},${spawnTileZ})`);
}

console.log(`Importing ${ZONES.length} test zones → ${MAPS_OUT.replace(REPO_ROOT + "/", "")}`);
for (const zone of ZONES) {
  try { importZone(zone); }
  catch (err) { console.error(`  FAILED: ${(err as Error).message}`); }
}
console.log(`\nDone. Run painter: bun tools/import-test-zones.ts`);
