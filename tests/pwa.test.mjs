import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function pngDimensions(buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test("manifest defines the installable portrait app and peanutboy icons", async () => {
  const manifest = JSON.parse(await readFile("public/manifest.webmanifest", "utf8"));

  assert.equal(manifest.name, "らっかせい！");
  assert.equal(manifest.short_name, "らっかせい！");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "portrait");
  assert.equal(manifest.theme_color, "#9edcf2");
  assert.deepEqual(
    manifest.icons.map(({ src, sizes, purpose }) => ({ src, sizes, purpose })),
    [
      { src: "/pwa-192.png", sizes: "192x192", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", purpose: "any" },
      { src: "/pwa-maskable-512.png", sizes: "512x512", purpose: "maskable" },
    ],
  );
});

test("Vercel uses the Nitro build without overriding its Build Output API directory", async () => {
  const config = JSON.parse(await readFile("vercel.json", "utf8"));

  assert.equal(config.buildCommand, "npm run build:vercel");
  assert.equal("outputDirectory" in config, false);
});

test("PWA and social images have their declared dimensions", async () => {
  const expected = {
    "public/pwa-192.png": { width: 192, height: 192 },
    "public/pwa-512.png": { width: 512, height: 512 },
    "public/pwa-maskable-512.png": { width: 512, height: 512 },
    "public/apple-touch-icon.png": { width: 180, height: 180 },
    "public/favicon-32.png": { width: 32, height: 32 },
    "public/og.png": { width: 1731, height: 909 },
  };

  for (const [path, dimensions] of Object.entries(expected)) {
    assert.deepEqual(pngDimensions(await readFile(path)), dimensions, path);
  }
});

test("production build emits a service worker with game images and audio", async () => {
  const serviceWorker = await readFile("dist/client/sw.js", "utf8");
  const registration = await readFile("app/pwa-registration.tsx", "utf8");

  assert.match(serviceWorker, /manifest\.webmanifest/);
  assert.match(serviceWorker, /pwa-512\.png/);
  assert.match(serviceWorker, /background\.png/);
  assert.match(serviceWorker, /rakkasei_bgm_farmcute\.mp3/);
  assert.match(serviceWorker, /rotate_kuru\.wav/);
  assert.match(serviceWorker, /sw-install\.js/);
  assert.match(serviceWorker, /SKIP_WAITING/);
  const installWorker = await readFile("public/sw-install.js", "utf8");
  assert.match(installWorker, /addEventListener\("install"/);
  assert.match(installWorker, /caches\.open\("rakkasei-pages"\)/);
  assert.match(installWorker, /cache\.put\("\/"/);
  assert.doesNotMatch(registration, /postMessage|location\.reload/);
});
