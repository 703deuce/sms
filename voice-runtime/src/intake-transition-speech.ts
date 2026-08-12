import type { AgentSession } from "@livekit/agents";
import type { RealEstateFieldDefinition } from "@/lib/voice/real-estate/types";
import { buildIntakeFieldAckPhrase } from "@/lib/voice/real-estate/intake-transition-phrases";
import { deliverScriptedSpeech } from "./outbound/scripted-speech";

export function intakeFieldQuestion(field: RealEstateFieldDefinition): string {
  return field.collection_instruction?.trim() || `What is your ${field.label}?`;
}

export function buildIntakeFieldTransitionLine(
  recordedField: RealEstateFieldDefinition,
  value: string,
  nextField: RealEstateFieldDefinition,
): string {
  const ack = buildIntakeFieldAckPhrase(recordedField, value).trim();
  const question = intakeFieldQuestion(nextField);
  return ack ? `${ack} ${question}` : question;
}

/**
 * Deterministic intake line — waits for full playout so the next AgentTask
 * handoff does not cut speech mid-sentence.
 */
export async function speakIntakeTransitionLine<T>(
  session: AgentSession<T>,
  line: string,
): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;
  await deliverScriptedSpeech(session, trimmed, {
    allowInterruptions: true,
    addToChatCtx: true,
  });
}
