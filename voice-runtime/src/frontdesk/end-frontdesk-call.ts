import { llm, Toolset } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import { setTimeout as waitFor } from "node:timers/promises";
import type { FrontDeskUserData } from "./userdata";

const GOODBYE_PLAYOUT_TIMEOUT_MS = 15_000;
const GOODBYE_PLAYOUT_GRACE_MS = 300;

function logEndCall(event: string, callId: string, extra?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event,
      ts: Date.now(),
      callId,
      ...extra,
    }),
  );
}

/** Wait until assistant audio finishes before SIP disconnect. */
export async function waitForFrontDeskGoodbyePlayout(
  session: AgentSession<FrontDeskUserData>,
  options?: { timeoutMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? GOODBYE_PLAYOUT_TIMEOUT_MS;
  const start = Date.now();

  while (session.agentState === "speaking" && Date.now() - start < timeoutMs) {
    await waitFor(50);
  }

  await waitFor(GOODBYE_PLAYOUT_GRACE_MS);
}

export function buildFrontDeskEndCallToolset(extraDescription?: string) {
  const description = [
    "Ends the current call after the goodbye has finished playing.",
    "Call when the caller is clearly done (for example: that's all, thanks, goodbye).",
    "Say one brief farewell in the same turn, then call this tool.",
    extraDescription?.trim() || "",
  ]
    .filter(Boolean)
    .join(" ");

  return Toolset.create({
    id: "end_call",
    tools: [
      llm.tool({
        name: "end_call",
        description,
        execute: async (_args, { ctx }) => {
          const session = ctx.session as AgentSession<FrontDeskUserData>;
          const callId = session.userData.callId;

          if (session.userData.callClosing) {
            logEndCall("goodbye_duplicate_end_call", callId);
            return "Call is already ending. Remain silent.";
          }

          session.userData.callClosing = true;
          logEndCall("goodbye_started", callId);

          try {
            await ctx.waitForPlayout();
          } catch {
            // waitForPlayout may be unavailable — fall back to agent state polling.
          }

          await waitForFrontDeskGoodbyePlayout(session);
          logEndCall("goodbye_playout_finished", callId);

          logEndCall("sip_disconnect_started", callId);
          session.shutdown({ reason: "user_initiated" });

          return "Call ended. Remain completely silent.";
        },
      }),
    ],
  });
}
