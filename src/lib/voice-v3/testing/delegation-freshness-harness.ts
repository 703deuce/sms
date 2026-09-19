/**
 * High-fidelity event harness — uses production coordinator + delegated handlers.
 */
import assert from "node:assert/strict";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { handleDelegatedAstraResponseEvent } from "../intake/handle-delegated-meaning";
import {
  clearVoiceV3LiveResponseCoordinator,
  getVoiceV3LiveResponseCoordinator,
  peekVoiceV3LiveResponseCoordinator,
  type VoiceV3LiveResponseCoordinator,
} from "../delegation/live-response-coordinator";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../state/call-runtime";
import { clearDelegatedVoiceToolSessionState } from "../tools/handle-delegated-voice-tools";
import { clearDelegationTimingState } from "../conversation/delegation-timing";
import {
  clearCallerTurnManager,
  forceCommitCallerTurn,
  noteCallerTranscriptDelta,
} from "../conversation/caller-turn-manager";
import { getCurrentConversationRevision } from "../conversation/conversation-revision";

function seedConversationRevisionForTests(
  liveSessionId: string,
  targetSequence: number,
): number {
  clearCallerTurnManager(liveSessionId);
  for (let i = 1; i <= targetSequence; i++) {
    noteCallerTranscriptDelta(liveSessionId, `test_turn_${i}_${liveSessionId}`);
    forceCommitCallerTurn(liveSessionId);
  }
  return getCurrentConversationRevision(liveSessionId);
}

function setCallerUtteranceForTests(liveSessionId: string, utterance: string): void {
  noteCallerTranscriptDelta(liveSessionId, utterance);
  forceCommitCallerTurn(liveSessionId);
}

export type OutboundLiveEvent = { type: string; [key: string]: unknown };

export function outputItemDone(
  callId: string,
  name: string,
  args: Record<string, unknown> | string,
): Record<string, unknown> {
  const argumentsJson =
    typeof args === "string" ? args : JSON.stringify(args);
  return {
    type: "response.output_item.done",
    item: {
      type: "function_call",
      id: `fc_${callId}`,
      call_id: callId,
      name,
      arguments: argumentsJson,
    },
  };
}

export class DelegationFreshnessHarness {
  readonly liveSessionId: string;
  readonly config: VoiceV3AgentConfig;
  readonly outbound: OutboundLiveEvent[] = [];
  readonly send: (event: OutboundLiveEvent) => void;

  constructor(liveSessionId: string, config: VoiceV3AgentConfig, callId?: string) {
    this.liveSessionId = liveSessionId.trim();
    this.config = config;
    this.send = (event) => {
      this.outbound.push(event);
    };
    this.resetRuntime(callId ?? `call_${liveSessionId}`);
  }

  resetRuntime(callId: string): void {
    clearVoiceV3CallRuntimeStore();
    clearVoiceV3LiveResponseCoordinator(this.liveSessionId);
    clearDelegatedVoiceToolSessionState(this.liveSessionId);
    clearDelegationTimingState(this.liveSessionId);
    clearCallerTurnManager(this.liveSessionId);
    this.outbound.length = 0;
    createVoiceV3CallRuntime({
      liveSessionId: this.liveSessionId,
      callId,
      config: this.config,
    });
    getVoiceV3LiveResponseCoordinator(this.liveSessionId, this.send);
  }

  coordinator(): VoiceV3LiveResponseCoordinator {
    return getVoiceV3LiveResponseCoordinator(this.liveSessionId, this.send);
  }

  currentRevision(): number {
    return getCurrentConversationRevision(this.liveSessionId);
  }

  seedRevision(target: number): number {
    return seedConversationRevisionForTests(this.liveSessionId, target);
  }

  commitCallerTurn(utterance: string): number {
    setCallerUtteranceForTests(this.liveSessionId, utterance);
    return this.currentRevision();
  }

  sessionDelegationCreated(input: {
    id: string;
    response_id?: string;
    offset_ms?: number;
  }): void {
    this.coordinator().onDelegationCreated(input);
  }

  nestedResponseEvent(
    delegationId: string,
    nested: Record<string, unknown>,
  ): void {
    handleDelegatedAstraResponseEvent({
      liveSessionId: this.liveSessionId,
      nested,
      send: this.send,
      delegationId,
    });
  }

  async functionCall(
    delegationId: string,
    callId: string,
    name: string,
    args: Record<string, unknown> | string,
  ): Promise<void> {
    this.nestedResponseEvent(delegationId, outputItemDone(callId, name, args));
    await new Promise((r) => setTimeout(r, 30));
  }

  functionOutputs(): Array<{ call_id: string; output: string }> {
    return this.outbound
      .filter((e) => e.type === "response.item.create")
      .map((e) => {
        const item = e.item as { call_id?: string; output?: string };
        return {
          call_id: String(item.call_id ?? ""),
          output: String(item.output ?? ""),
        };
      });
  }

  continuations(): OutboundLiveEvent[] {
    return this.outbound.filter((e) => e.type === "response.create");
  }

  clearOutbound(): void {
    this.outbound.length = 0;
  }

  async waitForOutput(callId: string, maxMs = 3000): Promise<string> {
    let row = this.functionOutputs().find((o) => o.call_id === callId);
    const steps = Math.ceil(maxMs / 50);
    for (let i = 0; i < steps && !row; i++) {
      await new Promise((r) => setTimeout(r, 50));
      row = this.functionOutputs().find((o) => o.call_id === callId);
    }
    assert.ok(row, `missing function_call_output for ${callId}`);
    return row!.output;
  }

  parseOutput(callId: string): Record<string, unknown> {
    const raw = this.functionOutputs().find((o) => o.call_id === callId)?.output;
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  }

  assertNotSuperseded(callId: string): void {
    const parsed = this.parseOutput(callId);
    assert.notEqual(parsed.status, "SEMANTIC_SUPERSEDED");
  }

  assertSuperseded(callId: string): void {
    const parsed = this.parseOutput(callId);
    assert.equal(parsed.status, "SEMANTIC_SUPERSEDED");
  }
}

export function peekCoordinator(
  liveSessionId: string,
): VoiceV3LiveResponseCoordinator | null {
  return peekVoiceV3LiveResponseCoordinator(liveSessionId);
}
