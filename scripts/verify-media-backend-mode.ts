#!/usr/bin/env npx tsx
/** Verify MEDIA_BACKEND_MODE resolves and LiveKit API auth works. */
import { RoomServiceClient } from "livekit-server-sdk";
import { getActiveMediaBackend, getLiveKitBackendConfig, getMediaBackendMode } from "@/lib/voice/media-backend";

async function main() {
  const backend = getActiveMediaBackend();
  const cfg = getLiveKitBackendConfig(backend);
  const client = new RoomServiceClient(cfg.url, cfg.apiKey, cfg.apiSecret);
  const rooms = await client.listRooms();

  console.log(
    JSON.stringify(
      {
        mediaBackendMode: getMediaBackendMode(),
        resolvedBackend: backend,
        url: cfg.url,
        sipHost: cfg.sipHost,
        roomCount: rooms.length,
        ok: true,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
