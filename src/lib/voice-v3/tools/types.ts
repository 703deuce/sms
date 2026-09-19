import type { VoiceV3CallRuntime } from "../state/call-runtime";

export type VoiceToolOk<T = Record<string, unknown>> = {
  ok: true;
  status: string;
  data?: T;
};

export type VoiceToolErr = {
  ok: false;
  status: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
};

export type VoiceToolResult<T = Record<string, unknown>> = VoiceToolOk<T> | VoiceToolErr;

export function toolOk<T>(status: string, data?: T): VoiceToolOk<T> {
  return data === undefined ? { ok: true, status } : { ok: true, status, data };
}

export function voiceToolError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  status = "error",
  retryable?: boolean,
): VoiceToolErr {
  return { ok: false, status, code, message, details, retryable };
}

export interface VoiceToolExecutionContext {
  callId: string;
  liveSessionId: string;
  delegationId: string | null;
  functionCallId: string;
  runtime: VoiceV3CallRuntime;
  tenantId: string;
  sendContext: (event: { type: string; [key: string]: unknown }) => void;
  abortSignal?: AbortSignal;
  /** Conversation revision when the originating delegation was created. */
  delegationBasedOnConversationRevision?: number;
  currentConversationRevision?: number;
  delegationSemanticallyFresh?: boolean;
}

export type VoiceToolDefinition<TArgs> = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
  validate: (input: unknown) => TArgs;
  execute: (ctx: VoiceToolExecutionContext, args: TArgs) => Promise<VoiceToolResult>;
};
