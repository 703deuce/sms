import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { suggestBusinessVanityKeywords } from "@/lib/premium-numbers/business-keyword-llm";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    businessDescription?: string;
  } | null;

  const businessDescription = String(body?.businessDescription ?? "").trim();
  if (businessDescription.length < 2) {
    return NextResponse.json(
      { error: "Describe your business in a few words first" },
      { status: 400 },
    );
  }

  try {
    const result = await suggestBusinessVanityKeywords(businessDescription);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, 500);
  }
}
