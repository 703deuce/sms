import type { Metadata } from "next";
import { PublicWorkshopsEnrollmentClient } from "@/components/appointments/public-workshops-enrollment-client";
import { resolveWorkspaceBySlug, loadAppointmentPlatformConfig } from "@/lib/appointments/settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const workspace = await resolveWorkspaceBySlug(slug);
  if (!workspace) return { title: "Workshops" };
  const config = await loadAppointmentPlatformConfig(workspace.id);
  const name = config.businessDisplayName || workspace.displayName || workspace.name;
  return { title: `Workshops — ${name}` };
}

export default async function PublicWorkshopsPage({ params }: Props) {
  const { slug } = await params;
  const workspace = await resolveWorkspaceBySlug(slug);
  if (!workspace) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold">Workshops</h1>
        <p className="mt-2 text-sm text-muted-foreground">Booking page not found.</p>
      </main>
    );
  }
  const config = await loadAppointmentPlatformConfig(workspace.id);
  const businessName = config.businessDisplayName || workspace.displayName || workspace.name;

  return <PublicWorkshopsEnrollmentClient slug={slug} businessName={businessName} />;
}
