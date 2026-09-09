import { MembershipEditorConnected } from "@/components/appointments/memberships/membership-editor-connected";

type Props = { params: Promise<{ id: string }> };

export default async function EditMembershipPage({ params }: Props) {
  const { id } = await params;
  return <MembershipEditorConnected membershipId={id} />;
}
