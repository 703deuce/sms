import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { startRecordByPhone } from "@/lib/smart-routing/record-by-phone-service";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { phone?: string; assetName?: string; flowId?: string };
    if (!body.phone?.trim()) {
      return NextResponse.json({ error: "phone required" }, { status: 400 });
    }
    const prisma = getPrisma();
    let fromNumber: string | undefined;
    if (body.flowId) {
      const flow = await prisma.smartRoutingFlow.findFirst({
        where: { id: body.flowId, workspaceId: auth.workspaceId },
      });
      if (flow?.assignedPhoneNumberId) {
        const pn = await prisma.phoneNumber.findFirst({
          where: {
            id: flow.assignedPhoneNumberId,
            workspaceId: auth.workspaceId,
            releasedAt: null,
            status: { not: "Released" },
          },
        });
        fromNumber = pn?.e164;
      }
    }
    if (!fromNumber) {
      const pn = await prisma.phoneNumber.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          releasedAt: null,
          status: { not: "Released" },
        },
        orderBy: { createdAt: "asc" },
      });
      fromNumber = pn?.e164;
    }
    if (!fromNumber) {
      return NextResponse.json({ error: "No outbound number available" }, { status: 400 });
    }
    const result = await startRecordByPhone({
      workspaceId: auth.workspaceId,
      userPhone: body.phone.trim(),
      fromNumber,
      assetName: body.assetName,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
