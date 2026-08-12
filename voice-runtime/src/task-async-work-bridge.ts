import type { AgentSession } from "@livekit/agents";
import { deliverScriptedSpeech } from "./outbound/scripted-speech";

export type BridgeSpeechOptions = {
  allowInterruptions?: boolean;
  addToChatCtx?: boolean;
};

type BridgeUserData = {
  asyncWorkBridgeDelivered?: boolean;
};

/**
 * LiveKit-aligned bridge for slow tool / provider IO while the caller stays engaged.
 *
 * Pattern: healthcare `session.say()` before WarmTransferTask; hold audio during connect.
 * Here we start async work immediately and speak the bridge in parallel so network latency
 * is absorbed while the caller hears progress — then await the work after playout ends.
 *
 * Use for any AgentTask handoff into slow parent work (email → Calendly, cancel, reschedule).
 */
export async function runAsyncWorkWithBridge<T, R>(
  session: AgentSession<T>,
  bridgeLine: string,
  work: () => Promise<R>,
  options?: BridgeSpeechOptions,
): Promise<R> {
  const ud = session.userData as BridgeUserData;
  if (ud.asyncWorkBridgeDelivered) {
    ud.asyncWorkBridgeDelivered = false;
    return await work();
  }

  const workPromise = work();
  const trimmed = bridgeLine.trim();
  if (trimmed) {
    await deliverScriptedSpeech(session, trimmed, {
      allowInterruptions: options?.allowInterruptions ?? true,
      addToChatCtx: options?.addToChatCtx ?? true,
    });
  }
  return await workPromise;
}

/**
 * Speak a bridge line with full playout before AgentTask.complete() resumes the parent.
 * Parent should call runAsyncWorkWithBridge with the same line — it skips duplicate speech.
 */
export async function speakBeforeTaskHandoff<T>(
  session: AgentSession<T>,
  bridgeLine: string,
  options?: BridgeSpeechOptions,
): Promise<void> {
  const trimmed = bridgeLine.trim();
  if (!trimmed) return;
  await deliverScriptedSpeech(session, trimmed, {
    allowInterruptions: options?.allowInterruptions ?? true,
    addToChatCtx: options?.addToChatCtx ?? true,
  });
  (session.userData as BridgeUserData).asyncWorkBridgeDelivered = true;
}
