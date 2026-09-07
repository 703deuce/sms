import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { getPrisma } from "@/lib/db";
import {
  normalizePhoneE164,
  pickPreferredSmsSendingNumber,
} from "@/lib/messaging/preferred-sending-number";

export async function GET() {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;

    const prisma = getPrisma();
    const [workspace, numbers] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: auth.workspaceId },
        select: { slug: true, displayName: true, name: true },
      }),
      prisma.phoneNumber.findMany({
        where: { workspaceId: auth.workspaceId },
        select: {
          id: true,
          e164: true,
          number: true,
          status: true,
          type: true,
          a2pStatus: true,
          provider: true,
          settingsJson: true,
        },
      }),
    ]);

    const preferred = pickPreferredSmsSendingNumber(numbers);
    const smsE164 = preferred ? normalizePhoneE164(preferred.e164 || preferred.number) : "";
    const slug = workspace?.slug?.trim();
    const inboundEmail = slug ? `booking+${slug}@inbound.transovo.com` : null;

    return NextResponse.json({
      data: {
        sms: {
          configured: Boolean(smsE164),
          e164: smsE164 || null,
          label: smsE164 ? "Shared inbox number" : null,
        },
        email: {
          configured: Boolean(inboundEmail),
          address: inboundEmail,
          label: inboundEmail ? "Email webhook" : null,
        },
        workspaceName: workspace?.displayName || workspace?.name || null,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
