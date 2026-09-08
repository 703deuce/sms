import type { Metadata } from "next";
import { PublicClassesEnrollmentClient } from "@/components/appointments/public-classes-enrollment-client";
import { resolveWorkspaceBySlug, loadAppointmentPlatformConfig } from "@/lib/appointments/settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const workspace = await resolveWorkspaceBySlug(slug);
  if (!workspace) return { title: "Classes" };
  const config = await loadAppointmentPlatformConfig(workspace.id);
  const name = config.businessDisplayName || workspace.displayName || workspace.name;
  return { title: `Classes — ${name}` };
}

export default async function PublicClassesPage({ params }: Props) {
  const { slug } = await params;
  const workspace = await resolveWorkspaceBySlug(slug);
  if (!workspace) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold">Classes</h1>
        <p className="mt-2 text-sm text-muted-foreground">Booking page not found.</p>
      </main>
    );
  }
  const config = await loadAppointmentPlatformConfig(workspace.id);
  const businessName = config.businessDisplayName || workspace.displayName || workspace.name;

  return <PublicClassesEnrollmentClient slug={slug} businessName={businessName} />;
}
