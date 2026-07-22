import { getSyncCapabilities, normalizeSyncPayload } from "../../sync-contract.js";

export async function GET() {
  return Response.json({
    sync: getSyncCapabilities(),
    message:
      "Dayframe sync contract is ready. Add authentication and a database adapter to persist user data.",
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

  return Response.json({
    sync: {
      ...getSyncCapabilities(),
      accepted: true,
      sizeBytes,
    },
    snapshot: {
      schemaVersion: payload.schemaVersion,
      dateKey: payload.dateKey,
      deviceId: payload.deviceId,
      savedAt: payload.savedAt,
    },
    message:
      "Sync payload accepted for validation. Persistence is disabled until auth and database storage are configured.",
  });
}
