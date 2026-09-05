import { NextResponse } from "next/server";
import { getPublicRecapShareMeta, RecapShareAccessError } from "@/lib/meeting-assistant/share";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const data = await getPublicRecapShareMeta(token);
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof RecapShareAccessError) {
      const status =
        err.code === "not_found" ? 404 : err.code === "expired" || err.code === "revoked" ? 410 : 403;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json({ error: "Unable to load recap" }, { status: 500 });
  }
}
