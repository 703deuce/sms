import { getSmsProvider } from "@/lib/sms/provider";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    to?: string;
    from?: string;
    message?: string;
  };

  if (!body.to || !body.from || !body.message) {
    return NextResponse.json({ error: "to, from, and message are required" }, { status: 400 });
  }

  const provider = getSmsProvider();
  const result = await provider.send({
    to: body.to,
    from: body.from,
    body: body.message,
  });

  return NextResponse.json({ data: result });
}
