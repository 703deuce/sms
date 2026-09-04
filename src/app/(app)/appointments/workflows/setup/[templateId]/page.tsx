import { AppointmentWorkflowEditor } from "@/components/appointments/workflows-client";
import { getPrebuiltTemplate } from "@/lib/appointment-workflows/templates";
import { redirect } from "next/navigation";

type Params = { params: Promise<{ templateId: string }> };

export default async function SetupPrebuiltWorkflowPage({ params }: Params) {
  const { templateId } = await params;
  const template = getPrebuiltTemplate(templateId);
  if (!template) redirect("/appointments/workflows");
  return <AppointmentWorkflowEditor mode="create" templateId={templateId} />;
}
