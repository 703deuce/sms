/**
 * Apply stored field mappings + customFields onto provider API payloads.
 * Mapping UI must affect real HTTP bodies — not theater.
 */

import { listFieldMappings } from "./mappings";
import { validateMappedPayload } from "./field-validate";
import type { CrmProviderId } from "./types";

export async function buildMappedPayload(input: {
  workspaceId: string;
  provider: CrmProviderId;
  objectType: string;
  /** Canonical Transovo fields already translated to default provider keys. */
  base: Record<string, unknown>;
  /** Extra custom / mapped values (internal field names or already external). */
  customFields?: Record<string, unknown> | null;
  stripNulls?: boolean;
}): Promise<Record<string, unknown>> {
  const mappings = await listFieldMappings(input.workspaceId, input.provider);
  const relevant = mappings.filter(
    (m: {
      objectType: string;
      active: boolean;
      direction: string;
      internalField: string;
      externalField: string;
      transform: string | null;
    }) =>
      m.objectType === input.objectType &&
      m.active !== false &&
      m.direction !== "inbound",
  );

  const out: Record<string, unknown> = { ...input.base };

  // Apply explicit mappings from internal → external
  const source: Record<string, unknown> = {
    ...input.base,
    ...(input.customFields || {}),
  };
  for (const m of relevant) {
    let value = source[m.internalField];
    if (value === undefined && input.customFields) {
      value = input.customFields[m.externalField];
    }
    if (value === undefined) continue;
    if (m.transform === "lowercase" && typeof value === "string") {
      value = value.toLowerCase();
    }
    if (m.transform === "e164" && typeof value === "string") {
      value = value.replace(/[^\d+]/g, "");
    }
    out[m.externalField] = value;
  }

  // Pass through remaining customFields that look like provider API names
  if (input.customFields) {
    for (const [k, v] of Object.entries(input.customFields)) {
      if (v === undefined) continue;
      // Skip pure internal keys already handled as base aliases
      if (["firstName", "lastName", "phone", "email", "company", "source", "status", "tags"].includes(k)) {
        continue;
      }
      if (out[k] === undefined) out[k] = v;
    }
  }

  const validated = validateMappedPayload(out);
  if (validated.issues.length) {
    // Drop invalid custom values rather than failing the whole write; keep required base fields.
    for (const issue of validated.issues) {
      if (!(issue.field in input.base)) delete validated.payload[issue.field];
    }
  }
  const finalOut = validated.payload;

  if (input.stripNulls !== false) {
    for (const k of Object.keys(finalOut)) {
      if (finalOut[k] === undefined || finalOut[k] === null || finalOut[k] === "") {
        delete finalOut[k];
      }
    }
  }
  return finalOut;
}
