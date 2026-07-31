import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const THEMES = new Set(["light", "dark", "auto"]);

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workspace = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
    });
    return NextResponse.json({
      data: {
        name: workspace?.name ?? "",
        displayName: workspace?.displayName ?? "",
        logoUrl: workspace?.logoUrl ?? "",
        primaryColor: workspace?.primaryColor ?? "#0f766e",
        accentColor: workspace?.accentColor ?? "#0ea5e9",
        shortLinkDomain: workspace?.shortLinkDomain ?? "",
        formTheme: workspace?.formTheme ?? "light",
        reviewLinkUrl: workspace?.reviewLinkUrl ?? "",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      displayName?: string;
      logoUrl?: string;
      primaryColor?: string;
      accentColor?: string;
      shortLinkDomain?: string;
      formTheme?: string;
      reviewLinkUrl?: string;
    };

    if (body.primaryColor && !HEX_RE.test(body.primaryColor)) {
      return NextResponse.json({ error: "primaryColor must be a hex color" }, { status: 400 });
    }
    if (body.accentColor && !HEX_RE.test(body.accentColor)) {
      return NextResponse.json({ error: "accentColor must be a hex color" }, { status: 400 });
    }
    if (body.formTheme && !THEMES.has(body.formTheme)) {
      return NextResponse.json({ error: "Invalid form theme" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.displayName !== undefined) data.displayName = body.displayName.trim() || null;
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl.trim() || null;
    if (body.primaryColor !== undefined) data.primaryColor = body.primaryColor;
    if (body.accentColor !== undefined) data.accentColor = body.accentColor;
    if (body.shortLinkDomain !== undefined) data.shortLinkDomain = body.shortLinkDomain.trim() || null;
    if (body.formTheme !== undefined) data.formTheme = body.formTheme;
    if (body.reviewLinkUrl !== undefined) data.reviewLinkUrl = body.reviewLinkUrl.trim() || null;

    const workspace = await getPrisma().workspace.update({
      where: { id: auth.workspaceId },
      data,
    });

    return NextResponse.json({
      data: {
        displayName: workspace.displayName ?? "",
        logoUrl: workspace.logoUrl ?? "",
        primaryColor: workspace.primaryColor ?? "#0f766e",
        accentColor: workspace.accentColor ?? "#0ea5e9",
        shortLinkDomain: workspace.shortLinkDomain ?? "",
        formTheme: workspace.formTheme ?? "light",
        reviewLinkUrl: workspace.reviewLinkUrl ?? "",
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
