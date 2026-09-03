/**
 * Pure AI Booking Protection policy — testable without DB.
 */

export type BookingProtectionMode = "standard" | "strict" | "off";
export type BookingRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type BookingRiskEvaluation = {
  riskScore: number;
  riskLevel: BookingRiskLevel;
  signals: string[];
  action: "allow" | "challenge" | "block";
};

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "yopmail.com",
]);

export function scoreLevel(score: number): BookingRiskLevel {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

export function looksGibberish(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  if (/^[bcdfghjklmnpqrstvwxyz]{6,}$/i.test(t)) return true;
  if (/(.)\1{4,}/.test(t)) return true;
  if (/https?:\/\//i.test(t)) return true;
  return false;
}

export function classifyBookingHeuristics(input: {
  phone: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  notes?: string;
  bookingAnswers?: Record<string, string>;
  honeypot?: string;
  formStartedAt?: number;
  ipAttempts: number;
  recentPhoneBookings?: number;
}): BookingRiskEvaluation {
  let score = 0;
  const signals: string[] = [];

  if (input.honeypot?.trim()) {
    score += 80;
    signals.push("honeypot_filled");
  }

  if (input.ipAttempts >= 8) {
    score += 50;
    signals.push("velocity_anomaly");
  } else if (input.ipAttempts >= 4) {
    score += 25;
    signals.push("rapid_submission");
  }

  const phoneDigits = input.phone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    score += 30;
    signals.push("invalid_phone");
  }

  if (input.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      score += 25;
      signals.push("malformed_email");
    } else if (isDisposableEmail(input.email)) {
      score += 35;
      signals.push("disposable_email");
    }
  }

  const name = `${input.firstName || ""} ${input.lastName || ""}`.trim();
  if (name && looksGibberish(name)) {
    score += 20;
    signals.push("suspicious_name");
  }
  if (input.notes && looksGibberish(input.notes)) {
    score += 25;
    signals.push("suspicious_notes");
  }

  for (const value of Object.values(input.bookingAnswers || {})) {
    if (looksGibberish(value)) {
      score += 15;
      signals.push("suspicious_custom_answer");
      break;
    }
  }

  if (input.formStartedAt && Date.now() - input.formStartedAt < 1500) {
    score += 20;
    signals.push("form_completion_too_fast");
  }

  if ((input.recentPhoneBookings || 0) >= 5) {
    score += 30;
    signals.push("repeated_phone");
  }

  const riskScore = Math.min(100, score);
  return { riskScore, riskLevel: scoreLevel(riskScore), signals, action: "allow" };
}

export function resolveBookingProtectionAction(
  evaluation: BookingRiskEvaluation,
  mode: BookingProtectionMode,
  humanVerification?: boolean,
): BookingRiskEvaluation {
  if (mode === "off") {
    return { ...evaluation, action: "allow" };
  }

  if (evaluation.riskLevel === "HIGH") {
    return { ...evaluation, action: "block" };
  }

  if (evaluation.riskLevel === "MEDIUM") {
    if (humanVerification) {
      return { ...evaluation, action: "allow" };
    }
    return { ...evaluation, action: mode === "strict" ? "block" : "challenge" };
  }

  if (mode === "strict" && evaluation.riskScore >= 25 && !humanVerification) {
    return { ...evaluation, action: "challenge" };
  }

  return { ...evaluation, action: "allow" };
}
