import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  buildForwardingInstructions,
  CARRIER_FORWARDING_GUIDES,
  markForwardingVerified,
} from "@/lib/smart-routing/forwarding-service";
import type { ForwardingMode } from "@/lib/smart-routing/forwarding-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const carrier = url.searchParams.get("carrier") ?? "Other";
    const mode = (url.searchParams.get("mode") ?? "unconditional") as ForwardingMode;
    const routingNumber = url.searchParams.get("routingNumber") ?? "";
    if (!routingNumber) {
      return NextResponse.json({
        data: { carriers: CARRIER_FORWARDING_GUIDES.map((c) => c.carrier) },
      });
    }
    const instructions = buildForwardingInstructions({
      carrier,
      mode,
      routingNumber,
    });
    return NextResponse.json({ data: instructions });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      carrier?: string;
      forwardingType?: string;
      confirm?: boolean;
    };
    if (!body.confirm) {
      return NextResponse.json({ error: "confirm required" }, { status: 400 });
    }
    const flow = await markForwardingVerified(auth.workspaceId, id, {
      carrier: body.carrier,
      forwardingType: body.forwardingType,
    });
    return NextResponse.json({ data: flow });
  } catch (err) {
    return jsonError(err, 400);
  }
}
