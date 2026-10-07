import { ArMeetingsWorkspaceOpus } from '@/newui-transplant/connected/appointment-reminders/ar-meetings-workspace-opus'

export default async function AppointmentRemindersMeetingEditorRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ArMeetingsWorkspaceOpus meetingId={id} />
}
