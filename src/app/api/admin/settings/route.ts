import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/api-auth";
import {
  loadPlatformSettings,
  savePlatformSettings,
  type PlatformSettingsView,
} from "@/lib/platform-settings";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const data = await loadPlatformSettings();
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as PlatformSettingsView;
    const current = await loadPlatformSettings();
    const merged: PlatformSettingsView = {
      plans: Array.isArray(body.plans) ? body.plans : current.plans,
      featureFlags: Array.isArray(body.featureFlags) ? body.featureFlags : current.featureFlags,
      trial: { ...current.trial, ...(body.trial || {}) },
      maintenance: { ...current.maintenance, ...(body.maintenance || {}) },
    };
    const data = await savePlatformSettings(merged);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
