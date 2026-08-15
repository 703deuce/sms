import { parsePhoneDigits } from "./keypad";
import type { PersonalCustomerTier, PersonalPatternKind } from "./pricing-config";

export type PersonalPatternAnalysis = {
  kind: PersonalPatternKind;
  tier: PersonalCustomerTier;
  /** Primary human-visible pattern id for analytics. */
  lastFourPattern: string;
  fullNumberPattern?: string;
  /** 0–100 personal memorability score for ranking. */
  numberQualityScore: number;
  customerLabel: string;
  bulletLabels: string[];
};

const ABAB_LAST4 = new Set([
  "1212",
  "1313",
  "1414",
  "2020",
  "3030",
  "3434",
  "5050",
  "7070",
  "8080",
  "9090",
  "2323",
  "2525",
  "5656",
  "7878",
]);

const SEQUENCE_LAST4 = new Set(["1234", "2345", "3456", "4321", "5678", "8765"]);

const A000_LAST4 = new Set([
  "1000",
  "2000",
  "3000",
  "4000",
  "5000",
  "6000",
  "7000",
  "8000",
  "9000",
]);

function reverseDigits(s: string): string {
  return s.split("").reverse().join("");
}

function isAabb(last4: string): boolean {
  return /^(\d)\1(\d)\2$/.test(last4) && !ABAB_LAST4.has(last4);
}

function isWeakAbba(last4: string): boolean {
  if (ABAB_LAST4.has(last4)) return false;
  if (SEQUENCE_LAST4.has(last4)) return false;
  if (/^(\d)\1{3}$/.test(last4)) return false;
  return last4 === reverseDigits(last4);
}

function detectFullRhythm(subscriber: string): PersonalPatternKind | null {
  if (subscriber.length !== 7) return null;
  if (/^(\d)\1{6}$/.test(subscriber)) return "FULL_RHYTHM_EXCEPTIONAL";

  const mid3 = subscriber.slice(0, 3);
  const last4 = subscriber.slice(3);

  if (last4.startsWith(mid3)) return "FULL_RHYTHM_EXCEPTIONAL";
  if (mid3 === last4.slice(0, 3)) return "FULL_RHYTHM";
  if (SEQUENCE_LAST4.has(last4) && /^[1-9]00$/.test(mid3)) return "FULL_RHYTHM";
  if (last4 === `${mid3[0]}${mid3[1]}${mid3[2]}${mid3[0]}`) return "FULL_RHYTHM";

  const classic = new Set([
    "5005000",
    "2222222",
    "5555555",
    "7777777",
    "8001234",
    "7070707",
    "1231234",
    "1001000",
    "2002000",
  ]);
  if (classic.has(subscriber)) return "FULL_RHYTHM_EXCEPTIONAL";

  return null;
}

function classifyLast4(last4: string): PersonalPatternKind {
  if (/^(\d)\1{3}$/.test(last4)) return "AAAA";
  if (ABAB_LAST4.has(last4) || /^(\d{2})\1$/.test(last4)) return "ABAB";
  if (SEQUENCE_LAST4.has(last4)) return "SEQUENCE";
  if (A000_LAST4.has(last4) || /^[1-9]000$/.test(last4)) return "A000";
  if (isAabb(last4)) return "AABB";
  if (isWeakAbba(last4)) return "ABBA_WEAK";
  return "NONE";
}

function tierForKind(kind: PersonalPatternKind, fullKind: PersonalPatternKind | null): PersonalCustomerTier {
  const effective = fullKind && fullKind !== "NONE" ? fullKind : kind;
  switch (effective) {
    case "FULL_RHYTHM_EXCEPTIONAL":
    case "FULL_RHYTHM":
      return "exceptional";
    case "AAAA":
      return "very_memorable";
    case "ABAB":
    case "SEQUENCE":
    case "A000":
      return "memorable";
    case "AABB":
    case "ABBA_WEAK":
      return "nice";
    default:
      return "nice";
  }
}

function scoreForTier(tier: PersonalCustomerTier): number {
  switch (tier) {
    case "exceptional":
      return 92;
    case "very_memorable":
      return 78;
    case "memorable":
      return 62;
    case "nice":
      return 42;
    default:
      return 20;
  }
}

