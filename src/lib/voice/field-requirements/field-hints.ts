import type { FieldRequirement } from "./types";

/** Wizard / service field ids → canonical requirement id. */
export const CANONICAL_FIELD_ID: Record<string, string> = {
  name: "full_name",
  full_name: "full_name",
  customer_name: "full_name",
  phone: "phone",
  callback_phone: "phone",
  email: "email",
  address: "address",
  service_address: "address",
  location: "address",
  service: "service",
  serviceName: "service",
  service_name: "service",
  notes: "problem_description",
  problem: "problem_description",
  problem_description: "problem_description",
  issue: "problem_description",
  description: "problem_description",
  message: "message",
  reason: "message",
};

export function canonicalFieldId(fieldId: string): string {
  const key = fieldId.trim();
  return CANONICAL_FIELD_ID[key] || key;
}

/** Primary tool arg Amy should send for each canonical field. */
export function primaryToolArgForField(fieldId: string): {
  tool: "save_caller_info" | "save_customer_info" | "book_appointment";
  arg: string;
  example?: string;
} {
  const id = canonicalFieldId(fieldId);
  switch (id) {
    case "full_name":
      return { tool: "save_caller_info", arg: "name", example: "John Smith" };
    case "phone":
      return { tool: "save_caller_info", arg: "phone", example: "+17035551212" };
    case "email":
      return { tool: "save_caller_info", arg: "email", example: "john@example.com" };
    case "address":
      return { tool: "save_caller_info", arg: "address", example: "123 Main St" };
    case "service":
      return { tool: "save_caller_info", arg: "serviceName", example: "Service Visit" };
    case "problem_description":
      return {
        tool: "save_caller_info",
        arg: "problem_description",
        example: "Kitchen sink is leaking",
      };
    case "message":
      return { tool: "save_caller_info", arg: "message", example: "Please call back" };
    default:
      return {
        tool: "save_caller_info",
        arg: `custom_fields.${id}`,
        example: "value",
      };
  }
}

export type FieldSubmissionHint = {
  field_id: string;
  label: string;
  tool: string;
  /** Exact parameter name(s) Amy can pass to save_caller_info or book_appointment */
  pass_as: string[];
  example_payload: Record<string, unknown>;
  ask_prompt?: string;
};

export function buildFieldSubmissionHints(
  requirements: FieldRequirement[],
  missingIds: string[],
): FieldSubmissionHint[] {
  return missingIds.map((rawId) => {
    const fieldId = canonicalFieldId(rawId);
    const req =
      requirements.find((r) => canonicalFieldId(r.field_id) === fieldId) ||
      requirements.find((r) => r.field_id === rawId);
    const primary = primaryToolArgForField(fieldId);
    const passAs = Array.from(
      new Set([
        primary.arg,
        ...(req?.aliases || []),
        fieldId,
        rawId,
      ].filter(Boolean)),
    );
    const examplePayload: Record<string, unknown> = { workflow: "book_appointment" };
    if (primary.arg.startsWith("custom_fields.")) {
      const key = primary.arg.replace("custom_fields.", "");
      examplePayload.custom_fields = { [key]: primary.example || "value" };
    } else {
      examplePayload[primary.arg] = primary.example || "value";
    }
    return {
      field_id: fieldId,
      label: req?.label || fieldId.replace(/_/g, " "),
      tool: primary.tool,
      pass_as: passAs,
      example_payload: examplePayload,
      ask_prompt: req?.ask_prompt,
    };
  });
}
