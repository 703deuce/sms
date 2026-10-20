import { fmtCallPhone } from "@/lib/voice/calls/display";

export function formatCallbackSms(input: {
  businessLabel?: string;
  callerName?: string | null;
  callerPhone: string;
  reason?: string | null;
  receivedAt: Date;
}): string {
  const brand = input.businessLabel?.trim() || "Transovo";
  const name = input.callerName?.trim() || "Caller";
  const phone = fmtCallPhone(input.callerPhone);
  const time = input.receivedAt.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const reason = input.reason?.trim() || "Callback requested";
  return `${brand} — New callback request\n${name}\n${phone}\nReason: ${reason}\nReceived: ${time}`;
}

export function formatCallbackEmail(input: {
  businessLabel?: string;
  callerName?: string | null;
  callerPhone: string;
  reason?: string | null;
  collectedLines: string[];
  receivedAt: Date;
  callDetailHref: string;
}): { subject: string; html: string; text: string } {
  const brand = input.businessLabel?.trim() || "Transovo";
  const subject = `${brand} — New after-hours callback`;
  const name = input.callerName?.trim() || "Unknown";
  const phone = fmtCallPhone(input.callerPhone);
  const reason = input.reason?.trim() || "—";
  const time = input.receivedAt.toLocaleString();
  const collected =
    input.collectedLines.length > 0
      ? input.collectedLines.map((l) => `<li>${l}</li>`).join("")
      : "<li>—</li>";
  const html = `
<h2>New after-hours callback</h2>
<p><strong>Caller</strong><br/>${name}</p>
<p><strong>Phone</strong><br/>${phone}</p>
<p><strong>Reason</strong><br/>${reason}</p>
<p><strong>Information collected</strong></p>
<ul>${collected}</ul>
<p><strong>Outcome</strong><br/>Callback requested</p>
<p><strong>Call time</strong><br/>${time}</p>
<p><a href="${input.callDetailHref}">View full call</a></p>`.trim();
  const text = [
    "New after-hours callback",
    "",
    `Caller: ${name}`,
    `Phone: ${phone}`,
    `Reason: ${reason}`,
    "",
    "Information collected:",
    ...input.collectedLines.map((l) => `- ${l}`),
    "",
    "Outcome: Callback requested",
    `Call time: ${time}`,
    `View call: ${input.callDetailHref}`,
  ].join("\n");
  return { subject, html, text };
}
