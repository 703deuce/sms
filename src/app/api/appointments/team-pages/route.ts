import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  listSchedulingGroups,
  listTeamBookingPages,
  saveSchedulingGroup,
  saveTeamBookingPage,
} from "@/lib/appointments/team-scheduling";
import type { SchedulingGroup, TeamBookingPage } from "@/lib/appointments/scheduling-capabilities";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind") || "pages";
    if (kind === "groups") {
      return NextResponse.json({ data: await listSchedulingGroups(auth.workspaceId) });
    }
    return NextResponse.json({ data: await listTeamBookingPages(auth.workspaceId) });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { kind?: string; data?: SchedulingGroup | TeamBookingPage };
    if (body.kind === "group") {
      const saved = await saveSchedulingGroup(auth.workspaceId, body.data as SchedulingGroup);
      return NextResponse.json({ data: saved });
    }
    const saved = await saveTeamBookingPage(auth.workspaceId, body.data as TeamBookingPage);
    return NextResponse.json({ data: saved });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind") || "pages";
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { deleteSchedulingGroup, deleteTeamBookingPage } = await import(
      "@/lib/appointments/team-scheduling"
    );
    if (kind === "groups") {
      await deleteSchedulingGroup(auth.workspaceId, id);
    } else {
      await deleteTeamBookingPage(auth.workspaceId, id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
