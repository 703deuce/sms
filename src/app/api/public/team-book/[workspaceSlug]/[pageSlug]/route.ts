import { NextResponse } from "next/server";
import type { DbRow } from "@/lib/db";
import { jsonError } from "@/lib/api-auth";
import { listAppointmentTypes, loadAppointmentPlatformConfig, resolveWorkspaceBySlug } from "@/lib/appointments";
import { resolveTeamPageBySlug, listSchedulingGroups } from "@/lib/appointments/team-scheduling";
import { filterTypesForTeamPage } from "@/lib/appointments/org-permissions";

type Params = { params: Promise<{ workspaceSlug: string; pageSlug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { workspaceSlug, pageSlug } = await params;
    const workspace = await resolveWorkspaceBySlug(workspaceSlug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const teamPage = await resolveTeamPageBySlug(workspace.id, pageSlug);
    if (!teamPage) {
      return NextResponse.json({ error: "Team page not found" }, { status: 404 });
    }

    const config = await loadAppointmentPlatformConfig(workspace.id);
    const allTypes = await listAppointmentTypes(workspace.id);
    const groups = await listSchedulingGroups(workspace.id);
    const types = filterTypesForTeamPage(
      allTypes.filter((t: DbRow) => t.active),
      teamPage,
      groups,
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
