import type { AgentFieldDefinition } from "@/lib/voice/receptionist/types";
import type { CallerFieldRow } from "@/lib/receptionist-wizard/advanced-types";

const FIELD_QUESTIONS: Record<string, string> = {
  name: "May I have your full name?",
  phone: "What's the best phone number to reach you?",
  email: "What's your email address?",
  reason: "What can I help you with today?",
  address: "What's the service address?",
};

const FIELD_TYPES: Record<string, AgentFieldDefinition["type"]> = {
  name: "text",
  phone: "phone",
  email: "email",
  reason: "text",
  address: "address",
};

export function fieldManifestFromAdvancedRows(rows: CallerFieldRow[]): AgentFieldDefinition[] {
  return rows
    .filter((r) => r.enabled)
    .map((row) => ({
      id: row.id,
      label: row.label,
      question: FIELD_QUESTIONS[row.id] || `May I have your ${row.label.toLowerCase()}?`,
      type: FIELD_TYPES[row.id] || "text",
      required: row.required,
      askWhen: row.askWhen,
      confirm: row.confirm,
    }));
}

export function collectFieldIdsFromRows(rows: CallerFieldRow[]): string[] {
  return rows.filter((r) => r.enabled).map((r) => r.id);
}
