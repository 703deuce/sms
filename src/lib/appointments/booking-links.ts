import "server-only";

import { randomBytes } from "crypto";
import { getPrisma } from "@/lib/db";
import type { ReminderStepExtended, SingleUseBookingLink } from "@/lib/appointments/scheduling-capabilities";

export function createSingleUseBookingToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createSingleUseBookingLink(
  workspaceId: string,
  input: {
    appointmentTypeId: string;
    expiresAt?: Date;
    maxUses?: number;
    createdBy?: string;
  },
): Promise<SingleUseBookingLink> {
  const prisma = getPrisma();
  const token = createSingleUseBookingToken();
  const link: SingleUseBookingLink = {
    id: `sul_${randomBytes(8).toString("hex")}`,
    token,
    appointmentTypeId: input.appointmentTypeId,
    expiresAt: input.expiresAt?.toISOString(),
    maxUses: input.maxUses ?? 1,
    usedCount: 0,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };

  const platform = await import("@/lib/appointments/settings").then((m) =>
    m.loadAppointmentPlatformConfig(workspaceId),
  );
  const links = ((platform as { singleUseLinks?: SingleUseBookingLink[] }).singleUseLinks || []).concat(
    link,
  );
  const { saveAppointmentPlatformConfig } = await import("@/lib/appointments/settings");
  await saveAppointmentPlatformConfig(workspaceId, { singleUseLinks: links } as object);

  return link;
}

export async function resolveSingleUseBookingLink(
  workspaceId: string,
  token: string,
): Promise<{ link: SingleUseBookingLink; appointmentTypeId: string } | null> {
  const { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } = await import(
    "@/lib/appointments/settings"
  );
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const links = (platform as { singleUseLinks?: SingleUseBookingLink[] }).singleUseLinks || [];
  const link = links.find((l) => l.token === token);
  if (!link) return null;
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return null;
  if (link.usedCount >= link.maxUses) return null;
  return { link, appointmentTypeId: link.appointmentTypeId };
}

export async function consumeSingleUseBookingLink(workspaceId: string, token: string) {
  const { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } = await import(
    "@/lib/appointments/settings"
  );
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const links = (platform as { singleUseLinks?: SingleUseBookingLink[] }).singleUseLinks || [];
  const updated = links.map((l) =>
    l.token === token ? { ...l, usedCount: l.usedCount + 1 } : l,
  );
  await saveAppointmentPlatformConfig(workspaceId, { singleUseLinks: updated } as object);
}

export function embedBookingUrl(slug: string, opts?: { typeId?: string; theme?: string }) {
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const params = new URLSearchParams();
  if (opts?.typeId) params.set("type", opts.typeId);
  if (opts?.theme) params.set("theme", opts.theme);
  const q = params.toString();
  return `${base}/embed/book/${slug}${q ? `?${q}` : ""}`;
}

export function popupBookingScript(slug: string): string {
  const url = embedBookingUrl(slug);
  return `(function(){var w=window.open('${url}','transovo-book','width=480,height=720');if(!w)location.href='${url}';})();`;
}

export async function storeReturningInviteeCookieData(
  workspaceId: string,
  input: { email?: string; phone?: string; firstName?: string; lastName?: string },
) {
  return {
    key: `transovo_invitee_${workspaceId}`,
    value: Buffer.from(JSON.stringify(input)).toString("base64url"),
  };
}

export function parseReturningInviteeCookie(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
    };
  } catch {
    return null;
  }
}
