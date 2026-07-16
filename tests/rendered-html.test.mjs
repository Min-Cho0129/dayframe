import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the morning productivity app", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="en">/i);
  assert.match(html, /<title>Dayframe<\/title>/i);
  assert.match(html, /morning productivity dashboard/i);
  assert.match(html, /Today&#x27;s tasks/);
  assert.match(html, /Habit tracker/);
  assert.match(html, /Goals/);
  assert.match(html, /Projects/);
  assert.match(html, /Notes &amp; journal/);
  assert.match(html, /Daily quote/);
  assert.match(html, /Refreshes every day/);
  assert.match(html, /Today&#x27;s momentum/);
  assert.doesNotMatch(html, /[가-힣]/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps starter preview code out of the app surface", async () => {
  const [page, layout, packageJson, previewFiles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readdir(previewRoot),
  ]);

  assert.deepEqual(previewFiles, []);
  assert.match(page, /dayframe-app-v2/);
  assert.match(page, /dailyQuotes/);
  assert.match(page, /getDailyQuote/);
  assert.match(page, /useSyncExternalStore/);
  assert.match(layout, /title:\s*"Dayframe"/);
  assert.doesNotMatch(page, /[가-힣]/);
  assert.doesNotMatch(layout, /[가-힣]/);
  assert.doesNotMatch(page, /SkeletonPreview|react-loading-skeleton|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
