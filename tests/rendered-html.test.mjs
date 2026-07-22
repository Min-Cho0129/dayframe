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
  assert.match(html, /daily planning app/i);
  assert.match(html, /Plan with AI/);
  assert.match(html, /Today&#x27;s tasks/);
  assert.match(html, /Today&#x27;s priority/);
  assert.match(html, /No priority selected yet/);
  assert.match(html, /Today&#x27;s schedule/);
  assert.match(html, /Daily timeline/);
  assert.match(html, /Add times to tasks to see the shape of your day/);
  assert.match(html, /Schedule open tasks/);
  assert.match(html, /Auto-space schedule/);
  assert.match(html, /Schedule check/);
  assert.match(html, /Add times to tasks to check conflicts and workload/);
  assert.match(html, /Habit tracker/);
  assert.match(html, /No habits yet/);
  assert.match(html, /Goals/);
  assert.match(html, /No goals yet/);
  assert.match(html, /Projects/);
  assert.match(html, /No projects yet/);
  assert.match(html, /Notes &amp; journal/);
  assert.match(html, /Evening reflection/);
  assert.match(html, /Planning memory/);
  assert.match(html, /Daily review for AI planning/);
  assert.match(html, /No carry-over items yet/);
  assert.match(html, /Sync validation has not run yet/);
  assert.match(html, /Validate sync now/);
  assert.match(html, /Daily quote/);
  assert.match(html, /Refreshes at local midnight/);
  assert.match(html, /Today&#x27;s momentum/);
  assert.match(html, /How momentum is calculated/);
  assert.match(html, /Energy recommendation/);
  assert.match(html, /Saved on this device/);
  assert.doesNotMatch(html, /Build a routine that restores energy and focus/);
  assert.doesNotMatch(html, /Portfolio refresh/);
  assert.doesNotMatch(html, /Drink water/);
  assert.doesNotMatch(html, /[가-힣]/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps starter preview code out of the app surface", async () => {
  const [
    page,
    layout,
    packageJson,
    syncRoute,
    syncContract,
    syncStorage,
    dbSchema,
    previewFiles,
  ] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../app/api/sync/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/sync-contract.js", import.meta.url), "utf8"),
      readFile(new URL("../app/sync-storage.js", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readdir(previewRoot),
    ]);

  assert.deepEqual(previewFiles, []);
  assert.match(page, /dayframe-app-v4/);
  assert.match(page, /dailyQuotes/);
  assert.match(page, /getDailyQuote/);
  assert.match(page, /getScheduleInsights/);
  assert.match(page, /getDailyTimeline/);
  assert.match(page, /getTimelineSegmentHeight/);
  assert.match(page, /scheduleOpenTasks/);
  assert.match(page, /findAvailableScheduleStart/);
  assert.match(page, /getDefaultScheduleStart/);
  assert.match(page, /compareScheduledTasks/);
  assert.match(page, /autoSpaceSchedule/);
  assert.match(page, /formatMinutesAsInputTime/);
  assert.match(page, /Time overlap/);
  assert.match(page, /Heavy plan/);
  assert.match(page, /generatePlan/);
  assert.match(page, /acceptGeneratedPlan/);
  assert.match(page, /startEditingTask/);
  assert.match(page, /saveTaskEdit/);
  assert.match(page, /task-edit-form/);
  assert.match(page, /updateGeneratedPlanTask/);
  assert.match(page, /removeGeneratedPlanTask/);
  assert.match(page, /Critical task/);
  assert.match(page, /buildPlanningPrompt/);
  assert.match(page, /planGuide/);
  assert.match(page, /planEnergy/);
  assert.match(page, /planEnergyOptions/);
  assert.match(page, /Energy for this plan/);
  assert.match(page, /Plan energy/);
  assert.match(page, /Fixed events/);
  assert.match(page, /Must do/);
  assert.match(page, /Would like/);
  assert.match(page, /Constraints/);
  assert.match(page, /Extra notes/);
  assert.match(page, /dayframe-memory-v1/);
  assert.match(page, /saveDailyReview/);
  assert.match(page, /summarizePlannerMemory/);
  assert.match(page, /getLocalDateKey/);
  assert.match(page, /useSyncExternalStore/);
  assert.match(page, /clearStaleDemoStorage/);
  assert.match(page, /syncCurrentSnapshot/);
  assert.match(page, /dayframe-device-id-v1/);
  assert.match(page, /Validate sync now/);
  assert.match(page, /\/api\/sync/);
  assert.match(syncRoute, /normalizeSyncPayload/);
  assert.match(syncRoute, /persistSyncSnapshot/);
  assert.match(syncContract, /contract-only/);
  assert.match(syncStorage, /UPSTASH_REDIS_REST_URL/);
  assert.match(syncStorage, /buildUpstashSyncCommands/);
  assert.match(syncStorage, /anonymousDeviceSync/);
  assert.match(dbSchema, /userProfiles/);
  assert.match(dbSchema, /dailyStates/);
  assert.match(dbSchema, /planningMemories/);
  assert.match(layout, /title:\s*"Dayframe"/);
  assert.doesNotMatch(page, /[가-힣]/);
  assert.doesNotMatch(layout, /[가-힣]/);
  assert.doesNotMatch(page, /SkeletonPreview|react-loading-skeleton|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
