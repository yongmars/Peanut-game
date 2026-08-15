import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("Nitro emits a complete Vercel Build Output API package", async () => {
  const config = JSON.parse(await readFile(".vercel/output/config.json", "utf8"));

  assert.equal(config.version, 3);
  assert.equal(config.framework.name, "nitro");
  assert.equal(config.routes.at(-1).dest, "/__server");
  const swRule = config.routes.find((route) => route.src === "/sw.js");
  const manifestRule = config.routes.find(
    (route) => route.src === "/manifest.webmanifest",
  );
  assert.equal(swRule.headers["cache-control"], "no-cache, no-store, must-revalidate");
  assert.equal(manifestRule.headers["content-type"], "application/manifest+json");

  await Promise.all([
    access(".vercel/output/functions/__server.func/index.mjs"),
    access(".vercel/output/static/sw.js"),
    access(".vercel/output/static/sw-install.js"),
    access(".vercel/output/static/register-sw.js"),
    access(".vercel/output/static/manifest.webmanifest"),
    access(".vercel/output/static/pwa-192.png"),
    access(".vercel/output/static/pwa-512.png"),
    access(".vercel/output/static/og.png"),
    access(".vercel/output/static/music/rakkasei_bgm_farmcute.mp3"),
    access(".vercel/output/static/music/rakkasei_bgm.mp3"),
    access(".vercel/output/static/music/sound effects/game_over_pororon.wav"),
  ]);
});
