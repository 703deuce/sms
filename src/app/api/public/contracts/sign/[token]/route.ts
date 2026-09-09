import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { getContractBySignToken, signContract } from "@/lib/appointments/service-booking/booking-contracts";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const row = await getContractBySignToken(token);
    if (!row) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const { contract, workspace, templateName } = row;
    return NextResponse.json({
      data: {
        templateName,
        businessName: workspace?.name || "Your business",
        bodyHtml: contract.bodySnapshot,
        status: contract.status,
        signedAt: contract.signedAt?.toISOString() ?? null,
        signerName: contract.signerName,
        templateVersion: contract.templateVersion,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const body = await request.json();
    const contract = await signContract(token, {
      signerName: body.signerName,
      signatureDataUrl: body.signatureDataUrl,
    });
    return NextResponse.json({ data: contract });
  } catch (err) {
    return jsonError(err, 400);
  }
}
