/** Workflow authority belongs to Transovo runtime — never the interpreter model. */

export const FORBIDDEN_INTERPRETER_WORKFLOW_KEYS = [
  "stage",
  "required_action",
  "booking_confirmed",
  "offer_set_id",
  "allowed_next_actions",
  "forbidden_actions",
  "workflow_signal",
  "next_stage",
] as const;

export type InterpreterSchemaViolation = {
  forbiddenKeys: string[];
};

export function detectInterpreterWorkflowAuthorityViolation(
  raw: Record<string, unknown>,
): InterpreterSchemaViolation | null {
  const forbiddenKeys: string[] = [];
  for (const key of FORBIDDEN_INTERPRETER_WORKFLOW_KEYS) {
    if (key in raw && raw[key] !== undefined && raw[key] !== null) {
      forbiddenKeys.push(key);
    }
  }
  if (forbiddenKeys.length === 0) return null;
  return { forbiddenKeys };
}

export function shouldFailOnInterpreterSchemaViolation(): boolean {
  if (process.env.VOICE_V2_INTERPRETER_SCHEMA_STRICT === "0") return false;
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VOICE_V2_INTERPRETER_SCHEMA_STRICT === "1") return true;
  return process.env.NODE_ENV === "test" || process.env.CI === "true";
}

export function logInterpreterWorkflowAuthorityViolation(fields: Record<string, unknown>) {
  console.error(`ASTRA_WORKFLOW_AUTHORITY_VIOLATION ${JSON.stringify(fields)}`);
}
