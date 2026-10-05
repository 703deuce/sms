import {
  defaultSmsCollectFields,
  normalizeSmsCollectFields,
} from "@/lib/mctb/ai-recovery/collect-field-schema";
import type { MctbSmsCollectFieldDef } from "@/lib/mctb/lead-recovery/types";

function phraseForBuiltin(builtinKey: string, label: string): string {
  switch (builtinKey) {
    case "NAME":
      return "your name";
    case "REASON":
      return "what you need help with";
    case "ADDRESS":
      return "service address";
    case "URGENCY":
      return "how urgent it is";
    case "CALLBACK_TIME":
      return "preferred callback time";
    case "EMAIL":
      return "your email";
    case "PHONE":
      return "best phone number";
    default:
      return label.trim().toLowerCase() || "details";
  }
}

function phraseForField(field: MctbSmsCollectFieldDef): string {
  if (field.source === "builtin" && field.builtinKey) {
    return phraseForBuiltin(field.builtinKey, field.label);
  }
  const label = field.label.trim();
  if (!label) return "details";
  return `the ${label.toLowerCase()}`;
}

/** Oxford-style list: "a, b, and c" */
export function joinPhraseList(parts: string[]): string {
  const items = parts.map((p) => p.trim()).filter(Boolean);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** Natural-language fragment for templates: "your name, service address, and what you need help with" */
export function buildInformationRequestPhrase(fields: MctbSmsCollectFieldDef[]): string {
  const enabled = fields.filter((f) => f.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  return joinPhraseList(enabled.map(phraseForField));
}

/** Default fields for first-text information request (name + reason + address on). */
export function defaultFirstTextInformationRequestFields(): MctbSmsCollectFieldDef[] {
  const base = defaultSmsCollectFields();
  const enableKeys = new Set(["NAME", "REASON", "ADDRESS"]);
  return base.map((f) =>
    f.builtinKey && enableKeys.has(f.builtinKey) ? { ...f, enabled: true } : { ...f, enabled: false },
  );
}

export function normalizeFirstTextInformationRequestFields(
  raw: unknown,
): MctbSmsCollectFieldDef[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultFirstTextInformationRequestFields();
  }
  const normalized = normalizeSmsCollectFields(raw);
  const anyEnabled = normalized.some((f) => f.enabled);
  return anyEnabled ? normalized : defaultFirstTextInformationRequestFields();
}
