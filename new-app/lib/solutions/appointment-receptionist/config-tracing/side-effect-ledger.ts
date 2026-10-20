import { receptionistLog } from "./log";

export type LiveSideEffectKind =
  | "livekit_publish"
  | "telnyx_sync"
  | "published_version_mutation"
  | "active_phone_routing_change"
  | "live_transfer_destination_mutation"
  | "workflow_deployment"
  | "runtime_tool_permission_change"
  | "activate_hooks"
  | "workflow_compile"
  | "build_agent_config";

/** In-memory compile/logging on Save Draft — not live provider or published-version mutation. */
const DRAFT_SAVE_ALLOWED_SIDE_EFFECTS: ReadonlySet<LiveSideEffectKind> = new Set([
  "build_agent_config",
]);

export class ReceptionistSideEffectLedger {
  private readonly traceId: string;
  private readonly isDraftSave: boolean;
  private readonly effects: LiveSideEffectKind[] = [];

  constructor(traceId: string, isDraftSave: boolean) {
    this.traceId = traceId;
    this.isDraftSave = isDraftSave;
  }

  record(kind: LiveSideEffectKind, detail?: Record<string, unknown>): void {
    this.effects.push(kind);
    receptionistLog("SIDE_EFFECT", this.isDraftSave ? "RECORDED" : "RECORDED", {
      trace: this.traceId,
      kind,
      draftSave: this.isDraftSave,
      ...detail,
    });
    if (this.isDraftSave && !DRAFT_SAVE_ALLOWED_SIDE_EFFECTS.has(kind)) {
      receptionistLog("SIDE_EFFECT", "UNEXPECTED_LIVE_EFFECT", {
        trace: this.traceId,
        kind,
        draftSave: true,
        ...detail,
      });
    }
  }

  list(): LiveSideEffectKind[] {
    return [...this.effects];
  }

  unexpectedCountForDraftSave(): number {
    if (!this.isDraftSave) return 0;
    return this.effects.filter((k) => !DRAFT_SAVE_ALLOWED_SIDE_EFFECTS.has(k)).length;
  }
}

export type AgentLiveSnapshot = {
  status: string | null;
  publishedVersionId: string | null;
  phoneNumberId: string | null;
  draftRevision: number | null;
};

export function detectSnapshotDrift(
  before: AgentLiveSnapshot,
  after: AgentLiveSnapshot,
): string[] {
  const drift: string[] = [];
  if (before.publishedVersionId !== after.publishedVersionId) {
    drift.push("publishedVersionId");
  }
  if (before.phoneNumberId !== after.phoneNumberId) {
    drift.push("phoneNumberId");
  }
  if (before.status !== after.status && after.status === "ACTIVE" && before.status === "ACTIVE") {
    drift.push("status");
  }
  return drift;
}
