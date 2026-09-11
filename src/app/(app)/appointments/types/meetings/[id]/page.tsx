import { redirect } from "next/navigation";

export default async function LegacyMeetingEditorRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/appointments/meetings/${id}`);
}
