import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { connectRedis, disconnectRedis } from "./db/redis.js";
import { spawnInitialNpcs, cleanup as cleanupNpcs } from "./game/npcs.js";
import { startGameLoop, stopGameLoop } from "./game/world.js";
import { initWorldMap, cacheWorldMapToRedis } from "./world/queries.js";
import { loadTiledMap, loadZoneMap } from "./world/tiled-map.js";
import { getAllZones } from "./game/zone-registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const app = await buildApp();

  await connectRedis();

  // Load Tiled maps for all registered zones
  const mapsDir = resolve(__dirname, "../../client/public/maps");
  const defaultMapPath = resolve(mapsDir, "starter.json");
  loadTiledMap(defaultMapPath); // Legacy default (backward compatible)
  for (const zone of getAllZones()) {
    try {
      loadZoneMap(zone.id, resolve(mapsDir, zone.mapFile));
    } catch (e) {
      console.warn(`[Boot] Could not load zone "${zone.id}" (${zone.mapFile}):`, (e as Error).message);
    }
  }

  // Generate world map from seed (deterministic, ~100-500ms)
  initWorldMap(config.world.seed);
  await cacheWorldMapToRedis();

  spawnInitialNpcs();
  startGameLoop();

  await app.listen({ host: config.server.host, port: config.server.port });

  const shutdown = async () => {
    stopGameLoop();
    cleanupNpcs();
    await disconnectRedis();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
