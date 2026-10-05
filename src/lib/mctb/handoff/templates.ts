import type { MctbLeadSnapshotDerived, MctbLeadSnapshotFacts } from "./types";
import type { MctbTeamActivityBrief } from "./team-activity-brief-types";

export type NotificationRenderInput = {
  businessName: string;
  eventType: string;
  urgent?: boolean;
  facts: MctbLeadSnapshotFacts;
  derived?: MctbLeadSnapshotDerived;
  teamBrief?: MctbTeamActivityBrief | null;
  conversationUrl?: string;
  missedCallUrl?: string;
  callTelUrl?: string;
};

export function renderMctbTeamSms(input: NotificationRenderInput): string {
  const lines: string[] = [];
  const latestReply =
    input.facts.customerMessages?.length
      ? input.facts.customerMessages[input.facts.customerMessages.length - 1]?.trim()
      : "";

  if (input.eventType === "caller_replied" || input.eventType === "callback_requested") {
    lines.push(`New missed-call reply — ${input.businessName}`);
    lines.push("");
    const phone = input.facts.callerPhone || "";
    if (phone) lines.push(phone);
    if (latestReply) {
      lines.push("");
      const quoted = latestReply.length > 420 ? `${latestReply.slice(0, 417)}…` : latestReply;
      lines.push(`"${quoted}"`);
    }
  } else if (input.urgent) {
    lines.push("URGENT — callback requested");
    lines.push("");
    const name = input.facts.callerName || "Caller";
    const phone = input.facts.callerPhone || "";
    lines.push(name);
    if (phone) lines.push(phone);
    lines.push("");
    if (latestReply) lines.push(latestReply);
  } else {
    lines.push("New missed-call lead");
    lines.push("");
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
  const subject =
    input.eventType === "forwarding_degraded"
      ? `Call forwarding may have stopped — ${input.businessName}`
      : urgent
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

  const brief = input.teamBrief;
  const excerpt = brief
    ? null
    : (input.facts.customerMessages || []).slice(-2).join(" / ");

  const briefHtml = brief
    ? `<div style="margin:16px 0;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
<h3 style="margin:0 0 8px;font-size:16px">${escapeHtml(brief.headline)}</h3>
<p style="margin:0 0 12px;line-height:1.5;color:#374151">${escapeHtml(brief.summary)}</p>
${
  brief.bullets.length
    ? `<ul style="margin:0 0 12px;padding-left:20px;color:#374151">${brief.bullets
        .map((b) => `<li style="margin:4px 0">${escapeHtml(b)}</li>`)
        .join("")}</ul>`
    : ""
}
<p style="margin:0;font-weight:600;color:#111827">Next step: ${escapeHtml(brief.recommendedNextStep)}</p>
</div>`
    : "";

  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
<h2 style="margin:0 0 12px">${urgent ? "Urgent missed-call lead" : "Missed call update"}</h2>
<p style="color:#6b7280;margin:0 0 16px">${escapeHtml(input.businessName)}</p>
${briefHtml}
<table>${htmlRows}</table>
${excerpt ? `<p style="margin-top:16px"><strong>Customer said:</strong> ${escapeHtml(excerpt)}</p>` : ""}
${input.conversationUrl ? `<p style="margin-top:20px"><a href="${input.conversationUrl}">Open conversation</a></p>` : ""}
${input.missedCallUrl ? `<p><a href="${input.missedCallUrl}">View missed call</a></p>` : ""}
</div>`;

  const text = [
    subject,
    brief?.headline,
    brief?.summary,
    ...(brief?.bullets?.map((b) => `• ${b}`) ?? []),
    brief ? `Next step: ${brief.recommendedNextStep}` : "",
    ...factRows.map(([k, v]) => `${k}: ${v}`),
    excerpt ? `Customer said: ${excerpt}` : "",
    input.conversationUrl ? `Conversation: ${input.conversationUrl}` : "",
    input.missedCallUrl ? `Missed call: ${input.missedCallUrl}` : "",
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
