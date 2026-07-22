const SYNC_SCHEMA_VERSION = 1;
const MAX_SYNC_JSON_BYTES = 240_000;

export function getSyncCapabilities(options = {}) {
  const persisted = Boolean(options.persisted);

  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    mode: persisted ? "persisted" : "contract-only",
    persisted,
    storageProvider: cleanText(options.storageProvider, 60) || null,
    supports: ["daily-state", "planning-memory"],
  };
}

export function normalizeSyncPayload(value) {
  if (!isObject(value)) {
    return { ok: false, error: "Sync payload must be an object." };
  }

  const dateKey = cleanText(value.dateKey, 32);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { ok: false, error: "dateKey must use YYYY-MM-DD format." };
  }

  const deviceId = cleanText(value.deviceId, 80) || "local-device";
  const savedAt = cleanText(value.savedAt, 40) || `${dateKey}T00:00:00.000Z`;
  const state = isObject(value.state) ? value.state : null;
  const memory = isObject(value.memory) ? value.memory : null;

  if (!state) {
    return { ok: false, error: "state is required." };
  }
  if (!memory) {
    return { ok: false, error: "memory is required." };
  }

  const payload = {
    schemaVersion: SYNC_SCHEMA_VERSION,
    deviceId,
    dateKey,
    savedAt,
    state,
    memory,
  };
  const sizeBytes = new TextEncoder().encode(JSON.stringify(payload)).length;

  if (sizeBytes > MAX_SYNC_JSON_BYTES) {
    return {
      ok: false,
      error: `Sync payload is too large. Limit is ${MAX_SYNC_JSON_BYTES} bytes.`,
    };
  }

  return { ok: true, payload, sizeBytes };
}

function cleanText(value, maxLength) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return text.slice(0, maxLength);
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
