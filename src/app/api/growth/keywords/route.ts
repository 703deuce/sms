import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await getPrisma().keyword.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { keyword: "asc" },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      keyword?: string;
      phoneNumber?: string;
      listName?: string;
      confirmation?: string;
      autoReply?: string;
      tags?: string[];
      startCampaignId?: string;
      status?: string;
    };
    const keyword = (body.keyword || "").trim().toUpperCase();
    if (!keyword) {
      return NextResponse.json({ error: "keyword is required" }, { status: 400 });
    }
    const created = await getPrisma().keyword.create({
      data: {
        workspaceId: auth.workspaceId,
        keyword,
        phoneNumber: body.phoneNumber?.trim() || "*",
        listName:
          body.listName === undefined
            ? "Keyword subscribers"
            : body.listName?.trim() || null,
        confirmation:
          body.confirmation?.trim() ||
          `You're subscribed to ${keyword}. Reply STOP to opt out. Msg&data rates may apply.`,
        autoReply: body.autoReply?.trim() || null,
        tagsJson: body.tags || [],
        startCampaignId: body.startCampaignId || null,
        status: body.status === "Inactive" ? "Inactive" : "Active",
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
