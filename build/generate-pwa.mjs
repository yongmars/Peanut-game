import { existsSync } from "node:fs";
import { generateSW } from "workbox-build";

const isVercelBuild =
  process.env.VERCEL === "1" ||
  process.env.NITRO_PRESET === "vercel";
const candidates = isVercelBuild
  ? [".output/public", ".vercel/output/static"]
  : ["dist/client"];
const outputDirectory = candidates.find((candidate) => existsSync(candidate));

if (!outputDirectory) {
  throw new Error(`PWA output directory was not found: ${candidates.join(", ")}`);
}

const result = await generateSW({
  cacheId: "rakkasei",
  globDirectory: outputDirectory,
  swDest: `${outputDirectory}/sw.js`,
  globPatterns: [
    "_next/static/**/*.{js,css,woff,woff2}",
    "*.{png,webp,webmanifest}",
    "register-sw.js",
    "music/rakkasei_bgm*.mp3",
    "music/sound effects/*.wav",
  ],
  globIgnores: ["sw.js", "workbox-*.js"],
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  importScripts: ["sw-install.js"],
  inlineWorkboxRuntime: true,
  skipWaiting: false,
  sourcemap: false,
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "rakkasei-pages",
        networkTimeoutSeconds: 3,
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
  ],
});

console.log(
  `PWA service worker generated in ${outputDirectory} (${result.count} files, ${result.size} bytes precached).`,
);
