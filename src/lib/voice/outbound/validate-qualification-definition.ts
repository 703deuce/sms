import type { QualificationDefinition, QualificationFieldDefinition } from "./types";

export type QualificationValidationIssue = {
  path: string;
  message: string;
};

const OUTCOMES = new Set([
  "QUALIFIED",
  "NOT_QUALIFIED",
  "NOT_INTERESTED",
  "NURTURE",
  "HOT",
  "CALLBACK_REQUESTED",
  "WRONG_NUMBER",
  "COMPLETED_INTAKE",
  "NOT_STARTED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseField(raw: unknown, index: number): { field?: QualificationFieldDefinition; issues: QualificationValidationIssue[] } {
  const issues: QualificationValidationIssue[] = [];
  if (!isRecord(raw)) {
    issues.push({ path: `fields[${index}]`, message: "Field must be an object" });
    return { issues };
  }
  const field_id = String(raw.field_id || "").trim();
  const label = String(raw.label || "").trim();
  if (!field_id) issues.push({ path: `fields[${index}].field_id`, message: "field_id is required" });
  if (!label) issues.push({ path: `fields[${index}].label`, message: "label is required" });
  return {
    field: {
      field_id,
      label,
      type: (raw.type as QualificationFieldDefinition["type"]) || "text",
      required: Boolean(raw.required),
      collection_instruction: String(raw.collection_instruction || "").trim() || `Collect ${label || field_id}.`,
      options: Array.isArray(raw.options) ? raw.options.map(String) : undefined,
    },
    issues,
  };
}

export function validateQualificationDefinition(raw: unknown): QualificationValidationIssue[] {
  const issues: QualificationValidationIssue[] = [];
  if (!isRecord(raw)) {
    return [{ path: "outboundQualification", message: "Qualification config must be an object" }];
  }

  const id = String(raw.id || "").trim();
  const businessName = String(raw.businessName || "").trim();
  const reasonForContact = String(raw.reasonForContact || "").trim();
  if (!id) issues.push({ path: "id", message: "id is required" });
  if (!businessName) issues.push({ path: "businessName", message: "businessName is required" });
  if (!reasonForContact) issues.push({ path: "reasonForContact", message: "reasonForContact is required" });

  const fieldsRaw = raw.fields;
  if (!Array.isArray(fieldsRaw) || !fieldsRaw.length) {
    issues.push({ path: "fields", message: "At least one qualification field is required" });
  } else {
    const seen = new Set<string>();
    fieldsRaw.forEach((field, index) => {
      const parsed = parseField(field, index);
      issues.push(...parsed.issues);
      if (parsed.field?.field_id) {
        if (seen.has(parsed.field.field_id)) {
          issues.push({ path: `fields[${index}].field_id`, message: "Duplicate field_id" });
        }
        seen.add(parsed.field.field_id);
      }
    });
  }

  const allowedOutcomes = Array.isArray(raw.allowedOutcomes) ? raw.allowedOutcomes.map(String) : [];
  if (!allowedOutcomes.length) {
    issues.push({ path: "allowedOutcomes", message: "At least one allowed outcome is required" });
  } else {
    for (const outcome of allowedOutcomes) {
      if (!OUTCOMES.has(outcome)) {
        issues.push({ path: "allowedOutcomes", message: `Unknown outcome: ${outcome}` });
      }
    }
  }

  if (!Array.isArray(raw.rules)) {
    issues.push({ path: "rules", message: "rules array is required" });
  }

  return issues;
}

export function hasBlockingQualificationIssues(issues: QualificationValidationIssue[]): boolean {
  return issues.length > 0;
}
