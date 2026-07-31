import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  getNotificationPrefs,
  upsertNotificationPrefs,
  type NotificationPrefsJson,
} from "@/lib/settings/notification-prefs";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const row = await getNotificationPrefs(auth.workspaceId, auth.session.userId);
    return NextResponse.json({
      data: {
        notifyEmail: row?.notifyEmail ?? auth.session.email,
        digestFrequency: row?.digestFrequency ?? "daily",
        pushEnabled: row?.pushEnabled ?? false,
        prefs: (row?.prefs as NotificationPrefsJson) ?? {},
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      notifyEmail?: string | null;
      digestFrequency?: string;
      pushEnabled?: boolean;
      prefs?: NotificationPrefsJson;
    };

    const row = await upsertNotificationPrefs(auth.workspaceId, auth.session.userId, body);
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
