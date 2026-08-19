import { NextResponse } from "next/server";
import { suggestIndustryVanityKeywords } from "@/lib/premium-numbers/business-keyword-llm";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { industry?: string } | null;
  const industry = String(body?.industry ?? "").trim();
  if (industry.length < 2) {
    return NextResponse.json({ error: "Enter your industry first" }, { status: 400 });
  }

  try {
    const result = await suggestIndustryVanityKeywords(industry);
    return NextResponse.json({ keywords: result.keywords, source: result.source });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not suggest keywords";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
