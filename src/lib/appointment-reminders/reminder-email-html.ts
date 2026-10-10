import type { ReminderEmailBranding } from "@/lib/appointments/types";

export function wrapReminderEmailHtml(input: {
  bodyHtml: string;
  businessName: string;
  branding?: ReminderEmailBranding;
  preparationInstructions?: string;
  cancellationPolicyText?: string;
  actionLinks?: { confirm?: string; reschedule?: string; cancel?: string };
}): string {
  const color = input.branding?.brandColor || "#0d9488";
  const logo = input.branding?.logoUrl?.trim();
  const footer = input.branding?.footerText?.trim();
  const directions = input.branding?.directionsUrl?.trim();
  const phone = input.branding?.contactPhone?.trim();

  const actions = [
    input.actionLinks?.confirm
      ? `<a href="${input.actionLinks.confirm}" style="display:inline-block;margin:8px 8px 0 0;padding:10px 16px;background:${color};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Confirm</a>`
      : "",
    input.actionLinks?.reschedule
      ? `<a href="${input.actionLinks.reschedule}" style="display:inline-block;margin:8px 8px 0 0;padding:10px 16px;background:#f4f4f5;color:#18181b;text-decoration:none;border-radius:6px;font-weight:600;">Reschedule</a>`
      : "",
    input.actionLinks?.cancel
      ? `<a href="${input.actionLinks.cancel}" style="display:inline-block;margin:8px 8px 0 0;padding:10px 16px;background:#fef2f2;color:#b91c1c;text-decoration:none;border-radius:6px;font-weight:600;">Cancel</a>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const prep = input.preparationInstructions?.trim()
    ? `<p style="margin:16px 0 0;font-size:14px;color:#52525b;"><strong>Before your visit:</strong> ${escapeHtml(input.preparationInstructions)}</p>`
    : "";
  const policy = input.cancellationPolicyText?.trim()
    ? `<p style="margin:12px 0 0;font-size:13px;color:#71717a;">${escapeHtml(input.cancellationPolicyText)}</p>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e4e4e7;border-radius:8px;">
    <tr><td style="padding:24px 24px 8px;">
      ${logo ? `<img src="${logo}" alt="" height="40" style="display:block;margin-bottom:12px;max-width:180px;"/>` : ""}
      <p style="margin:0;font-size:12px;font-weight:600;color:${color};text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(input.businessName)}</p>
    </td></tr>
    <tr><td style="padding:8px 24px 16px;font-size:15px;line-height:1.55;color:#27272a;">${input.bodyHtml}</td></tr>
    ${actions ? `<tr><td style="padding:0 24px 16px;">${actions}</td></tr>` : ""}
    ${prep || policy ? `<tr><td style="padding:0 24px 20px;border-top:1px solid #f4f4f5;">${prep}${policy}</td></tr>` : ""}
    <tr><td style="padding:16px 24px;background:#fafafa;border-radius:0 0 8px 8px;font-size:12px;color:#71717a;">
      ${phone ? `<div>Questions? Call ${escapeHtml(phone)}</div>` : ""}
      ${directions ? `<div style="margin-top:6px;"><a href="${directions}" style="color:${color};">Directions</a></div>` : ""}
      ${footer ? `<div style="margin-top:8px;">${escapeHtml(footer)}</div>` : ""}
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
