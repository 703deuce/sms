import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import { mergeContacts, previewContactMerge } from "@/lib/appointments/service-booking/contact-merge";
import { getPrisma } from "@/lib/db";
import { buildClientDetail } from "@/lib/appointments/clients/clients-workspace";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.settings.manage");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: "preview" | "merge";
      sourceContactId?: string;
      targetContactId?: string;
      chosenValues?: Record<string, string>;
    };

    if (!body.sourceContactId || !body.targetContactId) {
      return NextResponse.json({ error: "sourceContactId and targetContactId required" }, { status: 400 });
    }

    if (body.action === "preview") {
      const preview = await previewContactMerge(auth.workspaceId, body.sourceContactId, body.targetContactId);
      const prisma = getPrisma();
      const [srcForms, tgtForms, srcWallet, tgtWallet] = await Promise.all([
        prisma.intakeFormResponse.count({ where: { workspaceId: auth.workspaceId, contactId: body.sourceContactId } }),
        prisma.intakeFormResponse.count({ where: { workspaceId: auth.workspaceId, contactId: body.targetContactId } }),
        prisma.clientWalletAccount.findUnique({
          where: { workspaceId_contactId: { workspaceId: auth.workspaceId, contactId: body.sourceContactId } },
        }),
        prisma.clientWalletAccount.findUnique({
          where: { workspaceId_contactId: { workspaceId: auth.workspaceId, contactId: body.targetContactId } },
        }),
      ]);
      return NextResponse.json({
        data: {
          ...preview,
          forms: { source: srcForms, target: tgtForms },
          walletCents: { source: srcWallet?.balanceCents || 0, target: tgtWallet?.balanceCents || 0 },
        },
      });
    }

    const result = await mergeContacts(
      auth.workspaceId,
      body.sourceContactId,
      body.targetContactId,
      body.chosenValues || {},
      auth.session.userId,
    );

    const data = await buildClientDetail(auth.workspaceId, result.targetContactId);
    return NextResponse.json({ data, merged: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
