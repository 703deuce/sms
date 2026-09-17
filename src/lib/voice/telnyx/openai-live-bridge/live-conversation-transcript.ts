/**
 * Rolling caller/Amy transcript from Live streaming deltas (bridge-local).
 * Used to hydrate the Responses backend on delegation — not resent every audio turn.
 */

export type TranscriptRole = "caller" | "amy";

type Segment = {
  role: TranscriptRole;
  text: string;
};

export class LiveConversationTranscript {
  private segments: Segment[] = [];
  private open: Segment | null = null;
  /** Index into `segments` — transcript before this was already sent to delegation. */
  private delegationCursor = 0;

  appendDelta(role: TranscriptRole, delta: string) {
    if (!delta) return;
    if (!this.open || this.open.role !== role) {
      if (this.open && this.open.text.trim()) {
        this.segments.push({ ...this.open });
      }
      this.open = { role, text: delta };
      return;
    }
    this.open.text += delta;
  }

  /** Finalize open segment into history (e.g. before formatting). */
  flushOpen() {
    if (this.open && this.open.text.trim()) {
      this.segments.push({ ...this.open });
    }
    this.open = null;
  }

  /**
   * Transcript chunk for this delegation episode: new lines since last delegation.
   * If nothing new, returns empty string (structured state may still matter).
   */
  formatSinceLastDelegation(): string {
    this.flushOpen();
    const slice = this.segments.slice(this.delegationCursor);
    if (slice.length === 0) return "";
    return slice
      .map((s) => `${s.role === "caller" ? "Caller" : "Amy"}: ${s.text.trim()}`)
      .join("\n");
  }

  /** Full transcript for short calls / first delegation when cursor is 0. */
  formatFull(): string {
    this.flushOpen();
    return this.segments
      .map((s) => `${s.role === "caller" ? "Caller" : "Amy"}: ${s.text.trim()}`)
      .join("\n");
  }

  markDelegationCheckpoint() {
    this.flushOpen();
    this.delegationCursor = this.segments.length;
  }

  segmentCount(): number {
    return this.segments.length + (this.open ? 1 : 0);
  }

  delegationCursorIndex(): number {
    return this.delegationCursor;
  }
}
