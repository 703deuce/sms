import type { LeadRecoveryCollectField, MctbSmsCollectFieldDef } from "@/lib/mctb/lead-recovery/types";

export type { MctbSmsCollectFieldDef };
import { AI_RECOVERY_SIMPLIFIED_FIELDS } from "@/lib/mctb/ai-recovery/simplified-fields";

export type MctbSmsCollectFieldDef = {
  id: string;
  label: string;
  /** SMS question the agent may use (custom fields; builtins use runtime defaults if empty). */
  prompt: string;
  enabled: boolean;
  required: boolean;
  sortOrder: number;
  source: "builtin" | "custom";
  builtinKey?: LeadRecoveryCollectField;
};

const BUILTIN_DEFAULT_PROMPTS: Partial<Record<LeadRecoveryCollectField, string>> = {
  NAME: "What's your name?",
  REASON: "What can we help you with today?",
  ADDRESS: "What's the service address?",
  URGENCY: "Is this urgent right now, or can it wait?",
  CALLBACK_TIME: "When is a good time to call you back?",
  EMAIL: "What's the best email for you?",
  PHONE: "What number should we use to reach you?",
};

export function defaultSmsCollectFields(): MctbSmsCollectFieldDef[] {
  return AI_RECOVERY_SIMPLIFIED_FIELDS.map((def, index) => ({
    id: `builtin_${def.field.toLowerCase()}`,
    label: def.label,
    prompt: BUILTIN_DEFAULT_PROMPTS[def.field] ?? `Could you share your ${def.label.toLowerCase()}?`,
    enabled: def.field === "NAME" || def.field === "REASON" || def.field === "ADDRESS",
    required: def.field === "NAME" || def.field === "REASON",
    sortOrder: index + 1,
    source: "builtin" as const,
    builtinKey: def.field,
  }));
}

export function normalizeSmsCollectFields(raw: unknown): MctbSmsCollectFieldDef[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultSmsCollectFields();
  const defaults = defaultSmsCollectFields();
  const byBuiltin = new Map(
    defaults.filter((d) => d.builtinKey).map((d) => [d.builtinKey!, d]),
  );
  const out: MctbSmsCollectFieldDef[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    if (!id) continue;
    const source = r.source === "custom" ? "custom" : "builtin";
    const builtinKey =
      typeof r.builtinKey === "string"
        ? (r.builtinKey as LeadRecoveryCollectField)
        : undefined;
    const fallback = builtinKey ? byBuiltin.get(builtinKey) : undefined;
    out.push({
      id,
      label: typeof r.label === "string" ? r.label : fallback?.label ?? "Field",
      prompt:
        typeof r.prompt === "string"
          ? r.prompt
          : fallback?.prompt ?? "Could you share a bit more detail?",
      enabled: r.enabled !== false,
      required: r.required === true,
      sortOrder: typeof r.sortOrder === "number" ? r.sortOrder : out.length + 1,
      source,
      builtinKey,
    });
  }
  return out.length ? out.sort((a, b) => a.sortOrder - b.sortOrder) : defaultSmsCollectFields();
}

export function smsCollectFieldsToCapabilities(fields: MctbSmsCollectFieldDef[]): LeadRecoveryCollectField[] {
  const caps = new Set<LeadRecoveryCollectField>();
  for (const f of fields) {
    if (!f.enabled) continue;
    if (f.source === "builtin" && f.builtinKey) {
      caps.add(f.builtinKey);
      if (f.builtinKey === "CALLBACK_TIME") caps.add("CALLBACK_NUMBER");
      if (f.builtinKey === "REASON") {
        caps.add("ISSUE_DESCRIPTION");
        caps.add("SERVICE_CATEGORY");
      }
    }
  }
  return [...caps];
}

export function enabledSmsCollectPrompts(fields: MctbSmsCollectFieldDef[]): Array<{
  id: string;
  label: string;
  prompt: string;
  required: boolean;
  custom: boolean;
}> {
  return fields
    .filter((f) => f.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => ({
      id: f.id,
      label: f.label,
      prompt: f.prompt.trim() || `What is your ${f.label.toLowerCase()}?`,
      required: f.required,
      custom: f.source === "custom",
    }));
}

export function newCustomSmsCollectField(label: string, sortOrder: number): MctbSmsCollectFieldDef {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return {
    id: `custom_${slug || "field"}_${Date.now().toString(36)}`,
    label: label.trim() || "Custom question",
    prompt: label.trim() ? `What is your ${label.trim().toLowerCase()}?` : "Could you tell us more?",
    enabled: true,
    required: false,
    sortOrder,
    source: "custom",
  };
}
