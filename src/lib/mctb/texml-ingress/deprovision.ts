import "server-only";

import { getPrisma } from "@/lib/db";
import { invalidateMctbTexmlIngressCache } from "./config-cache";

/** Clear MCTB TeXML ingress metadata from a phone row (e.g. when switching DIDs). */
export async function releaseMctbTexmlIngressFromPhone(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<{ ok: boolean; e164: string | null }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true, settingsJson: true },
  });
  if (!phone) return { ok: false, e164: null };

  const settings =
    phone.settingsJson && typeof phone.settingsJson === "object" && !Array.isArray(phone.settingsJson)
      ? { ...(phone.settingsJson as Record<string, unknown>) }
      : {};

  settings.mctbSipIngress = false;
  settings.routingOwner = null;
  delete settings.mctbRole;

  const telephony =
    settings.telephony && typeof settings.telephony === "object" && !Array.isArray(settings.telephony)
      ? { ...(settings.telephony as Record<string, unknown>) }
      : {};
  delete telephony.routingMode;
  delete telephony.routingOwner;
  delete telephony.telnyxTexmlAppId;
  delete telephony.state;
  settings.telephony = telephony;

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: { settingsJson: settings as object },
  });

  if (phone.e164) invalidateMctbTexmlIngressCache(phone.e164);

  return { ok: true, e164: phone.e164 };
}
