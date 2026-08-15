import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { suggestIndustryVanityKeywords } from "@/lib/premium-numbers/business-keyword-llm";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    industry?: string;
  } | null;

  const industry = String(body?.industry ?? "").trim();
  if (industry.length < 2) {
    return NextResponse.json(
      { error: "Enter your industry or type of business" },
      { status: 400 },
    );
  }

  try {
    const result = await suggestIndustryVanityKeywords(industry);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, 500);
  }
}
