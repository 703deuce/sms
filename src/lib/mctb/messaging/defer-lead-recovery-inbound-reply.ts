import { after } from "next/server";

/**
 * MCTB Lead Recovery can take 30–60s (semantic LLM + availability). Telnyx webhooks
 * must ACK quickly; run the SMS reply after the HTTP response via Next.js `after()`.
 */
export function deferMctbLeadRecoveryInboundReply(task: () => Promise<void>): void {
  if (process.env.MCTB_LR_INBOUND_SYNC === "1") {
    void task().catch((err) => {
      console.error("[mctb/defer-lr-inbound] sync task failed", err);
    });
    return;
  }
  after(() =>
    task().catch((err) => {
      console.error("[mctb/defer-lr-inbound] deferred task failed", err);
    }),
  );
}
