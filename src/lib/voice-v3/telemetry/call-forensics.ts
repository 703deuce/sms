import "server-only";

import { clearCallerTurnManager } from "../conversation/caller-turn-manager";
import { deleteVoiceV3CallRuntime } from "../state/call-runtime";
import { clearCallerTurnTiming } from "./caller-turn-timing";

export type VoiceV3ForensicEvent = {
  kind: string;
  occurred_at_utc: string;
  /** Wall-clock ms (Node) or omitted when only monotonic is supplied from worker */
  occurred_at_ms?: number;
  monotonic_ms_from_call_start?: number;
  source: "node" | "python" | "merged";
  detail?: Record<string, unknown>;
};

export type VoiceV3CanonicalTurn = {
  turnKey: string;
  role: "user" | "assistant" | "system";
  sequence: number;
  text: string;
  conversationItemId?: string | null;
  committedVia?: string[];
  speech?: Record<string, unknown>;
  textAvailableAt?: string;
};

type SessionForensics = {
  callId: string;
  liveSessionId: string;
  workspaceId: string;
  agentId: string;
  startedAtMs: number;
  events: VoiceV3ForensicEvent[];
  canonicalTurns: Map<string, VoiceV3CanonicalTurn>;
  turnSequence: number;
  checkpointTimer: ReturnType<typeof setTimeout> | null;
  flushing: boolean;
};

const sessions = new Map<string, SessionForensics>();

const MAX_IN_MEMORY_EVENTS = 2_000;
const CHECKPOINT_DEBOUNCE_MS = 45_000;

const SECRET_KEY_RE =
  /token|secret|password|authorization|api[_-]?key|refresh|cookie|bearer/i;

