import type { IntakeFieldKey, VoiceV2IntakeSchema } from "./types";
import { normalizeVoiceIntakeEmail } from "./normalize-email";

const NAME_PATTERNS = [
  /\b(?:my name is|name is|i am|i'm|this is)\s+([a-z][a-z\s'.-]{1,60})/i,
  /\bit's\s+([a-z][a-z\s'.-]{1,60})\s+here\b/i,
];

const EMAIL_INLINE_RE =
  /\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i;

const EMAIL_SPOKEN_RE =
  /\b(?:email(?:\s+is)?|e-?mail(?:\s+address)?\s+is)\s+(.{3,120})/i;

const PHONE_RE =
  /\b(?:phone(?:\s+number)?\s+is\s+)?(\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/;

const SERVICE_RE =
  /\b(?:for|because|regarding|about|need(?:\s+help\s+with)?)\s+(?:a\s+)?(.{4,120})/i;

function trimName(raw: string): string {
  return raw
    .replace(/\s+(and|with|for|on|at)\s+.+$/i, "")
    .replace(/[.,!?]+$/g, "")
    .trim()
    .slice(0, 80);
}

/** Deterministic intake field extraction from caller speech (interpreter supplement). */
export function extractIntakeFieldsFromUtterance(
  utterance: string,
  schema: VoiceV2IntakeSchema,
): Partial<Record<IntakeFieldKey, string>> {
  const text = utterance.trim();
  if (!text) return {};

  const enabled = new Set(schema.fields.map((f) => f.key));
  const out: Partial<Record<IntakeFieldKey, string>> = {};

  if (enabled.has("email")) {
    const inline = text.match(EMAIL_INLINE_RE);
    if (inline) {
      const norm = normalizeVoiceIntakeEmail(inline[1]);
      if (norm) out.email = norm;
    } else {
      const spoken = text.match(EMAIL_SPOKEN_RE);
      if (spoken) {
        const norm = normalizeVoiceIntakeEmail(spoken[1]);
        if (norm) out.email = norm;
      } else {
        const normWhole = normalizeVoiceIntakeEmail(text);
        if (normWhole && text.toLowerCase().includes("mail")) out.email = normWhole;
      }
    }
  }

  if (enabled.has("phone") && !out.phone) {
    const phone = text.match(PHONE_RE);
    if (phone) out.phone = phone[1].replace(/\s+/g, " ").trim();
  }

  if (enabled.has("name") && !out.name) {
    for (const re of NAME_PATTERNS) {
      const m = text.match(re);
      if (m?.[1]) {
        const name = trimName(m[1]);
        if (name.length >= 2 && !/@/.test(name)) {
          out.name = name;
          break;
        }
      }
    }
  }

  if (enabled.has("service_reason") && !out.service_reason) {
    const svc = text.match(SERVICE_RE);
    if (svc?.[1]) {
      const reason = svc[1].replace(/[.,!?]+$/g, "").trim();
      if (reason.length >= 4 && !/appointment|schedule|book/i.test(reason)) {
        out.service_reason = reason.slice(0, 200);
      }
    }
  }

  return out;
}
