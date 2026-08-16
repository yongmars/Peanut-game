import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the title screen before the game starts", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  const headEnd = html.indexOf("</head>");
  const manifestLinks = html.match(/<link[^>]+rel="manifest"[^>]*>/g) ?? [];

  assert.match(html, /<title>らっかせい！/);
  assert.equal(manifestLinks.length, 1);
  assert.match(manifestLinks[0], /href="\/manifest\.webmanifest"/);
  assert.ok(headEnd > html.indexOf(manifestLinks[0]), "manifest link must be inside head");
  assert.match(html, /apple-touch-icon\.png/);
  assert.match(html, /name="mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /<script src="\/register-sw\.js" defer=""/);
  assert.match(html, /title\.png/);
  assert.match(html, /花をつなげて、地中でポコッ！/);
  assert.match(html, /BEST SCORE[\s\S]*0/);
  assert.match(html, /BEST HARVEST[\s\S]*0/);
  assert.match(html, /あそぶ/);
  assert.match(html, /peanutboy\.png/);
  assert.match(html, /rakkasei_bgm_farmcute\.mp3/);
  assert.match(html, /BGM[\s\S]*ON/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /あそびかた/);
  assert.doesNotMatch(html, /ゲームフィールド|ゲーム操作|高速落下/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
