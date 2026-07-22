const UPSTASH_URL_ENV = "UPSTASH_REDIS_REST_URL";
const UPSTASH_TOKEN_ENV = "UPSTASH_REDIS_REST_TOKEN";
const ANONYMOUS_SYNC_ENV = "DAYFRAME_ALLOW_ANONYMOUS_SYNC";
const STORAGE_PROVIDER = "upstash-redis-rest";

export function getSyncStorageConfig(env = getRuntimeEnv()) {
  const restUrl = cleanEnvText(env[UPSTASH_URL_ENV]);
  const token = cleanEnvText(env[UPSTASH_TOKEN_ENV]);
  const missingEnv = [];

  if (!restUrl) missingEnv.push(UPSTASH_URL_ENV);
  if (!token) missingEnv.push(UPSTASH_TOKEN_ENV);

  return {
    provider: STORAGE_PROVIDER,
    configured: missingEnv.length === 0,
    restUrl: restUrl.replace(/\/+$/, ""),
    token,
    missingEnv,
    allowAnonymousDeviceSync:
      cleanEnvText(env[ANONYMOUS_SYNC_ENV]).toLowerCase() === "true",
  };
}

export function describeSyncStorageReadiness({ user, config }) {
  if (!config.configured) {
    return {
      provider: config.provider,
      configured: false,
      ready: false,
      persisted: false,
      reason: "storage-env-missing",
      missingEnv: config.missingEnv,
      anonymousDeviceSync: false,
    };
  }

  const hasAccount = Boolean(user?.email);
  const ready = hasAccount || config.allowAnonymousDeviceSync;

  return {
    provider: config.provider,
    configured: true,
    ready,
    persisted: false,
    reason: ready ? "storage-ready" : "authentication-required",
    missingEnv: [],
    anonymousDeviceSync: config.allowAnonymousDeviceSync,
  };
}

export function resolveSyncSubject({ payload, user, allowAnonymousDeviceSync }) {
  const email = cleanEnvText(user?.email).toLowerCase();
  if (email) {
    const displayName =
      cleanEnvText(user?.displayName) || cleanEnvText(user?.fullName) || email;

    return {
      type: "account",
      id: stableKeyPart(email),
      displayName,
      email,
      keyPrefix: `dayframe:account:${stableKeyPart(email)}`,
    };
  }

  if (!allowAnonymousDeviceSync) return null;

  const deviceId = cleanEnvText(payload.deviceId);
  if (!deviceId) return null;

  return {
    type: "device",
    id: stableKeyPart(deviceId),
    displayName: "Local device",
    email: null,
    keyPrefix: `dayframe:device:${stableKeyPart(deviceId)}`,
  };
}

export function buildUpstashSyncCommands({ payload, subject }) {
  const savedAt = new Date().toISOString();
  const profile = {
    id: subject.id,
    type: subject.type,
    email: subject.email,
    displayName: subject.displayName,
    updatedAt: savedAt,
  };
  const dailyState = {
    schemaVersion: payload.schemaVersion,
    dateKey: payload.dateKey,
    deviceId: payload.deviceId,
    savedAt: payload.savedAt,
    syncedAt: savedAt,
    state: payload.state,
  };
  const memory = {
    schemaVersion: payload.schemaVersion,
    savedAt: payload.savedAt,
    syncedAt: savedAt,
    memory: payload.memory,
  };
  const latest = {
    dateKey: payload.dateKey,
    savedAt: payload.savedAt,
    syncedAt: savedAt,
    subjectType: subject.type,
  };

  return [
    ["SET", `${subject.keyPrefix}:profile`, JSON.stringify(profile)],
    ["SET", `${subject.keyPrefix}:days:${payload.dateKey}`, JSON.stringify(dailyState)],
    ["SET", `${subject.keyPrefix}:memory`, JSON.stringify(memory)],
    ["SADD", `${subject.keyPrefix}:day-index`, payload.dateKey],
    ["SET", `${subject.keyPrefix}:latest`, JSON.stringify(latest)],
  ];
}

export async function persistSyncSnapshot({
  payload,
  user,
  env = getRuntimeEnv(),
  fetchFn = fetch,
}) {
  const config = getSyncStorageConfig(env);
  const readiness = describeSyncStorageReadiness({ user, config });

  if (!readiness.ready) {
    return {
      ...readiness,
      persisted: false,
      keyCount: 0,
      subjectType: null,
      subjectId: null,
    };
  }

  const subject = resolveSyncSubject({
    payload,
    user,
    allowAnonymousDeviceSync: config.allowAnonymousDeviceSync,
  });

  if (!subject) {
    return {
      ...readiness,
      ready: false,
      persisted: false,
      reason: "sync-subject-missing",
      keyCount: 0,
      subjectType: null,
      subjectId: null,
    };
  }

  const commands = buildUpstashSyncCommands({ payload, subject });
  const response = await fetchFn(`${config.restUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getUpstashError(result) || "Sync storage request failed.");
  }

  if (
    !Array.isArray(result) ||
    result.some((item) => item && typeof item.error === "string")
  ) {
    throw new Error(getUpstashError(result) || "Sync storage command failed.");
  }

  return {
    provider: config.provider,
    configured: true,
    ready: true,
    persisted: true,
    reason: "persisted",
    missingEnv: [],
    anonymousDeviceSync: config.allowAnonymousDeviceSync,
    keyCount: commands.length,
    subjectType: subject.type,
    subjectId: subject.id,
  };
}

function getUpstashError(value) {
  if (value && typeof value.error === "string") return value.error;
  if (Array.isArray(value)) {
    const failed = value.find((item) => item && typeof item.error === "string");
    if (failed) return failed.error;
  }
  return "";
}

function cleanEnvText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getRuntimeEnv() {
  const runtimeProcess = globalThis.process;
  return runtimeProcess && typeof runtimeProcess === "object" && runtimeProcess.env
    ? runtimeProcess.env
    : {};
}

function stableKeyPart(value) {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return `${clean || "subject"}-${hashText(value)}`;
}

function hashText(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}