/** Redact secrets in forensic detail; preserve conversational text fields. */
function sanitizeForensicDetail(
  detail: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 5) return { truncated: true };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (SECRET_KEY_RE.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (key === "text" || key === "transcript" || key === "utterance") {
      out[key] = value;
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeForensicDetail(value as Record<string, unknown>, depth + 1);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function sessionKey(liveSessionId: string): string {
  return liveSessionId.trim();
}

export function initVoiceV3CallForensics(input: {
  callId: string;
  liveSessionId: string;
  workspaceId: string;
  agentId: string;
}): void {
  const liveSessionId = sessionKey(input.liveSessionId);
  if (!liveSessionId) return;
  sessions.set(liveSessionId, {
    callId: input.callId.trim() || liveSessionId,
    liveSessionId,
    workspaceId: input.workspaceId.trim(),
    agentId: input.agentId.trim(),
    startedAtMs: Date.now(),
    events: [],
    canonicalTurns: new Map(),
    turnSequence: 0,
    checkpointTimer: null,
    flushing: false,
  });
}

export function appendVoiceV3ForensicEvent(
  liveSessionId: string,
  kind: string,
  detail?: Record<string, unknown>,
  source: "node" | "python" | "merged" = "node",
): void {
  const s = sessions.get(sessionKey(liveSessionId));
  if (!s) return;
  const occurred_at_ms = Date.now();
  const sanitized =
    detail && Object.keys(detail).length ? sanitizeForensicDetail(detail) : undefined;
  s.events.push({
    kind,
    occurred_at_utc: new Date(occurred_at_ms).toISOString(),
    occurred_at_ms,
    monotonic_ms_from_call_start: occurred_at_ms - s.startedAtMs,
    source,
    detail: sanitized,
  });
  if (s.events.length > MAX_IN_MEMORY_EVENTS) {
    s.events.splice(0, s.events.length - MAX_IN_MEMORY_EVENTS);
  }
  scheduleForensicsCheckpoint(liveSessionId);
}

export function mergeCanonicalConversationTurn(
  liveSessionId: string,
  input: {
    role: "user" | "assistant" | "system";
    text: string;
    conversationItemId?: string | null;
    committedVia: string;
    speech?: Record<string, unknown>;
    textAvailableAt?: string;
    turnKey?: string;
  },
): VoiceV3CanonicalTurn | null {
  const s = sessions.get(sessionKey(liveSessionId));
  if (!s) return null;
  const text = input.text.trim();
  if (!text) return null;

  const itemId = input.conversationItemId?.trim() || null;
  const turnKey =
    input.turnKey?.trim() ||
    itemId ||
    `${input.role}:${input.committedVia}:${s.turnSequence + 1}`;

  let row = s.canonicalTurns.get(turnKey);
  if (!row) {
    s.turnSequence += 1;
    row = {
      turnKey,
      role: input.role,
      sequence: s.turnSequence,
      text,
      conversationItemId: itemId,
      committedVia: [input.committedVia],
      speech: input.speech,
      textAvailableAt: input.textAvailableAt,
    };
    s.canonicalTurns.set(turnKey, row);
  } else {
    if (!row.committedVia.includes(input.committedVia)) {
      row.committedVia.push(input.committedVia);
    }
    if (text.length >= row.text.length) {
      row.text = text;
    }
    if (input.speech && Object.keys(input.speech).length) {
      row.speech = { ...(row.speech || {}), ...input.speech };
    }
    if (input.textAvailableAt) {
      row.textAvailableAt = input.textAvailableAt;
    }
  }
  return row;
}

export function snapshotVoiceV3CallForensics(liveSessionId: string): {
  callId: string;
  liveSessionId: string;
  workspaceId: string;
  agentId: string;
  events: VoiceV3ForensicEvent[];
  canonicalTurns: VoiceV3CanonicalTurn[];
} | null {
  const s = sessions.get(sessionKey(liveSessionId));
  if (!s) return null;
  const turns = [...s.canonicalTurns.values()].sort((a, b) => a.sequence - b.sequence);
  return {
    callId: s.callId,
    liveSessionId: s.liveSessionId,
    workspaceId: s.workspaceId,
    agentId: s.agentId,
    events: [...s.events],
    canonicalTurns: turns,
  };
}

function scheduleForensicsCheckpoint(liveSessionId: string): void {
  const s = sessions.get(sessionKey(liveSessionId));
  if (!s || s.flushing) return;
  if (s.checkpointTimer) return;
  s.checkpointTimer = setTimeout(() => {
    s.checkpointTimer = null;
    void flushVoiceV3ForensicsCheckpointAsync(liveSessionId, false);
  }, CHECKPOINT_DEBOUNCE_MS);
}

export function flushVoiceV3ForensicsCheckpointAsync(
  liveSessionId: string,
  final: boolean,
): void {
  const snap = snapshotVoiceV3CallForensics(liveSessionId);
  if (!snap) return;
  queueMicrotask(() => {
    void import("./forensics-persist")
      .then(({ persistVoiceV3ForensicsPackage }) =>
        persistVoiceV3ForensicsPackage({
          ...snap,
          final,
          reason: final ? "checkpoint_final" : "checkpoint",
        }),
      )
      .catch((err) => {
        console.error("VOICE_V3_FORENSICS_CHECKPOINT_FAILED", {
          live_session_id: liveSessionId,
          final,
          message: err instanceof Error ? err.message : String(err),
        });
      });
  });
}

export function finalizeVoiceV3CallForensics(
  liveSessionId: string,
  extra?: Record<string, unknown>,
): void {
  const id = sessionKey(liveSessionId);
  const s = sessions.get(id);
  if (!s) return;
  s.flushing = true;
  if (s.checkpointTimer) {
    clearTimeout(s.checkpointTimer);
    s.checkpointTimer = null;
  }
  appendVoiceV3ForensicEvent(id, "VOICE_V3_NODE_FORENSICS_FINALIZE_REQUESTED", extra);
  queueMicrotask(() => {
    void import("./forensics-persist")
      .then(async ({ persistVoiceV3ForensicsPackage, buildNodeForensicsAttachments }) => {
        const snap = snapshotVoiceV3CallForensics(id);
        if (!snap) return;
        const attachments = await buildNodeForensicsAttachments(id);
        await persistVoiceV3ForensicsPackage({
          ...snap,
          ...attachments,
          final: true,
          reason: "session_end",
        });
      })
      .catch((err) => {
        console.error("VOICE_V3_FORENSICS_FLUSH_FAILED", {
          live_session_id: id,
          message: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        clearCallerTurnManager(id);
        clearCallerTurnTiming(id);
        deleteVoiceV3CallRuntime(id);
        sessions.delete(id);
      });
  });
}

export function ingestPythonForensicEvents(input: {
  liveSessionId: string;
  callId?: string;
  workspaceId?: string;
  agentId?: string;
  events: VoiceV3ForensicEvent[];
}): void {
  const liveSessionId = sessionKey(input.liveSessionId);
  if (!liveSessionId) return;
  let s = sessions.get(liveSessionId);
  if (!s && input.callId && input.workspaceId && input.agentId) {
    initVoiceV3CallForensics({
      callId: input.callId,
      liveSessionId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
    });
    s = sessions.get(liveSessionId);
  }
  if (!s) return;
  for (const ev of input.events) {
    s.events.push({
      ...ev,
      source: ev.source || "python",
    });
    if (s.events.length > MAX_IN_MEMORY_EVENTS) {
      s.events.splice(0, s.events.length - MAX_IN_MEMORY_EVENTS);
    }
  }
}
