import { fmtCallPhone } from "@/lib/voice/calls/display";

export type TransferAttemptLine = {
  label: string;
  outcome: string;
};

export function formatTransferSms(input: {
  businessLabel?: string;
  callerName?: string | null;
  callerPhone: string;
  reason?: string | null;
  connectedLabel?: string | null;
  attempts?: TransferAttemptLine[];
  exhausted?: boolean;
  noEligibleDestinations?: boolean;
  receivedAt: Date;
}): string {
  const brand = input.businessLabel?.trim() || "Transovo";
  const name = input.callerName?.trim() || "Caller";
  const phone = fmtCallPhone(input.callerPhone);
  const reason = input.reason?.trim() || "Emergency call";
  const time = input.receivedAt.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (input.noEligibleDestinations) {
    return `${brand} — No on-call team scheduled\n${name}\n${phone}\n${reason}\nNobody was on call at this time.\nCaller returned to Amy.`;
  }

  if (input.exhausted) {
    const tried =
      input.attempts?.length
        ? input.attempts.map((a) => `${a.label} — ${a.outcome}`).join("\n")
        : "No destinations answered";
    return `${brand} — Emergency transfer failed\n${name}\n${phone}\n${reason}\nTried:\n${tried}\nCaller returned to Amy.`;
  }

  const dest = input.connectedLabel?.trim() || "On-call";
  return `${brand} — Emergency call\n${name}\n${phone}\n${reason}\nTransferred to ${dest} at ${time}.`;
}

export function formatTransferEmail(input: {
  businessLabel?: string;
  callerName?: string | null;
  callerPhone: string;
  reason?: string | null;
  connectedLabel?: string | null;
  attempts?: TransferAttemptLine[];
  exhausted?: boolean;
  receivedAt: Date;
  callDetailHref: string;
}): { subject: string; html: string; text: string } {
  const brand = input.businessLabel?.trim() || "Transovo";
  const exhausted = input.exhausted === true;
  const subject = exhausted
    ? `${brand} — Emergency transfer failed`
    : `${brand} — Emergency call transferred`;
  const name = input.callerName?.trim() || "Unknown";
  const phone = fmtCallPhone(input.callerPhone);
  const reason = input.reason?.trim() || "—";
  const time = input.receivedAt.toLocaleString();
  const attemptsHtml =
    input.attempts?.map((a) => `<li>${a.label} — ${a.outcome}</li>`).join("") || "";
  const outcome = exhausted
    ? "Transfer failed — caller returned to Amy"
    : `Transferred to ${input.connectedLabel || "on-call"}`;

  const html = `
<h2>${exhausted ? "Emergency transfer failed" : "Emergency call transferred"}</h2>
<p><strong>Caller</strong><br/>${name}</p>
<p><strong>Phone</strong><br/>${phone}</p>
<p><strong>Reason</strong><br/>${reason}</p>
${attemptsHtml ? `<p><strong>Attempts</strong></p><ul>${attemptsHtml}</ul>` : ""}
<p><strong>Outcome</strong><br/>${outcome}</p>
<p><strong>Call time</strong><br/>${time}</p>
<p><a href="${input.callDetailHref}">View full call</a></p>`.trim();

  const text = [
    exhausted ? "Emergency transfer failed" : "Emergency call transferred",
    "",
    `Caller: ${name}`,
    `Phone: ${phone}`,
    `Reason: ${reason}`,
    ...(input.attempts?.map((a) => `- ${a.label}: ${a.outcome}`) ?? []),
    `Outcome: ${outcome}`,
    `Call time: ${time}`,
    `View call: ${input.callDetailHref}`,
  ].join("\n");

  return { subject, html, text };
}
