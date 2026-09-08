import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { signContract } from "@/lib/appointments/service-booking";

type Params = { params: Promise<{ token: string }> };

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
