import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  disconnectWorkspaceCalendarConnection,
  listConnectionProviderCalendars,
  patchWorkspaceCalendarConnection,
} from "@/lib/calendar/connection-settings";
import { getWorkspaceCalendarConnection } from "@/lib/calendar/connections";
import { enqueueCalendarConnectionSync } from "@/lib/calendar/import-sync";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const row = await getWorkspaceCalendarConnection(auth.workspaceId, id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      writeCalendarId?: string;
      blockingCalendarIds?: string[];
      importCalendarIds?: string[];
      syncEnabled?: boolean;
      timezone?: string;
      importRules?: {
        requireExternalAttendees?: boolean;
        requireAttendeeEmail?: boolean;
        titleIncludePatterns?: string[];
        titleExcludePatterns?: string[];
        skipAllDay?: boolean;
      };
      reminderDefaults?: {
        smsEnabled?: boolean;
        emailEnabled?: boolean;
        voiceEnabled?: boolean;
        replyDestinationPhone?: string;
        replyDestinationEmail?: string;
        attachIcs?: boolean;
      };
    };
    const row = await patchWorkspaceCalendarConnection(auth.workspaceId, id, body);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const ok = await disconnectWorkspaceCalendarConnection(auth.workspaceId, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
