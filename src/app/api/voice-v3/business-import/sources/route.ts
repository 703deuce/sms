import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  upsertBusinessKnowledgeSource,
} from "@/lib/voice-v3/business-import/service";
import type { GoogleMapsSearchResult } from "@/lib/scrapingdog/client";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const voiceAgentId = url.searchParams.get("voiceAgentId");
    if (!voiceAgentId) {
      return NextResponse.json({ error: "voiceAgentId is required" }, { status: 400 });
    }
    const prisma = getPrisma();
    const row = await prisma.voiceV3BusinessKnowledgeSource.findFirst({
      where: { workspaceId: auth.workspaceId, voiceAgentId },
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      voiceAgentId?: string;
      websiteUrl?: string | null;
      googleSelection?: GoogleMapsSearchResult | null;
    };
    if (!body.voiceAgentId) {
      return NextResponse.json({ error: "voiceAgentId is required" }, { status: 400 });
    }
    const row = await upsertBusinessKnowledgeSource(auth.workspaceId, body.voiceAgentId, {
      websiteRootUrl: body.websiteUrl,
      googleSelection: body.googleSelection,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 500);
  }
}
