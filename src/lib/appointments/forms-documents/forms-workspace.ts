import type { IntakeField } from "@/lib/appointments/service-booking/types";
import type { IntakeFormMetadata } from "@/lib/appointments/service-booking/intake-forms";

export type LibraryKind = "form" | "waiver" | "agreement" | "upload" | "questionnaire";

export type OfferingKind = "service" | "class" | "workshop" | "meeting";

export type OfferingAssignment = {
  offeringId: string;
  offeringKind: OfferingKind;
  offeringName: string;
  durationLabel?: string;
  formIds: string[];
};

export type LibraryRow = {
  id: string;
  name: string;
  kind: LibraryKind;
  fieldCount: number;
  requirementsLabel: string;
  assignedCount: number;
  submissionCount: number;
  active: boolean;
  version: number;
  updatedAt: string;
};

export type SubmissionRow = {
  id: string;
  formId: string;
  formName: string;
  customerLabel: string;
  bookingLabel: string;
  submittedAt: string;
  status: "complete" | "incomplete" | "signed" | "pending";
  filesCount: number;
  hasSignature: boolean;
  formVersion: number;
  contactId?: string;
  appointmentId?: string;
};

export type DocumentRow = {
  id: string;
  name: string;
  kind: "contract" | "waiver";
  signatureRequired: boolean;
  assignedCount: number;
  completionsCount: number;
  active: boolean;
  version: string;
  updatedAt: string;
};

export type CompletionRow = {
  id: string;
  customerLabel: string;
  bookingLabel: string;
  itemLabel: string;
  dueLabel: string;
  status: "pending" | "overdue" | "complete";
  lastReminderAt?: string;
  appointmentId?: string;
  formId?: string;
  contractId?: string;
};

export function readFormMetadata(raw: unknown): IntakeFormMetadata {
  if (!raw || typeof raw !== "object") return {};
  return raw as IntakeFormMetadata;
}

export function inferLibraryKind(
  fields: IntakeField[],
  metadata?: IntakeFormMetadata,
): LibraryKind {
  if (metadata?.kind) return metadata.kind;
  const types = new Set(fields.map((f) => f.type));
  if (types.has("signature") || (types.has("agreement") && types.has("signature"))) {
    return "waiver";
  }
  if (types.has("agreement")) return "agreement";
  if (fields.length === 1 && (types.has("file") || types.has("image"))) return "upload";
  if (fields.length >= 6) return "questionnaire";
  return "form";
}

export function requirementsLabel(fields: IntakeField[], kind: LibraryKind): string {
  const required = fields.filter((f) => f.required).length;
  if (kind === "waiver") return "Signature required";
  if (kind === "upload") return fields[0]?.label || "Upload required";
  if (required > 0) return `${fields.length} fields · ${required} required`;
  return `${fields.length} field${fields.length === 1 ? "" : "s"}`;
}

export function intakeFormIdsFromTypeConfig(config: unknown): string[] {
  if (!config || typeof config !== "object") return [];
  const c = config as { intakeFormIds?: string[]; intakeFormId?: string };
  if (c.intakeFormIds?.length) return c.intakeFormIds;
  if (c.intakeFormId) return [c.intakeFormId];
  return [];
}

export function offeringKindFromRow(row: {
  kind?: string;
  category?: string;
  metadata?: unknown;
  config?: unknown;
}): OfferingKind {
  const cfg = row.config as { bookingTypeKind?: string } | undefined;
  const kind = String(cfg?.bookingTypeKind || row.kind || "").toUpperCase();
  if (kind === "MEETING") return "meeting";
  if (kind === "CLASS" || kind === "CLASS_SERIES") return "class";
  if (kind === "WORKSHOP") return "workshop";
  return "service";
}

export function buildAssignmentIndex(
  types: Array<{
    id: string;
    name: string;
    kind?: string;
    durationMinutes?: number;
    config?: unknown;
  }>,
): OfferingAssignment[] {
  return types.map((t) => ({
    offeringId: t.id,
    offeringKind: offeringKindFromRow(t),
    offeringName: t.name,
    durationLabel: t.durationMinutes ? `${t.durationMinutes} min` : undefined,
    formIds: intakeFormIdsFromTypeConfig(t.config),
  }));
}

export function countAssignmentsPerForm(assignments: OfferingAssignment[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of assignments) {
    for (const formId of row.formIds) {
      map.set(formId, (map.get(formId) || 0) + 1);
    }
  }
  return map;
}

export function submissionStatus(
  answers: Record<string, unknown>,
  fields: IntakeField[],
): SubmissionRow["status"] {
  for (const field of fields) {
    if (!field.required) continue;
    const val = answers[field.id];
    if (val === undefined || val === null || String(val).trim() === "") return "incomplete";
  }
  if (fields.some((f) => f.type === "signature") && answers) {
    const sig = fields.find((f) => f.type === "signature");
    if (sig && !answers[sig.id]) return "incomplete";
  }
  return "complete";
}

export function countFilesInAnswers(answers: Record<string, unknown>): number {
  let n = 0;
  for (const val of Object.values(answers)) {
    if (typeof val === "string" && (val.startsWith("upload:") || val.includes("/intake-upload/"))) {
      n += 1;
    }
  }
  return n;
}

export function hasSignatureInAnswers(answers: Record<string, unknown>, fields: IntakeField[]): boolean {
  const sig = fields.find((f) => f.type === "signature");
  if (!sig) return false;
  const val = answers[sig.id];
  return typeof val === "string" && val.length > 10;
}

export const COMPLETION_TIMING_OPTIONS = [
  {
    value: "during_booking" as const,
    label: "During booking",
    description: "Customer completes this before the booking is confirmed.",
    supported: true,
  },
  {
    value: "after_booking" as const,
    label: "After booking",
    description: "Booking can complete first, then the customer receives the form.",
    supported: false,
  },
  {
    value: "before_appointment" as const,
    label: "Before appointment",
    description: "Customer must complete it before the appointment starts.",
    supported: false,
  },
] as const;
