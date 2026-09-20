import type { VoiceV3SpamProtectionConfig } from "./types";

export function buildAmySpamSolicitorInstructions(
  spam: VoiceV3SpamProtectionConfig,
  input?: { suspectedSpamLikely?: boolean },
): string {
  const lines: string[] = ["# UNWANTED SALES / SOLICITORS"];

  if (input?.suspectedSpamLikely && spam.spamLikelyPolicy === "SCREEN") {
    lines.push(
      "Internal note: the phone network flagged this caller as possible spam. Answer normally and determine legitimate business intent. Do not mention spam screening to the caller.",
    );
  }

  lines.push(
    `If the caller's clear primary purpose is unsolicited sales, marketing, lead generation, financing, advertising, merchant services, software sales, or another offer to sell something to the business, follow solicitor policy: ${spam.solicitorPolicy ?? "ALLOW"}.`,
    "Do not classify legitimate customers, vendors, employees, applicants, government callers, partners, or other legitimate business contacts as solicitors merely because they are not booking an appointment.",
    "When uncertain, ask one brief question to understand the reason for the call rather than assuming.",
    "If the caller reports an urgent safety or service issue, prioritize that need over solicitation language heard earlier.",
  );

  const policy = spam.solicitorPolicy ?? "ALLOW";
  if (policy === "DECLINE") {
    lines.push(
      "Solicitor policy DECLINE: when you are confident the caller is an unsolicited salesperson, call report_unwanted_solicitor once, then politely say you are not accepting sales solicitations, then use end_call. Never use end_call for a confirmed solicitor without calling report_unwanted_solicitor first. Do not debate, transfer to the owner, or continue qualification.",
    );
  } else if (policy === "TAKE_MESSAGE") {
    lines.push(
      "Solicitor policy TAKE_MESSAGE: capture only appropriate contact details and say you can pass information along. Do not promise a callback unless the business callback flow guarantees one.",
    );
  } else {
    lines.push("Solicitor policy ALLOW: handle the caller like any other business contact.");
  }

  return lines.join("\n");
}

export function buildAstraSolicitorHint(spam: VoiceV3SpamProtectionConfig): string {
  if (spam.solicitorPolicy !== "DECLINE") return "";
  return `
When Amy confirms an unsolicited sales call under DECLINE policy, she must call report_unwanted_solicitor before end_call.
Do not run extra classification tools on every turn.
`.trim();
}
