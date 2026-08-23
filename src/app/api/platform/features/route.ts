import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  getWorkspaceProductFeatures,
  type WorkspaceFeatureSnapshot,
} from "@/lib/products/feature-entitlements";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const features = await getWorkspaceProductFeatures(auth.workspaceId);
    return NextResponse.json({ data: features });
  } catch (err) {
    return jsonError(err);
  }
}

export type { WorkspaceFeatureSnapshot };
