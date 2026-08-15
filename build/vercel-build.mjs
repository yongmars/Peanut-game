import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.env.NITRO_PRESET = "vercel";

const viteCli = fileURLToPath(
  new URL("../node_modules/vite/bin/vite.js", import.meta.url),
);
const result = spawnSync(process.execPath, [viteCli, "build"], {
  env: process.env,
  stdio: "inherit",
});

if (result.status !== 0) {
  throw new Error(`Vercel Vite build failed with exit code ${result.status}`);
}

await import("./generate-pwa.mjs");
