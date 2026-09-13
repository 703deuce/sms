const FALSE_SUCCESS_PATTERNS: Array<{ re: RegExp; claim: string }> = [
  { re: /\byou(?:'re| are) booked\b/i, claim: "booking" },
  { re: /\bbooked for\b/i, claim: "booking" },
  { re: /\bi sent (?:the |your )?(?:link|booking)\b/i, claim: "sms_link" },
  { re: /\bsent (?:the |your )?(?:link|booking link)\b/i, claim: "sms_link" },
  { re: /\bpayment (?:went through|is complete)\b/i, claim: "payment" },
  { re: /\bi notified (?:the )?team\b/i, claim: "notification" },
  { re: /\bsomeone (?:has been |was )?scheduled\b/i, claim: "booking" },
];

export function detectFalseSuccessClaims(reply: string): string[] {
  const hits: string[] = [];
  for (const p of FALSE_SUCCESS_PATTERNS) {
    if (p.re.test(reply)) hits.push(p.claim);
  }
  return hits;
}

export function assertNoFalseSuccess(input: {
  reply: string;
  bookingConfirmed?: boolean;
  smsLinkSent?: boolean;
  paymentSent?: boolean;
  teamNotified?: boolean;
}): string[] {
  const claims = detectFalseSuccessClaims(input.reply);
  const errors: string[] = [];
  for (const claim of claims) {
    if (claim === "booking" && !input.bookingConfirmed) {
      errors.push(`FALSE_SUCCESS booking: ${input.reply.slice(0, 120)}`);
    }
    if (claim === "sms_link" && !input.smsLinkSent) {
      errors.push(`FALSE_SUCCESS sms_link: ${input.reply.slice(0, 120)}`);
    }
    if (claim === "payment" && !input.paymentSent) {
      errors.push(`FALSE_SUCCESS payment: ${input.reply.slice(0, 120)}`);
    }
    if (claim === "notification" && !input.teamNotified) {
      errors.push(`FALSE_SUCCESS notification: ${input.reply.slice(0, 120)}`);
    }
  }
  return errors;
}
