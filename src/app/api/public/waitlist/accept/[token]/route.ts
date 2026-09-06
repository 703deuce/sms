import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { acceptWaitlistOffer } from "@/lib/appointments/waitlist";

type Params = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const result = await acceptWaitlistOffer(token);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
