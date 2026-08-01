/**
 * Softphone multi-device registration + incoming-call push targeting.
 */

import { getPrisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/send";
import { logHumanCallEvent } from "./call-events";

export async function registerSoftphoneDevice(input: {
  workspaceId: string;
  userId: string;
  deviceKey: string;
  label?: string | null;
  platform?: string;
  userAgent?: string | null;
}) {
  const prisma = getPrisma();
  const deviceKey = input.deviceKey.trim().slice(0, 120);
  if (!deviceKey) throw new Error("deviceKey required");

  const device = await prisma.softphoneDevice.upsert({
    where: {
      workspaceId_userId_deviceKey: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        deviceKey,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      deviceKey,
      label: input.label?.trim() || "Browser softphone",
      platform: input.platform || "browser",
      userAgent: input.userAgent || null,
      lastSeenAt: new Date(),
      active: true,
    },
    update: {
      label: input.label?.trim() || undefined,
      platform: input.platform || undefined,
      userAgent: input.userAgent || undefined,
      lastSeenAt: new Date(),
      active: true,
    },
  });

  // Deactivate stale devices that stopped heartbeating (softphone posts every ~60s).
  const staleBefore = new Date(Date.now() - 15 * 60_000);
  await prisma.softphoneDevice
    .updateMany({
      where: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        active: true,
        lastSeenAt: { lt: staleBefore },
        deviceKey: { not: deviceKey },
      },
      data: { active: false },
    })
    .catch(() => undefined);

  const devices = await prisma.softphoneDevice.findMany({
    where: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      active: true,
    },
    select: { deviceKey: true },
  });

  await prisma.softphonePresence.upsert({
    where: {
      workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId },
    },
    create: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      status: "available",
      deviceIds: devices.map((d: { deviceKey: string }) => d.deviceKey),
      lastRegisteredAt: new Date(),
      queueAvailable: true,
    },
    update: {
      deviceIds: devices.map((d: { deviceKey: string }) => d.deviceKey),
      lastRegisteredAt: new Date(),
    },
  });

  return device;
}

export async function ackSoftphoneIncomingCall(input: {
  workspaceId: string;
  userId: string;
  deviceKey: string;
  humanCallId: string;
}) {
  const prisma = getPrisma();
  const now = new Date();
  await prisma.softphoneDevice.updateMany({
    where: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      deviceKey: input.deviceKey,
    },
    data: {
      lastAckAt: now,
      lastIncomingCallId: input.humanCallId,
      lastSeenAt: now,
    },
  });
  await prisma.softphonePresence.updateMany({
    where: {
      workspaceId: input.workspaceId,
      userId: input.userId,
    },
    data: { lastPushAckAt: now },
  });
  await logHumanCallEvent(input.workspaceId, input.humanCallId, "push.acked", {
    userId: input.userId,
    deviceKey: input.deviceKey,
  });
  return { ok: true };
}

export async function listUserDevices(workspaceId: string, userId: string) {
  return getPrisma().softphoneDevice.findMany({
    where: { workspaceId, userId, active: true },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function userHasCallPushReady(workspaceId: string, userId: string) {
  const prisma = getPrisma();
  const [devices, pushSubs] = await Promise.all([
    prisma.softphoneDevice.count({
      where: { workspaceId, userId, active: true },
    }),
    prisma.pushSubscription.count({ where: { workspaceId, userId } }),
  ]);
  return devices > 0 && pushSubs > 0;
}

/** Notify assigned / queue members of an inbound softphone ring. */
export async function notifyIncomingSoftphoneCall(input: {
  workspaceId: string;
  humanCallId: string;
  fromE164: string;
  toE164: string;
  userIds: string[];
}) {
  const prisma = getPrisma();
  const unique = [...new Set(input.userIds.filter(Boolean))];
  let sent = 0;

  for (const userId of unique) {
    const presence = await prisma.softphonePresence.findUnique({
      where: { workspaceId_userId: { workspaceId: input.workspaceId, userId } },
    });
    if (presence?.status === "dnd" || presence?.status === "offline") continue;

    const result = await sendPushToUser(input.workspaceId, userId, {
      title: "Incoming call",
      body: `${input.fromE164} → ${input.toE164}`,
      url: `/phone?incoming=${encodeURIComponent(input.humanCallId)}`,
      tag: `incoming-call-${input.humanCallId}`,
      kind: "incoming_call",
      humanCallId: input.humanCallId,
      requireInteraction: true,
    });
    sent += result.sent;

    await prisma.softphoneDevice.updateMany({
      where: { workspaceId: input.workspaceId, userId, active: true },
      data: { lastPushAt: new Date(), lastIncomingCallId: input.humanCallId },
    });
  }

  await logHumanCallEvent(input.workspaceId, input.humanCallId, "push.incoming_sent", {
    userIds: unique,
    sent,
  });

  return { sent, targeted: unique.length };
}
