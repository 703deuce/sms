import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  loadExplicitDispatchForDid,
  mergeExplicitDispatchMetadata,
  parseDispatchAttributes,
  parseRoomMetadata,
  type RoomMetadata,
} from "@/lib/telephony/provisioning";
import {
  getPythonRuntimeBootstrapSnapshot,
  PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY,
  type PythonRuntimeBootstrapSnapshot,
} from "@/lib/voice/python-runtime-bridge/build-bootstrap-snapshot";
import type {
  PythonRuntimeBootstrapResult,
  PythonRuntimeError,
  ResolveDispatchSnapshotInput,
} from "./types";

function parseJobMetadata(raw: ResolveDispatchSnapshotInput["jobMetadata"]): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return raw;
}

function extractCallNumbers(
  attrs: Record<string, string>,
  meta: RoomMetadata | null,
  participantIdentity?: string,
): { fromE164?: string; toE164?: string } {
  const fromE164 =
    meta?.fromE164 ||
    attrs["sip.phoneNumber"] ||
    attrs.fromE164 ||
    attrs.callerNumber ||
    participantIdentity;

  const trunkNumber =
    attrs["sip.trunkPhoneNumber"] || attrs["sip.trunkNumber"] || attrs.trunkPhoneNumber;
  const toE164 =
    meta?.toE164 ||
    trunkNumber ||
    attrs["sip.calledNumber"] ||
    attrs.calledNumber ||
    attrs.toE164;

  return { fromE164, toE164 };
}

function snapshotFromRecord(raw: unknown): PythonRuntimeBootstrapSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const snap = raw as PythonRuntimeBootstrapSnapshot;
  if (snap.snapshotVersion !== 1 || snap.apiVersion !== 1) return null;
  if (!snap.workspaceId || !snap.agentId) return null;
  return snap;
}

function snapshotFromMetadataSources(
  jobMetaRaw: Record<string, unknown> | null,
  roomMeta: RoomMetadata | null,
  attrs: Record<string, string>,
): PythonRuntimeBootstrapSnapshot | null {
  const candidates: unknown[] = [
    jobMetaRaw?.[PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY],
    roomMeta && typeof roomMeta === "object"
      ? (roomMeta as Record<string, unknown>)[PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY]
      : undefined,
    attrs.pythonRuntimeBootstrapSnapshot,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        const snap = snapshotFromRecord(parsed);
        if (snap) return snap;
      } catch {
        continue;
      }
    }
    const snap = snapshotFromRecord(candidate);
    if (snap) return snap;
  }
  return null;
}

function buildBootstrapFromSnapshot(input: {
  snapshot: PythonRuntimeBootstrapSnapshot;
  fromE164?: string;
  toE164?: string;
  agentVersionId?: string;
  bootstrapPath: PythonRuntimeBootstrapResult["bootstrapPath"];
  bootstrapProfileMs?: number;
}): PythonRuntimeBootstrapResult {
  return {
    ok: true,
    apiVersion: 1,
    callId: "",
    workspaceId: input.snapshot.workspaceId,
    agentId: input.snapshot.agentId,
    agentVersionId: input.agentVersionId || input.snapshot.agentVersionId,
    callerE164: input.fromE164,
    toE164: input.toE164,
    timezone: input.snapshot.timezone,
    businessName: input.snapshot.businessName,
    runtimeProfile: input.snapshot.runtimeProfile,
    agentTemplate: input.snapshot.agentTemplate,
    agentTemplateVersion: input.snapshot.agentTemplateVersion,
    runtime: input.snapshot.runtime,
    receptionistCompiled: input.snapshot.receptionistCompiled,
    compiledPrompt: input.snapshot.compiledPrompt,
    greeting: input.snapshot.greeting,
    realtimeModel: input.snapshot.realtimeModel,
    realtimeVoice: input.snapshot.realtimeVoice,
    realtimeSpeed: input.snapshot.realtimeSpeed,
    eventTypeUri: input.snapshot.eventTypeUri,
    sipOutboundTrunkId: null,
    sipCallerIdE164: input.toE164 || null,
    bootstrapPath: input.bootstrapPath,
    bootstrapProfileMs: input.bootstrapProfileMs,
  };
}

/**
 * Fast inbound routing: one phoneNumber read (or zero when job metadata already carries snapshot).
 * Does NOT create voiceCall rows or resolve outbound SIP trunks.
 */
