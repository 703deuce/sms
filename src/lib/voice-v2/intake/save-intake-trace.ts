/** Observability-only phase marks for save-intake (no behavior change). */

export type SaveIntakeTracePhase =
  | "REQUEST_RECEIVED"
  | "CALL_CONTEXT_LOOKUP_START"
  | "CALL_CONTEXT_LOOKUP_END"
  | "CONFIG_LOAD_START"
  | "CONFIG_LOAD_END"
  | "CONFIG_COMPILE_START"
  | "CONFIG_COMPILE_END"
  | "BOOKING_CFG_LOAD_START"
  | "BOOKING_CFG_LOAD_END"
  | "SESSION_CREATE_START"
  | "SESSION_CREATE_END"
  | "VALIDATION_START"
  | "VALIDATION_END"
  | "STATE_UPDATE_START"
  | "STATE_UPDATE_END"
  | "WORKFLOW_TRANSITION_START"
  | "WORKFLOW_TRANSITION_END"
  | "PERSIST_SCHEDULED"
  | "RESPONSE_SERIALIZED";

export type SaveIntakeTraceMark = {
  phase: SaveIntakeTracePhase;
  atMs: number;
  detail?: Record<string, unknown>;
};

export class SaveIntakeTrace {
  private readonly t0 = Date.now();
  private readonly marks: SaveIntakeTraceMark[] = [];

  mark(phase: SaveIntakeTracePhase, detail?: Record<string, unknown>): void {
    this.marks.push({ phase, atMs: Date.now() - this.t0, detail });
  }

  spanMs(start: SaveIntakeTracePhase, end: SaveIntakeTracePhase): number | null {
    const a = this.marks.find((m) => m.phase === start);
    const b = this.marks.find((m) => m.phase === end);
    if (!a || !b) return null;
    return b.atMs - a.atMs;
  }

  toJSON(): {
    marks: SaveIntakeTraceMark[];
    spans_ms: Record<string, number | null>;
    save_sequence_hint: number;
  } {
    return {
      marks: this.marks,
      spans_ms: {
        call_context_lookup: this.spanMs("CALL_CONTEXT_LOOKUP_START", "CALL_CONTEXT_LOOKUP_END"),
        config_load: this.spanMs("CONFIG_LOAD_START", "CONFIG_LOAD_END"),
        config_compile: this.spanMs("CONFIG_COMPILE_START", "CONFIG_COMPILE_END"),
        booking_cfg_load: this.spanMs("BOOKING_CFG_LOAD_START", "BOOKING_CFG_LOAD_END"),
        session_create: this.spanMs("SESSION_CREATE_START", "SESSION_CREATE_END"),
        validation: this.spanMs("VALIDATION_START", "VALIDATION_END"),
        state_update: this.spanMs("STATE_UPDATE_START", "STATE_UPDATE_END"),
        workflow_transition: this.spanMs("WORKFLOW_TRANSITION_START", "WORKFLOW_TRANSITION_END"),
      },
      save_sequence_hint: 0,
    };
  }
}
