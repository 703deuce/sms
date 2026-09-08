import { loadSchedulerTheme, saveSchedulerTheme, directLinksForWorkspace } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";
import { getPrisma } from "@/lib/db";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const [theme, workspace] = await Promise.all([
      loadSchedulerTheme(workspaceId),
      getPrisma().workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } }),
    ]);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const links = workspace?.slug
      ? directLinksForWorkspace(baseUrl, workspace.slug)
      : {};
    return { theme, links };
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    saveSchedulerTheme(workspaceId, body.theme || body),
  );
}
