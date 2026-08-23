import "server-only";

import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const PIN_SALT_ROUNDS = 10;
const MAX_PIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function listAuthorizedCallers(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingAuthorizedCaller.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phoneE164: true,
      active: true,
      outboundEnabled: true,
      userId: true,
      failedPinAttempts: true,
      lockedUntil: true,
      lastAccessAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createAuthorizedCaller(input: {
  workspaceId: string;
  name: string;
  phoneE164: string;
  pin: string;
  userId?: string | null;
}) {
  const prisma = getPrisma();
  const phone = normalizeE164(input.phoneE164);
  const pin = String(input.pin || "").trim();
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN must be 4–6 digits");
  }
  const pinHash = await bcrypt.hash(pin, PIN_SALT_ROUNDS);
  return prisma.smartRoutingAuthorizedCaller.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      phoneE164: phone,
      pinHash,
      userId: input.userId ?? null,
    },
    select: {
      id: true,
      name: true,
      phoneE164: true,
      active: true,
      outboundEnabled: true,
      createdAt: true,
    },
  });
}

export async function updateAuthorizedCaller(
  workspaceId: string,
  id: string,
  patch: Partial<{ name: string; active: boolean; outboundEnabled: boolean }>,
) {
  const prisma = getPrisma();
  return prisma.smartRoutingAuthorizedCaller.update({
    where: { id, workspaceId },
    data: patch,
    select: {
      id: true,
      name: true,
      phoneE164: true,
      active: true,
      outboundEnabled: true,
    },
  });
}

export async function resetAuthorizedCallerPin(
  workspaceId: string,
  id: string,
  pin: string,
) {
  const pinStr = String(pin || "").trim();
  if (!/^\d{4,6}$/.test(pinStr)) throw new Error("PIN must be 4–6 digits");
  const pinHash = await bcrypt.hash(pinStr, PIN_SALT_ROUNDS);
  const prisma = getPrisma();
  return prisma.smartRoutingAuthorizedCaller.update({
    where: { id, workspaceId },
    data: { pinHash, failedPinAttempts: 0, lockedUntil: null },
  });
}

export async function deleteAuthorizedCaller(workspaceId: string, id: string) {
  const prisma = getPrisma();
  await prisma.smartRoutingAuthorizedCaller.deleteMany({ where: { id, workspaceId } });
}

export async function verifyAuthorizedCallerPin(input: {
  workspaceId: string;
  callerId: string;
  pin: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingAuthorizedCaller.findFirst({
    where: { id: input.callerId, workspaceId: input.workspaceId, active: true },
  });
  if (!row) return { ok: false, reason: "caller_not_found" };
  if (row.lockedUntil && row.lockedUntil > new Date()) {
    return { ok: false, reason: "locked" };
  }
  const pin = String(input.pin || "").trim();
  const match = await bcrypt.compare(pin, row.pinHash);
  if (!match) {
    const attempts = row.failedPinAttempts + 1;
    const lockedUntil =
      attempts >= MAX_PIN_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null;
    await prisma.smartRoutingAuthorizedCaller.update({
      where: { id: row.id },
      data: { failedPinAttempts: attempts, lockedUntil },
    });
    return { ok: false, reason: attempts >= MAX_PIN_ATTEMPTS ? "locked" : "invalid_pin" };
  }
  await prisma.smartRoutingAuthorizedCaller.update({
    where: { id: row.id },
    data: { failedPinAttempts: 0, lockedUntil: null, lastAccessAt: new Date() },
  });
  return { ok: true };
}

import {
  isBlockedCallbackDestination,
  isDomesticCallbackDestination,
} from "./callback-destination-policy";
