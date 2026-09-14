const ACK_HOLDING = [
  "Absolutely. Give me just a moment while I check that for you.",
  "Sure — I'm pulling up the calendar now.",
  "Okay — let me check that for you.",
];

const EXTENDED_HOLDING = [
  "I'm still checking the calendar for you.",
  "Still working on that — one moment.",
  "I'm still pulling that up.",
];

const PRODUCTIVE_CLARIFICATIONS = [
  "While I have you, is afternoon definitely better than morning?",
  "Is this appointment for the same service address you called about?",
  "About how soon were you hoping to get someone out?",
];

export function pickInitialHoldingPhrase(seed?: string): string {
  if (!seed) return ACK_HOLDING[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i)) % ACK_HOLDING.length;
  return ACK_HOLDING[hash] || ACK_HOLDING[0];
}

export function pickExtendedHoldingPhrase(operationId: string, attemptCount: number): string {
  if (attemptCount >= 2 && attemptCount % 2 === 0) {
    const idx = operationId.length % PRODUCTIVE_CLARIFICATIONS.length;
    return PRODUCTIVE_CLARIFICATIONS[idx];
  }
  const idx = operationId.length % EXTENDED_HOLDING.length;
  return EXTENDED_HOLDING[idx];
}

export function bookingInProgressHolding(slotLabel?: string | null): string {
  if (slotLabel?.trim()) {
    return `Perfect. I'm locking in the ${slotLabel.trim()} appointment now.`;
  }
  return "Perfect. I'm locking that appointment in now.";
}

export function terminalFailureSpeak(allowBookingLinkFallback?: boolean): string {
  if (allowBookingLinkFallback) {
    return "I'm having trouble checking the live calendar. I can text you the booking link instead if you'd like.";
  }
  return "I'm having trouble reaching the calendar right now. I can take your preferred time and have the team follow up.";
}
