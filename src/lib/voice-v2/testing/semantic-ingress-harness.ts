import "server-only";

import type { StableCallerUtterance } from "@/lib/voice/telnyx/openai-live-bridge/live-caller-utterance-assembler";
import { createLiveStableUtteranceIngress } from "@/lib/voice/telnyx/openai-live-bridge/live-stable-utterance-ingress";
import type { SyncLiveCallerUtteranceIntentResult } from "@/lib/voice/telnyx/openai-live-bridge/live-caller-intent-sync";
import { resetAllUtteranceRevisionGuards } from "@/lib/voice/telnyx/openai-live-bridge/live-utterance-revision-guard";
import {
  ORCHESTRATION_TEST_CONFIG,
  VoiceV2OrchestrationHarness,
  resetOrchestrationTestWorld,
} from "./orchestration-harness";

export type SemanticIngressTerminal =
  | "interpreted"
  | "superseded"
  | "failed"
  | "rejected"
  | "queued";

export type SemanticIngressEvent = {
  utterance_id: string;
  revision: number;
  text: string;
  terminal: SemanticIngressTerminal;
  reason?: string;
  phase?: string;
};

let utteranceCounter = 0;

export function buildStableUtterance(
  text: string,
  opts?: { utterance_id?: string; revision?: number },
): StableCallerUtterance {
  utteranceCounter += 1;
  const id = opts?.utterance_id ?? `utt_sem_${utteranceCounter}`;
  return {
    utterance_id: id,
    revision: opts?.revision ?? 1,
    start_ms: 0,
    end_ms: 100,
    stable_at: Date.now(),
    text,
  };
}

/**
 * Production semantic ingress: stable utterance → live-stable-utterance-ingress → syncLiveCallerUtteranceIntent.
 */
export class VoiceV2SemanticIngressHarness {
  readonly orchestration: VoiceV2OrchestrationHarness;
  readonly events: SemanticIngressEvent[] = [];
  private transcriptLines: string[] = [];
  readonly ingress: ReturnType<typeof createLiveStableUtteranceIngress>;
  private controlPlaneMarkedReady = false;

  constructor(input?: { callId?: string }) {
    resetOrchestrationTestWorld();
    resetAllUtteranceRevisionGuards();
    this.orchestration = new VoiceV2OrchestrationHarness({
      callId: input?.callId ?? "SEMANTIC_INGRESS",
    });
    this.ingress = createLiveStableUtteranceIngress({
      callId: this.orchestration.callId,
      getDeps: () => ({
        claims: {
          workspaceId: "ws_test",
          agentId: "agent_test",
          callId: this.orchestration.callId,
          callControlId: this.orchestration.callControlId,
        },
        controlPlane: this.orchestration.controlPlane,
        dispatchContext: this.orchestration.dispatch,
        sendLiveOut: () => {},
        fullConversationTranscript: () => this.transcriptLines.join("\n"),
        liveSessionId: this.orchestration.controlPlane.getLiveSessionId(),
      }),
    });
  }

  markControlPlaneReady(reason = "test_harness") {
    this.controlPlaneMarkedReady = true;
    this.ingress.markControlPlaneReady(reason);
  }

  async speak(
    text: string,
    opts?: { utterance_id?: string; revision?: number; ready?: boolean },
  ): Promise<SemanticIngressEvent> {
    if (opts?.ready !== false && !this.controlPlaneMarkedReady) {
      this.markControlPlaneReady("auto_before_first_utterance");
    }
    this.transcriptLines.push(`Caller: ${text}`);
    const stable = buildStableUtterance(text, opts);
    const result = await this.ingress.ingestStableUtterance(stable);
    const event = this.recordTerminal(stable, result);
    if (result?.terminal === "queued") {
      await this.flushQueue();
      const retry = await this.ingress.ingestStableUtterance(stable);
      return this.recordTerminal(stable, retry);
    }
    return event;
  }

  private async flushQueue() {
    if (!this.controlPlaneMarkedReady) {
      this.markControlPlaneReady("flush_queue");
    }
    await new Promise((r) => setTimeout(r, 5));
  }

  private recordTerminal(
    stable: StableCallerUtterance,
    result: SyncLiveCallerUtteranceIntentResult | null,
  ): SemanticIngressEvent {
    const terminal: SemanticIngressTerminal = result?.terminal ?? "failed";
    const event: SemanticIngressEvent = {
      utterance_id: stable.utterance_id,
      revision: stable.revision,
      text: stable.text,
      terminal,
      reason: result?.reason,
      phase: result?.phase,
    };
    this.events.push(event);
    return event;
  }

  assertLastTerminal(...allowed: SemanticIngressTerminal[]) {
    const last = this.events[this.events.length - 1];
    if (!last || !allowed.includes(last.terminal)) {
      throw new Error(
        `Expected terminal ${allowed.join("|")}, got ${last?.terminal ?? "none"}. Events: ${JSON.stringify(this.events)}`,
      );
    }
  }

  dispose() {
    this.orchestration.dispose();
    resetAllUtteranceRevisionGuards();
  }
}

export function resetSemanticIngressTestWorld() {
  utteranceCounter = 0;
  resetOrchestrationTestWorld();
  resetAllUtteranceRevisionGuards();
}
