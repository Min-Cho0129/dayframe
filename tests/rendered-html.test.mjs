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
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>하루 시작<\/title>/i);
  assert.match(html, /아침 생산성 앱/);
  assert.match(html, /오늘 할 일/);
  assert.match(html, /습관 추적/);
  assert.match(html, /목표 설정/);
  assert.match(html, /프로젝트 관리/);
  assert.match(html, /노트 &amp; 저널/);
  assert.match(html, /오늘의 추진력/);
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
  assert.match(page, /haru-start-app-v1/);
  assert.match(page, /useSyncExternalStore/);
  assert.match(layout, /title:\s*"하루 시작"/);
  assert.doesNotMatch(page, /SkeletonPreview|react-loading-skeleton|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