export async function resolveDispatchSnapshotForPython(
  input: ResolveDispatchSnapshotInput,
): Promise<PythonRuntimeBootstrapResult | PythonRuntimeError> {
  const started = Date.now();
  const attrs = input.participantAttributes || {};
  const roomMeta =
    typeof input.roomMetadata === "string"
      ? parseRoomMetadata(input.roomMetadata)
      : input.roomMetadata
        ? parseRoomMetadata(JSON.stringify(input.roomMetadata))
        : null;
  const jobMetaRaw = parseJobMetadata(input.jobMetadata);
  const jobMeta = jobMetaRaw
    ? parseDispatchAttributes(
        Object.fromEntries(
          Object.entries(jobMetaRaw).flatMap(([key, value]) =>
            value === undefined || value === null ? [] : [[key, String(value)]],
          ),
        ),
      )
    : null;

  const { fromE164, toE164 } = extractCallNumbers(attrs, roomMeta, input.participantIdentity);
  let normalizedTo = input.toE164?.trim() || toE164?.trim();
  if (normalizedTo) {
    try {
      normalizedTo = normalizeE164(normalizedTo);
    } catch {
      normalizedTo = normalizedTo.trim();
    }
  }

  const embeddedSnapshot = snapshotFromMetadataSources(jobMetaRaw, roomMeta, attrs);
  if (embeddedSnapshot) {
    const explicit = mergeExplicitDispatchMetadata(
      jobMeta ? { ...jobMeta, dispatchSource: "job_metadata" } : null,
      roomMeta ? { ...roomMeta, dispatchSource: "sip_metadata" } : null,
    );
    return buildBootstrapFromSnapshot({
      snapshot: embeddedSnapshot,
      fromE164: fromE164 || explicit?.fromE164,
      toE164: normalizedTo || explicit?.toE164,
      agentVersionId: explicit?.publishedVersionId,
      bootstrapPath: "dispatch_local",
      bootstrapProfileMs: Date.now() - started,
    });
  }

  const didDispatch = normalizedTo ? await loadExplicitDispatchForDid(normalizedTo) : null;
  const explicit = mergeExplicitDispatchMetadata(
    jobMeta ? { ...jobMeta, dispatchSource: "job_metadata" } : null,
    roomMeta ? { ...roomMeta, dispatchSource: "sip_metadata" } : null,
    didDispatch,
  );

  const storedSnapshot =
    didDispatch?.pythonRuntimeBootstrapSnapshot ||
    snapshotFromRecord(
      didDispatch &&
        typeof didDispatch === "object" &&
        PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY in didDispatch
        ? (didDispatch as Record<string, unknown>)[PYTHON_RUNTIME_BOOTSTRAP_SNAPSHOT_KEY]
        : null,
    );

  if (storedSnapshot) {
    return buildBootstrapFromSnapshot({
      snapshot: storedSnapshot,
      fromE164: fromE164 || explicit?.fromE164,
      toE164: normalizedTo || explicit?.toE164 || didDispatch?.toE164,
      agentVersionId: explicit?.publishedVersionId || didDispatch?.publishedVersionId,
      bootstrapPath: "dispatch_snapshot",
      bootstrapProfileMs: Date.now() - started,
    });
  }

  if (explicit?.workspaceId && explicit.agentId) {
    const { loadVoiceAgentConfigForCall } = await import("@/lib/voice/real-estate/publish");
    const loaded = await loadVoiceAgentConfigForCall({
      workspaceId: explicit.workspaceId,
      agentId: explicit.agentId,
      agentVersionId: explicit.publishedVersionId,
    });
    const snapshot = getPythonRuntimeBootstrapSnapshot(
      loaded.config.advanced as Record<string, unknown> | undefined,
    );
    if (snapshot) {
      return buildBootstrapFromSnapshot({
        snapshot,
        fromE164: fromE164 || explicit.fromE164,
        toE164: normalizedTo || explicit.toE164,
        agentVersionId: explicit.publishedVersionId || loaded.agentVersionId || undefined,
        bootstrapPath: "dispatch_snapshot",
        bootstrapProfileMs: Date.now() - started,
      });
    }
  }

  return {
    ok: false,
    error: normalizedTo
      ? `No dispatch snapshot for ${normalizedTo}`
      : "Missing called number and dispatch metadata",
    code: "DISPATCH_SNAPSHOT_NOT_FOUND",
  };
}
