import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { listAppointmentTypes, loadAppointmentPlatformConfig, resolveWorkspaceBySlug } from "@/lib/appointments";
import { resolveTeamPageBySlug } from "@/lib/appointments/team-scheduling";

type Params = { params: Promise<{ slug: string }> };

/** @deprecated Use /api/public/team-book/[workspaceSlug]/[pageSlug] */
export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const url = new URL(request.url);
    const workspaceSlug = url.searchParams.get("workspace") || slug;
    const pageSlug = url.searchParams.get("page") || slug;
    const workspace = await resolveWorkspaceBySlug(workspaceSlug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const teamPage = await resolveTeamPageBySlug(workspace.id, pageSlug);
    if (!teamPage) {
      return NextResponse.json({ error: "Team page not found" }, { status: 404 });
    }

    const config = await loadAppointmentPlatformConfig(workspace.id);
    const allTypes = await listAppointmentTypes(workspace.id);
    const types = allTypes.filter(
      (t) => t.active && teamPage.appointmentTypeIds.includes(t.id),
    );

    return NextResponse.json({
      data: {
        teamPage,
        workspace: {
          slug: workspace.slug,
          name: workspace.displayName || workspace.name,
        },
        timezone: config.timezone,
        types,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
