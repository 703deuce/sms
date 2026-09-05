import { publicVideoMeetingUrl } from "@/lib/transovo-video/meeting-url";

export function buildVideoInviteText(input: {
  title: string;
  joinUrl: string;
  scheduledStartAt?: Date | string | null;
  businessName?: string | null;
}) {
  const title = input.title.trim() || "Transovo Video meeting";
  const lines: string[] = [];
  if (input.businessName) {
    lines.push(input.businessName);
  }
  lines.push(`You're invited to: ${title}`);
  if (input.scheduledStartAt) {
    const when = new Date(input.scheduledStartAt);
    if (!Number.isNaN(when.getTime())) {
      lines.push(`When: ${when.toLocaleString()}`);
    }
  }
  lines.push(`Join: ${input.joinUrl}`);
  return lines.join("\n");
}

export function buildVideoInviteEmail(input: {
  title: string;
  joinUrl: string;
  scheduledStartAt?: Date | string | null;
  businessName?: string | null;
}) {
  const title = input.title.trim() || "Transovo Video meeting";
  const when = input.scheduledStartAt ? new Date(input.scheduledStartAt) : null;
  const whenLine =
    when && !Number.isNaN(when.getTime())
      ? `<p><strong>When:</strong> ${when.toLocaleString()}</p>`
      : "";
  const org = input.businessName
    ? `<p style="color:#64748b;margin:0 0 12px">${input.businessName}</p>`
    : "";

  return {
    subject: input.scheduledStartAt ? `Meeting invite: ${title}` : `Join: ${title}`,
    htmlContent: `
      <div style="font-family:sans-serif;line-height:1.5;color:#0f172a">
        ${org}
        <h2 style="margin:0 0 12px;font-size:20px">${title}</h2>
        ${whenLine}
        <p><a href="${input.joinUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px">Join meeting</a></p>
        <p style="color:#64748b;font-size:13px">Or copy this link:<br><a href="${input.joinUrl}">${input.joinUrl}</a></p>
      </div>
    `.trim(),
    textContent: buildVideoInviteText(input),
  };
}

export function resolveVideoMeetingJoinUrl(publicMeetingToken: string) {
  const path = publicVideoMeetingUrl(publicMeetingToken);
  if (path.startsWith("http")) return path;
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}
