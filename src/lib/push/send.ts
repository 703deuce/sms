import webpush from "web-push";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:support@transovo.ai";

let configured = false;

function ensureVapid() {
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPushToUser(
  workspaceId: string,
  userId: string,
  payload: PushPayload,
) {
  if (!ensureVapid()) {
    console.log("[push] VAPID keys not set — skipping push", { workspaceId, userId, payload });
    return { sent: 0, skipped: true };
  }

  const { getPrisma } = await import("@/lib/db");
  const subs = await getPrisma().pushSubscription.findMany({
    where: { workspaceId, userId },
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      console.error("[push] send failed", sub.endpoint, err);
    }
  }
  return { sent, skipped: false };
}

export async function sendPushToWorkspaceAgents(
  workspaceId: string,
  payload: PushPayload,
) {
  if (!ensureVapid()) {
    console.log("[push] VAPID keys not set — skipping workspace push", { workspaceId, payload });
    return { sent: 0, skipped: true };
  }

  const { getPrisma } = await import("@/lib/db");
  const subs = await getPrisma().pushSubscription.findMany({
    where: { workspaceId },
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      console.error("[push] send failed", sub.endpoint, err);
    }
  }
  return { sent, skipped: false };
}
