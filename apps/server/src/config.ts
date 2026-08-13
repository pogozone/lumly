export interface ServerConfig {
  env: "production" | "development" | "test";
  port: number;
  host: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  appOrigin: string;
  cookieSecret: string;
  adminSetupToken: string | null;
  defaultRetentionDays: number;
  geoEnabled: boolean;
  geoDbPath: string | null;
  seedDemo: boolean;
  logLevel: string;
  dashboardDist: string;
  trackerDist: string;
  migrationsDir: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function loadConfig(): ServerConfig {
  const env = (process.env.NODE_ENV ?? "development") as ServerConfig["env"];
  const cookieSecret = process.env.COOKIE_SECRET ?? "";
  if (env === "production" && cookieSecret.length < 32) {
    throw new Error("COOKIE_SECRET must be set to at least 32 random characters in production");
  }
  return {
    env,
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? "0.0.0.0",
    database: {
      host: process.env.DATABASE_HOST ?? "127.0.0.1",
      port: Number(process.env.DATABASE_PORT ?? 3306),
      name: process.env.DATABASE_NAME ?? "lumly",
      user: process.env.DATABASE_USER ?? "lumly",
      password: process.env.DATABASE_PASSWORD ?? ""
    },
    appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
    cookieSecret: cookieSecret || "dev-only-insecure-secret-change-me!!",
    adminSetupToken: process.env.ADMIN_SETUP_TOKEN || null,
    defaultRetentionDays: Number(process.env.DEFAULT_RETENTION_DAYS ?? 90),
    geoEnabled: process.env.GEO_ENABLED === "true",
    geoDbPath: process.env.GEO_DB_PATH || null,
    seedDemo: process.env.SEED_DEMO === "true",
    logLevel: process.env.LOG_LEVEL ?? "info",
    dashboardDist: process.env.DASHBOARD_DIST ?? new URL("../../dashboard/dist", import.meta.url).pathname,
    trackerDist: process.env.TRACKER_DIST ?? new URL("../../../packages/tracker/dist", import.meta.url).pathname,
    migrationsDir: process.env.MIGRATIONS_DIR ?? new URL("../../../migrations", import.meta.url).pathname
  };
}
