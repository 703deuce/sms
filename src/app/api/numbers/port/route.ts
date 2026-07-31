import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      phone?: string;
      currentCarrier?: string;
      accountNumber?: string;
      accountPin?: string;
      billingPhone?: string;
      businessName?: string;
      address?: string;
    };

    const phone = body.phone?.trim();
    if (!phone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }

    const portRequest = await getPrisma().portRequest.create({
      data: {
        workspaceId: auth.workspaceId,
        phone,
        currentCarrier: body.currentCarrier?.trim() || null,
        accountNumber: body.accountNumber?.trim() || null,
        accountPin: body.accountPin?.trim() || null,
        billingPhone: body.billingPhone?.trim() || null,
        businessName: body.businessName?.trim() || null,
        address: body.address?.trim() || null,
        status: "pending",
      },
    });

    await getPrisma().auditLog.create({
      data: {
        workspaceId: auth.workspaceId,
        userId: auth.session.userId,
        event: "number.port_requested",
        detail: phone,
      },
    });

    return NextResponse.json({ data: portRequest }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
