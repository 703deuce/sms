import { contacts } from "@/lib/mock/data";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const data = status
    ? contacts.filter((c) => c.status.toLowerCase() === status.toLowerCase())
    : contacts;
  return NextResponse.json({ data });
}