function customerLabelFor(tier: PersonalCustomerTier): string {
  switch (tier) {
    case "exceptional":
      return "Exceptional";
    case "very_memorable":
      return "Very Memorable";
    case "memorable":
      return "Memorable";
    case "nice":
      return "Nice";
    default:
      return "Standard";
  }
}

function bulletsFor(
  kind: PersonalPatternKind,
  fullKind: PersonalPatternKind | null,
  last4: string,
  subscriber: string,
): string[] {
  const bullets: string[] = [];
  const full = fullKind && fullKind !== "NONE";

  if (full) {
    if (fullKind === "FULL_RHYTHM_EXCEPTIONAL") {
      bullets.push(`Strong ${subscriber.slice(0, 3)}-${subscriber.slice(3)} pattern`);
      bullets.push("Memorable across the full number");
    } else {
      bullets.push("Strong full-number rhythm");
    }
  }

  if (kind === "AAAA") {
    bullets.push("Four matching ending digits");
  } else if (kind === "ABAB") {
    bullets.push(`Repeating ${last4.slice(0, 2)}-${last4.slice(2)} pattern`);
  } else if (kind === "SEQUENCE") {
    bullets.push("Easy numeric sequence ending");
  } else if (kind === "A000") {
    bullets.push(`Clean ${last4} ending`);
  } else if (kind === "AABB") {
    bullets.push(`Repeating pair ending (${last4})`);
  } else if (kind === "ABBA_WEAK") {
    bullets.push("Symmetrical ending");
  }

  if (!bullets.some((b) => b.includes("remember"))) {
    bullets.push("Easy to say and remember");
  }

  return bullets.slice(0, 3);
}

export function analyzePersonalNumber(phoneNumber: string): PersonalPatternAnalysis {
  const digits = parsePhoneDigits(phoneNumber);
  const subscriber = digits.length === 10 ? digits.slice(3) : "";
  const last4 = subscriber.slice(-4);

  const fullKind = subscriber.length === 7 ? detectFullRhythm(subscriber) : null;
  const last4Kind = classifyLast4(last4);

  const kind =
    fullKind && (fullKind === "FULL_RHYTHM_EXCEPTIONAL" || fullKind === "FULL_RHYTHM")
      ? fullKind
      : last4Kind;

  const tier = tierForKind(last4Kind, fullKind);
  const numberQualityScore = scoreForTier(tier);

  return {
    kind,
    tier,
    lastFourPattern: last4Kind === "NONE" ? last4 : last4Kind,
    fullNumberPattern: fullKind ?? undefined,
    numberQualityScore,
    customerLabel: customerLabelFor(tier),
    bulletLabels: bulletsFor(last4Kind, fullKind, last4, subscriber),
  };
}

export function applyPersonalScoringToCandidate<T extends {
  phoneNumber: string;
  numberQualityScore: number;
  businessMatchScore: number;
  matchedWords: string[];
  businessReasons: unknown[];
  numberQualityReasons: { label: string; points: number }[];
  matchedPatterns: string[];
  score: number;
  tier: import("./types").QualityTier;
}>(candidate: T): T & { personalPattern: PersonalPatternAnalysis } {
  const analysis = analyzePersonalNumber(candidate.phoneNumber);
  candidate.numberQualityScore = analysis.numberQualityScore;
  candidate.businessMatchScore = 0;
  candidate.matchedWords = [];
  candidate.businessReasons = [];
  candidate.matchedPatterns = [analysis.customerLabel];
  candidate.numberQualityReasons = [
    {
      label: `Personal pattern: ${analysis.kind}`,
      points: analysis.numberQualityScore,
    },
  ];
  candidate.score = analysis.numberQualityScore;
  candidate.tier =
    analysis.tier === "exceptional"
      ? "Exceptional"
      : analysis.tier === "very_memorable"
        ? "Premium"
        : analysis.tier === "memorable"
          ? "Good"
          : analysis.tier === "nice"
            ? "Nice"
            : "Ordinary";

  return { ...candidate, personalPattern: analysis };
}
