/**
 * Structured logging for appointment AI — no secrets or card data.
 */

import type {
  AppointmentAiChannel,
  AppointmentAiIntent,
  WriteActionVerdict,
} from "./schema";

export type AppointmentAiLogEvent = {
  requestId: string;
  workspaceId: string;
  channel: AppointmentAiChannel;
  intent?: AppointmentAiIntent;
  confidence?: number;
  clarificationRequired?: boolean;
  verifierVerdict?: WriteActionVerdict;
  deterministicOutcome?: string;
  durationMs?: number;
  modelFailure?: boolean;
  fallbackUsed?: boolean;
  mutationExecuted: boolean;
};

export function logAppointmentAiEvent(event: AppointmentAiLogEvent): void {
  console.info("[appointment-ai]", JSON.stringify(event));
}
