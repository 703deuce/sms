import { campaigns } from "@/lib/mock/data";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ data: campaigns });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    type?: string;
    audience?: string;
    message?: string;
  };

  if (!body.name || !body.message) {
    return NextResponse.json({ error: "name and message are required" }, { status: 400 });
  }

  return NextResponse.json({
    data: {
      id: `camp_${Date.now()}`,
      name: body.name,
      type: body.type ?? "SMS",
      audience: body.audience ?? "All subscribed",
      status: "Draft",
      body: body.message,
    },
  });
}
