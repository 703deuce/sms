import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadUnifiedTemplates,
  type UnifiedTemplateProduct,
} from "@/lib/templates/unified-templates";

const PRODUCTS = new Set<UnifiedTemplateProduct | "all">([
  "all",
  "campaigns",
  "reviews",
  "appointment_reminders",
  "mctb",
]);

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const product = (url.searchParams.get("product") || "all") as UnifiedTemplateProduct | "all";
    if (!PRODUCTS.has(product)) {
      return NextResponse.json({ error: "invalid product" }, { status: 400 });
    }
    const data = await loadUnifiedTemplates(auth.workspaceId, product);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
