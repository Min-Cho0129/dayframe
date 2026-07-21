import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../gh-pages-dist/", import.meta.url);

test("builds a static GitHub Pages app", async () => {
  const [html, files, assetFiles] = await Promise.all([
    readFile(new URL("index.html", outputRoot), "utf8"),
    readdir(outputRoot),
    readdir(new URL("assets/", outputRoot)),
  ]);

  assert.match(html, /<title>Dayframe<\/title>/);
  assert.match(html, /morning productivity dashboard/i);
  assert.match(html, /type="module"/);
  assert.match(html, /href="\.\/favicon\.svg"/);
  assert.ok(files.includes("favicon.svg"));
  assert.ok(assetFiles.some((file) => file.endsWith(".js")));
  assert.ok(assetFiles.some((file) => file.endsWith(".css")));
  assert.doesNotMatch(html, /chatgpt\.site|cloudflare|wrangler/i);
  assert.doesNotMatch(html, /[가-힣]/);
});
