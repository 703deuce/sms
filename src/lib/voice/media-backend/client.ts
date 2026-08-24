import { RoomServiceClient, SipClient } from "livekit-server-sdk";
import type { MediaBackend } from "./types";
import { getLiveKitBackendConfig } from "./config";

const sipClients = new Map<MediaBackend, SipClient>();
const roomClients = new Map<MediaBackend, RoomServiceClient>();

export function getLiveKitSipClientForBackend(backend: MediaBackend): SipClient {
  const existing = sipClients.get(backend);
  if (existing) return existing;

  const cfg = getLiveKitBackendConfig(backend);
  const client = new SipClient(cfg.url, cfg.apiKey, cfg.apiSecret);
  sipClients.set(backend, client);
  return client;
}

export function getLiveKitRoomClientForBackend(
  backend: MediaBackend,
): RoomServiceClient {
  const existing = roomClients.get(backend);
  if (existing) return existing;

  const cfg = getLiveKitBackendConfig(backend);
  const client = new RoomServiceClient(cfg.url, cfg.apiKey, cfg.apiSecret);
  roomClients.set(backend, client);
  return client;
}

export function resetLiveKitClientsForTests() {
  sipClients.clear();
  roomClients.clear();
}
