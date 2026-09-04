import { AppointmentWorkflowEditor } from "@/components/appointments/workflows-client";
import { getAppointmentWorkflow } from "@/lib/appointment-workflows/service";
import { requireSession } from "@/lib/api-auth";
import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export default async function EditAppointmentWorkflowPage({ params }: Params) {
  const auth = await requireSession();
  if ("error" in auth) redirect("/login");
  const { id } = await params;
  const workflow = await getAppointmentWorkflow(auth.workspaceId, id);
  if (!workflow) redirect("/appointments/workflows");
  return <AppointmentWorkflowEditor mode="edit" initial={workflow} />;
}
