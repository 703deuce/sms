import type { AgentFieldDefinition } from "./types";

/** Brief acknowledgment when moving to the next field — no address/name repeat on handoff. */
export function buildReceptionistFieldAckPhrase(
  field: AgentFieldDefinition,
  value: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  switch (field.id) {
    case "name": {
      const first = trimmed.split(/\s+/)[0];
      return first ? `Thanks, ${first}.` : "Thanks.";
    }
    case "phone":
      return "Got it.";
    case "email":
      return "Thanks.";
    case "address":
      return "Got it.";
    case "reason":
      return "Okay.";
    default:
      return "Got it.";
  }
}

export function buildReceptionistFieldTransitionLine(
  recordedField: AgentFieldDefinition,
  value: string,
  nextField: AgentFieldDefinition,
): string {
  const ack = buildReceptionistFieldAckPhrase(recordedField, value).trim();
  const question = nextField.question.trim();
  return ack ? `${ack} ${question}` : question;
}
