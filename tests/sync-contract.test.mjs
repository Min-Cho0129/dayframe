import assert from "node:assert/strict";
import test from "node:test";
import {
  getSyncCapabilities,
  normalizeSyncPayload,
} from "../app/sync-contract.js";

test("describes the current sync contract capabilities", () => {
  const capabilities = getSyncCapabilities();

  assert.equal(capabilities.schemaVersion, 1);
  assert.equal(capabilities.mode, "contract-only");
  assert.equal(capabilities.persisted, false);
  assert.equal(capabilities.storageProvider, null);
  assert.deepEqual(capabilities.supports, ["daily-state", "planning-memory"]);
});

test("normalizes a valid sync payload", () => {
  const result = normalizeSyncPayload({
    deviceId: "browser-1",
    dateKey: "2026-07-22",
    savedAt: "2026-07-22T09:00:00.000Z",
    state: {
      focus: "Ship the first server sync contract.",
      tasks: [],
    },
    memory: {
      entries: [],
      carryOverTasks: [],
      patterns: [],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.schemaVersion, 1);
  assert.equal(result.payload.deviceId, "browser-1");
  assert.equal(result.payload.dateKey, "2026-07-22");
  assert.ok(result.sizeBytes > 0);
});

test("rejects sync payloads without a local date key", () => {
  const result = normalizeSyncPayload({
    dateKey: "07/22/2026",
    state: {},
    memory: {},
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /YYYY-MM-DD/);
});
