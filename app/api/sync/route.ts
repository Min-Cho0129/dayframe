import { getSyncCapabilities, normalizeSyncPayload } from "../../sync-contract.js";
import { getChatGPTUser } from "../../chatgpt-auth";
import {
  describeSyncStorageReadiness,
  getSyncStorageConfig,
  persistSyncSnapshot,
} from "../../sync-storage.js";

export async function GET() {
  const user = await getChatGPTUser();
  const storage = describeSyncStorageReadiness({
    user,
    config: getSyncStorageConfig(),
  });

  return Response.json({
    sync: getSyncCapabilities({
      persisted: storage.persisted,
      storageProvider: storage.provider,
    }),
    account: user
      ? {
          authenticated: true,
          email: user.email,
          displayName: user.displayName,
        }
      : {
          authenticated: false,
          email: null,
          displayName: null,
        },
    storage,
    message:
      storage.ready
        ? "Dayframe sync storage is configured and ready for accepted payloads."
        : "Dayframe sync contract is ready. Configure storage and authentication to persist user data.",
  });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = normalizeSyncPayload(body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const { payload, sizeBytes } = result;
  if (!payload || typeof sizeBytes !== "number") {
    return Response.json({ error: "Invalid sync result." }, { status: 500 });
  }

  const user = await getChatGPTUser();
  let storage;

  try {
    storage = await persistSyncSnapshot({ payload, user });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Sync storage request failed.",
        sync: getSyncCapabilities({ storageProvider: "upstash-redis-rest" }),
      },
      { status: 502 },
    );
  }

  return Response.json({
    sync: {
      ...getSyncCapabilities({
        persisted: storage.persisted,
        storageProvider: storage.provider,
      }),
      accepted: true,
      sizeBytes,
    },
    account: user
      ? {
          authenticated: true,
          email: user.email,
          displayName: user.displayName,
        }
      : {
          authenticated: false,
          email: null,
          displayName: null,
        },
    storage,
    snapshot: {
      schemaVersion: payload.schemaVersion,
      dateKey: payload.dateKey,
      deviceId: payload.deviceId,
      savedAt: payload.savedAt,
    },
    message:
      storage.persisted
        ? "Sync payload accepted and stored."
        : "Sync payload accepted for validation. Persistence is disabled until storage and authentication are configured.",
  });
}
