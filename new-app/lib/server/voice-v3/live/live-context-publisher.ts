/**
 * Centralized Live context injection (Phase 9).
 */

export type LiveContextSendFn = (event: { type: string; [key: string]: unknown }) => void;

export class LiveContextPublisher {
  constructor(private readonly send: LiveContextSendFn) {}

  appendThinking(content: string, delegationId: string | null = null): void {
    this.send({
      type: "session.thinking.append",
      content,
      delegation_id: delegationId,
    });
  }

  /** Verified facts appropriate for Live to communicate — not orchestration instructions. */
  appendCommentary(content: string, delegationId: string | null = null): void {
    this.send({
      type: "session.commentary.append",
      content,
      delegation_id: delegationId,
    });
  }
}
