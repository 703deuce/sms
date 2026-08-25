import { extractJsonFromLlm } from "@/lib/ai/llm";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { callForwardingSmsOpenAiCompletion } from "./sms-extract-llm";

export type SmsCallExtract = {
  intent: "place_call" | "other";
  destination: string | null;
  ambiguous: boolean;
};

export type SmsCallVerify = {
  approved: boolean;
  destination: string | null;
};

const PHONE_ONLY_RE = /^[\s\d().+-]+$/;
const US_PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}|\b\d{10}\b/g;

const EXTRACT_SYSTEM = `You extract outbound call intent from employee SMS commands sent to a business control number.
Return strict JSON only:
{"intent":"place_call"|"other","destination":"+1XXXXXXXXXX"|null,"ambiguous":boolean}

Rules:
- intent=place_call when the message asks to call/dial/ring one US phone number (digits may be spelled out, grouped, or formatted).
- destination MUST be US E.164: literal +1 then exactly 10 digits, no spaces or punctuation (example: +17035551212).
- ambiguous=true when multiple numbers, unclear target, or not a call request.
- Do not invent digits not present in the message. Convert spelled-out digits (e.g. "seven zero three") to digits before formatting.`;

const VERIFY_SYSTEM = `You verify SMS call extraction for a US outbound dial command.
Return strict JSON only:
{"approved":boolean,"destination":"+1XXXXXXXXXX"|null}

approved=true only when extraction matches the original message for exactly one US number.
destination MUST be US E.164: +1 then exactly 10 digits (example: +17035551212).
If extraction disagrees or invents digits, approved=false.`;

function tenDigitCandidates(body: string): string[] {
  const found: string[] = [];
  for (const m of body.matchAll(US_PHONE_RE)) {
    const digits = m[0].replace(/\D/g, "");
    const ten =
      digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.length === 10 ? digits : "";
    if (ten.length === 10) found.push(ten);
  }
  return [...new Set(found)];
}

function tryDeterministicExtract(body: string): SmsCallExtract | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  if (PHONE_ONLY_RE.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 10) {
      try {
        return {
          intent: "place_call",
          destination: normalizeE164(`+1${digits}`),
          ambiguous: false,
        };
      } catch {
        /* fall through */
      }
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      try {
        return {
          intent: "place_call",
          destination: normalizeE164(`+${digits}`),
          ambiguous: false,
        };
      } catch {
        /* fall through */
      }
    }
  }

  const candidates = tenDigitCandidates(trimmed);
  if (candidates.length === 1) {
    try {
      return {
        intent: "place_call",
        destination: normalizeE164(`+1${candidates[0]}`),
        ambiguous: false,
      };
    } catch {
      /* fall through */
    }
  }
  if (candidates.length > 1) {
    return { intent: "place_call", destination: null, ambiguous: true };
  }
  return null;
}

function tryDeterministicVerify(body: string, extract: SmsCallExtract): SmsCallVerify | null {
  if (extract.ambiguous || !extract.destination) return null;
  const destTen = extract.destination.replace(/\D/g, "").slice(-10);
  const candidates = tenDigitCandidates(body);
  if (candidates.length === 1 && candidates[0] === destTen) {
    return { approved: true, destination: extract.destination };
  }
  if (candidates.length > 1) {
    return { approved: false, destination: null };
  }
  const bare = body.replace(/\D/g, "");
  const bareTen = bare.length === 11 && bare.startsWith("1") ? bare.slice(1) : bare;
  if (bareTen.length === 10 && bareTen === destTen) {
    return { approved: true, destination: extract.destination };
  }
  return null;
}

export async function extractCallDestinationFromSms(body: string): Promise<SmsCallExtract | null> {
  const deterministic = tryDeterministicExtract(body);
  if (deterministic) return deterministic;

  const result = await callForwardingSmsOpenAiCompletion(EXTRACT_SYSTEM, body, {
    temperature: 0,
    maxTokens: 256,
  });
  if (!result) return null;
  const json = extractJsonFromLlm(result.content) as Partial<SmsCallExtract>;
  const intent = json.intent === "place_call" ? "place_call" : "other";
  let destination: string | null = null;
  if (json.destination) {
    try {
      destination = normalizeE164(String(json.destination));
    } catch {
      destination = null;
    }
  }
  return {
    intent,
    destination,
    ambiguous: Boolean(json.ambiguous),
  };
}

export async function verifySmsCallExtraction(
  body: string,
  extract: SmsCallExtract,
): Promise<SmsCallVerify> {
  const deterministic = tryDeterministicVerify(body, extract);
  if (deterministic) return deterministic;

  const user = JSON.stringify({ originalSms: body, extraction: extract });
  const result = await callForwardingSmsOpenAiCompletion(VERIFY_SYSTEM, user, {
    temperature: 0,
    maxTokens: 256,
  });
  if (!result) return { approved: false, destination: null };
  const json = extractJsonFromLlm(result.content) as Partial<SmsCallVerify>;
  let destination: string | null = null;
  if (json.destination) {
    try {
      destination = normalizeE164(String(json.destination));
    } catch {
      destination = null;
    }
  }
  const llmApproved = Boolean(json.approved) && destination !== null;
  if (llmApproved && extract.destination) {
    const destTen = extract.destination.replace(/\D/g, "").slice(-10);
    const verifyTen = destination!.replace(/\D/g, "").slice(-10);
    if (destTen === verifyTen) {
      return { approved: true, destination: extract.destination };
    }
  }
  return {
    approved: llmApproved,
    destination,
  };
}
