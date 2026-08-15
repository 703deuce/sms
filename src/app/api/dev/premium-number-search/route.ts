import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { searchPremiumNumbers } from "@/lib/premium-numbers/premium-number-search";

function devToolAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_VANITY_NUMBER_SEARCH === "1";
}

export async function POST(request: Request) {
  if (!devToolAllowed()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    areaCode?: string;
    industry?: string;
    customKeywords?: string[];
    limit?: number;
  } | null;

  const areaCode = String(body?.areaCode || "").trim();
  if (!areaCode) {
    return NextResponse.json({ error: "areaCode is required" }, { status: 400 });
  }

  const result = await searchPremiumNumbers({
    areaCode,
    industry: body?.industry?.trim() || undefined,
    customKeywords: body?.customKeywords,
    limit: body?.limit,
  });

  return NextResponse.json(result);
}
