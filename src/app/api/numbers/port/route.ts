import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createPortRequest,
  listPortRequests,
  updatePortDocuments,
  updatePortStatus,
} from "@/lib/numbers/port-service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await listPortRequests(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

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
      authorizedName?: string;
      numberType?: string;
      notes?: string;
      temporaryForwardNumber?: string;
    };

    const phone = body.phone?.trim();
    if (!phone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }

    const portRequest = await createPortRequest({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      phone,
      currentCarrier: body.currentCarrier,
      accountNumber: body.accountNumber,
      accountPin: body.accountPin,
      billingPhone: body.billingPhone,
      businessName: body.businessName,
      address: body.address,
      authorizedName: body.authorizedName,
      numberType: body.numberType,
      notes: body.notes,
      temporaryForwardNumber: body.temporaryForwardNumber,
    });

    return NextResponse.json({ data: portRequest }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      id?: string;
      action?: string;
      status?: string;
      note?: string;
      rejectionReason?: string;
      focDate?: string | null;
      temporaryForwardNumber?: string | null;
      providerPortId?: string | null;
      documents?: Array<{
        id: string;
        label: string;
        required: boolean;
        status: "missing" | "uploaded" | "waived";
        uploadedAt?: string | null;
        note?: string | null;
      }>;
    };

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (body.action === "update_documents" && body.documents) {
      const data = await updatePortDocuments({
        workspaceId: auth.workspaceId,
        id: body.id,
        byUserId: auth.session.userId,
        documents: body.documents,
      });
      return NextResponse.json({ data });
    }

    if (!body.status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const data = await updatePortStatus({
      workspaceId: auth.workspaceId,
      id: body.id,
      status: body.status,
      byUserId: auth.session.userId,
      note: body.note,
      rejectionReason: body.rejectionReason,
      focDate: body.focDate,
      temporaryForwardNumber: body.temporaryForwardNumber,
      providerPortId: body.providerPortId,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
