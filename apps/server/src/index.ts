import { loadConfig } from "./config.js";
import { createPool } from "./db.js";
import { runMigrations } from "./migrate.js";
import { buildApp } from "./app.js";
import { SiteCache } from "./lib/sites.js";
import { GeoLookup } from "./lib/geo.js";
import { seedDemoData } from "./services/seed.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config);

  await runMigrations(pool, config.migrationsDir, (m) => console.info(`[migrate] ${m}`));

  const geo = new GeoLookup();
  await geo.init(config);

  if (config.seedDemo) {
    await seedDemoData(pool, (m) => console.info(`[seed] ${m}`));
  }

  const ctx = { config, pool, sites: new SiteCache(pool), geo };
  const app = await buildApp(ctx);

  await app.listen({ port: config.port, host: config.host });

  const shutdown = async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal startup error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
