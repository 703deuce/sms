import type { AgentFieldDefinition } from "./types";

/** Manifest index defines collection order — customer UI row order is authoritative. */
export function manifestFieldIndex(manifest: AgentFieldDefinition[], fieldId: string): number {
  const idx = manifest.findIndex((f) => f.id === fieldId);
  return idx >= 0 ? idx : 999;
}

export function sortFieldsByManifestOrder(
  manifest: AgentFieldDefinition[],
  fields: AgentFieldDefinition[],
): AgentFieldDefinition[] {
  return [...fields].sort(
    (a, b) => manifestFieldIndex(manifest, a.id) - manifestFieldIndex(manifest, b.id),
  );
}

export function isPhoneField(field: AgentFieldDefinition): boolean {
  return field.type === "phone";
}

export function isEmailField(field: AgentFieldDefinition): boolean {
  return field.type === "email";
}

export function isAddressField(field: AgentFieldDefinition): boolean {
  return field.type === "address";
}

export function looksLikeNameField(field: AgentFieldDefinition): boolean {
  const id = field.id.toLowerCase();
  const label = field.label.toLowerCase();
  return id === "name" || id.endsWith("_name") || /\bname\b/.test(label);
}

export function findPhoneField(manifest: AgentFieldDefinition[]): AgentFieldDefinition | undefined {
  return manifest.find((f) => isPhoneField(f));
}

export function findEmailField(manifest: AgentFieldDefinition[]): AgentFieldDefinition | undefined {
  return manifest.find((f) => isEmailField(f));
}

/** Save extracted fields in manifest order (not hardcoded field ids). */
export function fieldIdsInManifestOrder(
  manifest: AgentFieldDefinition[],
  fieldIds: string[],
): string[] {
  const allowed = new Set(fieldIds);
  return manifest.filter((f) => allowed.has(f.id)).map((f) => f.id);
}

export function buildSemanticSchemaExample(manifest: AgentFieldDefinition[]): Record<string, unknown> {
  const example: Record<string, unknown> = { correction: false };
  for (const field of manifest) {
    if (isPhoneField(field)) {
      example[field.id] = null;
      example[`${field.id}_use_caller_id`] = false;
    } else {
      example[field.id] = null;
    }
  }
  return example;
}

export function fieldGuideForSemanticExtraction(manifest: AgentFieldDefinition[]): string {
  return manifest
    .map(
      (f) =>
        `- ${f.id}: label="${f.label}", type=${f.type}, required=${f.required}, ` +
        `instruction="${f.question || f.label}"`,
    )
    .join("\n");
}

const CORRECTION_RE =
  /\b(actually|instead|correction|not that|wait no|i meant|i said|use my|change my)\b/i;

/** On correction utterances, clear manifest fields whose label/id appears in speech. */
export function fieldsToClearOnCorrection(
  transcript: string,
  manifest: AgentFieldDefinition[],
): string[] {
  if (!CORRECTION_RE.test(transcript)) return [];
  const lower = transcript.toLowerCase();
  return manifest
    .filter((field) => {
      const label = field.label.toLowerCase();
      const idWords = field.id.replace(/_/g, " ");
      return (
        lower.includes(field.id.toLowerCase()) ||
        lower.includes(label) ||
        lower.includes(idWords)
      );
    })
    .map((f) => f.id);
}

export function utteranceReferencesCallerIdPhone(transcript: string): boolean {
  return /\b(calling from|number i'?m calling from|number i am calling from|use (my |the )?number|this number|same number|number i'?m on)\b/i.test(
    transcript,
  );
}

export function isTrivialPhoneUtterance(transcript: string): boolean {
  const digitsOnly = transcript.trim().replace(/\D/g, "");
  return digitsOnly.length >= 10 && digitsOnly.length <= 11;
}

export function isTrivialEmailUtterance(transcript: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(transcript.trim());
}
