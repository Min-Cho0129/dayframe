import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUpstashSyncCommands,
  describeSyncStorageReadiness,
  getSyncStorageConfig,
  persistSyncSnapshot,
  resolveSyncSubject,
} from "../app/sync-storage.js";

const payload = {
  schemaVersion: 1,
  deviceId: "browser-test-device",
  dateKey: "2026-07-22",
  savedAt: "2026-07-22T12:00:00.000Z",
  state: {
    focus: "Make sync persistence possible.",
    tasks: [],
  },
  memory: {
    entries: [],
    carryOverTasks: [],
    patterns: [],
  },
};

test("reports missing Upstash storage env", () => {
  const config = getSyncStorageConfig({});
  const readiness = describeSyncStorageReadiness({ user: null, config });

  assert.equal(config.configured, false);
  assert.deepEqual(config.missingEnv, [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.reason, "storage-env-missing");
});

test("resolves account sync subjects before anonymous device subjects", () => {
  const subject = resolveSyncSubject({
    payload,
    allowAnonymousDeviceSync: true,
    user: {
      email: "Min@example.com",
      displayName: "Min",
    },
  });

  assert.equal(subject.type, "account");
  assert.match(subject.id, /^min-example-com-/);
  assert.equal(subject.email, "min@example.com");
  assert.match(subject.keyPrefix, /^dayframe:account:min-example-com-/);
});

test("builds Upstash pipeline commands for a sync snapshot", () => {
  const subject = resolveSyncSubject({
    payload,
    allowAnonymousDeviceSync: true,
    user: null,
  });
  const commands = buildUpstashSyncCommands({ payload, subject });

  assert.equal(commands.length, 5);
  assert.deepEqual(commands.map((command) => command[0]), [
    "SET",
    "SET",
    "SET",
    "SADD",
    "SET",
  ]);
  assert.match(commands[1][1], /:days:2026-07-22$/);
  assert.match(commands[2][1], /:memory$/);
  assert.match(commands[3][1], /:day-index$/);
  assert.match(commands[1][2], /Make sync persistence possible/);
});

test("persists through Upstash REST when storage is configured", async () => {
  let capturedUrl = "";
  let capturedBody = "";

  const result = await persistSyncSnapshot({
    payload,
    user: {
      email: "min@example.com",
      displayName: "Min",
    },
    env: {
      UPSTASH_REDIS_REST_URL: "https://dayframe-upstash.example.com/",
      UPSTASH_REDIS_REST_TOKEN: "secret-token",
    },
    fetchFn: async (url, init) => {
      capturedUrl = String(url);
      capturedBody = String(init.body);

      return new Response(
        JSON.stringify([
          { result: "OK" },
          { result: "OK" },
          { result: "OK" },
          { result: 1 },
          { result: "OK" },
        ]),
        { status: 200 },
      );
    },
  });

  assert.equal(result.persisted, true);
  assert.equal(result.provider, "upstash-redis-rest");
  assert.equal(result.keyCount, 5);
  assert.equal(result.subjectType, "account");
  assert.equal(capturedUrl, "https://dayframe-upstash.example.com/pipeline");
  assert.match(capturedBody, /dayframe:account:min-example-com-/);
});
