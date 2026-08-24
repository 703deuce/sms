import { getLiveKitRoomClientForBackend } from "./client";
import { getLiveKitBackendConfig, isMediaBackendConfigured } from "./config";
import type {
  MediaBackend,
  MediaBackendHealthSnapshot,
  MediaBackendHealthStatus,
} from "./types";

const FAILURE_THRESHOLD = 3;
const RECOVERY_THRESHOLD = 5;

type Tracker = {
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastStatus: MediaBackendHealthStatus;
  lastCheckedAt: string;
};

const trackers = new Map<MediaBackend, Tracker>();

function getTracker(backend: MediaBackend): Tracker {
  const existing = trackers.get(backend);
  if (existing) return existing;
  const created: Tracker = {
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    lastStatus: "unavailable",
    lastCheckedAt: new Date(0).toISOString(),
  };
  trackers.set(backend, created);
  return created;
}

function deriveStatus(tracker: Tracker): MediaBackendHealthStatus {
  if (tracker.consecutiveFailures >= FAILURE_THRESHOLD) return "unavailable";
  if (tracker.consecutiveFailures > 0) return "degraded";
  if (tracker.consecutiveSuccesses >= RECOVERY_THRESHOLD) return "healthy";
  if (tracker.consecutiveSuccesses > 0) return "degraded";
  return tracker.lastStatus;
}

async function checkHttpsWss(url: string): Promise<{ ok: boolean; detail?: string }> {
  const httpsUrl = url.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
  try {
    const res = await fetch(httpsUrl, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    // LiveKit may return non-200 on root; TLS + DNS success is enough.
    return { ok: true, detail: `http_status_${res.status}` };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function probeMediaBackendHealth(
  backend: MediaBackend,
): Promise<MediaBackendHealthSnapshot> {
  const checkedAt = new Date().toISOString();
  const tracker = getTracker(backend);
  const checks: MediaBackendHealthSnapshot["checks"] = [];

  if (!isMediaBackendConfigured(backend)) {
    tracker.consecutiveFailures += 1;
    tracker.consecutiveSuccesses = 0;
    tracker.lastCheckedAt = checkedAt;
    tracker.lastStatus = "unavailable";
    checks.push({ name: "config", ok: false, detail: "not_configured" });
    return {
      backend,
      status: "unavailable",
      checkedAt,
      checks,
      consecutiveFailures: tracker.consecutiveFailures,
      consecutiveSuccesses: tracker.consecutiveSuccesses,
    };
  }

  const cfg = getLiveKitBackendConfig(backend);
  checks.push({ name: "config", ok: true });

  const tls = await checkHttpsWss(cfg.url);
  checks.push({ name: "https_wss", ok: tls.ok, detail: tls.detail });

  let apiOk = false;
  if (tls.ok) {
    try {
      const rooms = await getLiveKitRoomClientForBackend(backend).listRooms();
      apiOk = Array.isArray(rooms);
      checks.push({
        name: "livekit_api",
        ok: apiOk,
        detail: `rooms_${rooms.length}`,
      });
    } catch (err) {
      checks.push({
        name: "livekit_api",
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const allOk = checks.every((c) => c.ok);
  if (allOk) {
    tracker.consecutiveSuccesses += 1;
    tracker.consecutiveFailures = 0;
  } else {
    tracker.consecutiveFailures += 1;
    tracker.consecutiveSuccesses = 0;
  }

  tracker.lastCheckedAt = checkedAt;
  tracker.lastStatus = deriveStatus(tracker);

  return {
    backend,
    status: tracker.lastStatus,
    checkedAt,
    checks,
    consecutiveFailures: tracker.consecutiveFailures,
    consecutiveSuccesses: tracker.consecutiveSuccesses,
  };
}

export async function isMediaBackendHealthy(backend: MediaBackend): Promise<boolean> {
  const snapshot = await probeMediaBackendHealth(backend);
  return snapshot.status === "healthy";
}

export function resetMediaBackendHealthForTests() {
  trackers.clear();
}
