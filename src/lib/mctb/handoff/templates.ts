import type { MctbLeadSnapshotDerived, MctbLeadSnapshotFacts } from "./types";

export type NotificationRenderInput = {
  businessName: string;
  eventType: string;
  urgent?: boolean;
  facts: MctbLeadSnapshotFacts;
  derived?: MctbLeadSnapshotDerived;
  conversationUrl?: string;
  missedCallUrl?: string;
  callTelUrl?: string;
};

export function renderMctbTeamSms(input: NotificationRenderInput): string {
  const lines: string[] = [];
  if (input.urgent) {
    lines.push("URGENT — callback requested");
    lines.push("");
  } else {
    lines.push("New missed-call lead");
    lines.push("");
  }

  const name = input.facts.callerName || "Caller";
  const phone = input.facts.callerPhone || "";
  lines.push(name);
  if (phone) lines.push(phone);
  lines.push("");

  if (input.facts.serviceReason) lines.push(input.facts.serviceReason);
  if (input.facts.locationZip) lines.push(input.facts.locationZip);
  if (input.facts.callbackTime) lines.push(`Callback: ${input.facts.callbackTime}`);
  if (input.derived?.urgencyClassification && input.urgent) {
    lines.push(`Urgency: ${input.derived.urgencyClassification}`);
  }

  if (input.conversationUrl) {
    lines.push("");
    lines.push(`Open: ${input.conversationUrl}`);
  }
  return lines.join("\n").slice(0, 1500);
}

export function renderMctbTeamEmail(input: NotificationRenderInput): {
  subject: string;
  html: string;
  text: string;
} {
  const urgent = input.urgent;
  const subject = urgent
    ? `URGENT missed-call lead — ${input.businessName}`
    : `New missed-call lead — ${input.businessName}`;

  const factRows = [
    ["Caller", input.facts.callerName || "Unknown"],
    ["Phone", input.facts.callerPhone || "—"],
    ["Need", input.facts.serviceReason || "—"],
    ["Location", input.facts.locationZip || input.facts.serviceAddress || "—"],
    ["Callback", input.facts.callbackTime || "—"],
    ["Urgency", input.derived?.urgencyClassification || input.facts.urgency || "—"],
  ];

  const htmlRows = factRows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;font-weight:600;color:#374151">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  const excerpt = (input.facts.customerMessages || []).slice(-2).join(" / ");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
<h2 style="margin:0 0 12px">${urgent ? "Urgent missed-call lead" : "New missed-call lead"}</h2>
<p style="color:#6b7280;margin:0 0 16px">${escapeHtml(input.businessName)}</p>
<table>${htmlRows}</table>
${excerpt ? `<p style="margin-top:16px"><strong>Customer said:</strong> ${escapeHtml(excerpt)}</p>` : ""}
${input.conversationUrl ? `<p style="margin-top:20px"><a href="${input.conversationUrl}">Open conversation</a></p>` : ""}
${input.missedCallUrl ? `<p><a href="${input.missedCallUrl}">View missed call</a></p>` : ""}
</div>`;

  const text = [
    subject,
    ...factRows.map(([k, v]) => `${k}: ${v}`),
    excerpt ? `Customer said: ${excerpt}` : "",
    input.conversationUrl ? `Conversation: ${input.conversationUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
