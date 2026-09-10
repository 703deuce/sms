import { PublicEventsEnrollmentClient } from "@/components/appointments/public-events-enrollment-client";
import { resolveWorkspaceBySlug } from "@/lib/appointments";

type Props = { params: Promise<{ slug: string }> };

export default async function PublicEventsPage({ params }: Props) {
  const { slug } = await params;
  const workspace = await resolveWorkspaceBySlug(slug);
  const businessName = workspace?.displayName || workspace?.name || slug;
  return <PublicEventsEnrollmentClient slug={slug} businessName={businessName} />;
}
