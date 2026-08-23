import { getPrisma } from "@/lib/db";
import { getNotificationPrefs } from "@/lib/settings/notification-prefs";
import { sendTransactionalEmail } from "@/lib/email/brevo";

type EmailNotifyInput = {
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
  subject: string;
  htmlContent: string;
  textContent?: string;
};

type NotificationType = string;

/**
 * Email fan-out to workspace members who have not disabled email for this type.
 * Uses notifyEmail on prefs when set, otherwise the user's account email.
 */
export async function notifyWorkspaceByEmail(
  workspaceId: string,
  input: EmailNotifyInput,
) {
  const prisma = getPrisma();
  const memberships = await prisma.membership.findMany({
    where: { workspaceId },
    select: { userId: true },
  });
  const sent: string[] = [];
  for (const m of memberships) {
    const prefs = await getNotificationPrefs(workspaceId, m.userId).catch(() => null);
    const typePref =
      prefs?.prefs && typeof prefs.prefs === "object"
        ? (prefs.prefs as Record<string, { email?: boolean } | undefined>)[String(input.type)]
        : undefined;
    if (typePref?.email === false) continue;

    let to = prefs?.notifyEmail?.trim() || "";
    if (!to) {
      const user = await prisma.user.findUnique({
        where: { id: m.userId },
        select: { email: true },
      });
      to = user?.email?.trim() || "";
    }
    if (!to || sent.includes(to)) continue;

    await sendTransactionalEmail({
      to,
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
    }).catch(() => undefined);
    sent.push(to);
  }
  return { sent };
}
