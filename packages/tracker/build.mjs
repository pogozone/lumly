import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

const common = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  target: ["es2019"],
  logLevel: "info"
};

// ESM library build (npm package).
await build({
  ...common,
  format: "esm",
  outfile: "dist/index.js",
  minify: false
});

// IIFE autoload build served as /tracker.js.
await build({
  ...common,
  entryPoints: ["src/autoload.ts"],
  format: "iife",
  outfile: "dist/tracker.js"
});

// Type declarations.
const { execSync } = await import("node:child_process");
execSync("tsc -p tsconfig.build.json", { stdio: "inherit" });

const size = gzipSync(readFileSync("dist/tracker.js")).length;
writeFileSync("dist/size.json", JSON.stringify({ trackerGzipBytes: size }, null, 2));
console.log(`tracker.js gzip: ${size} bytes (target <= 8192, hard limit 12288)`);
if (size > 12288) {
  console.error("tracker.js exceeds the 12 kB hard limit");
  process.exit(1);
}
