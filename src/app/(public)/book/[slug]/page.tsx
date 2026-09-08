import type { Metadata } from "next";
import { PublicBookingConnected } from "@/features/appointments/kimi/public/public-booking-connected";
import { resolveWorkspaceBySlug, loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { loadSchedulerTheme } from "@/lib/appointments/service-booking/scheduler-theme";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    type?: string;
    singleUse?: string;
    theme?: string;
    category?: string;
    staff?: string;
    location?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const workspace = await resolveWorkspaceBySlug(slug);
  if (!workspace) return { title: "Booking" };

  const theme = await loadSchedulerTheme(workspace.id);
  const config = await loadAppointmentPlatformConfig(workspace.id);
  const name = config.businessDisplayName || workspace.displayName || workspace.name;

  return {
    title: `Book with ${name}`,
    description: `Schedule an appointment with ${name}.`,
    manifest: "/booking.webmanifest",
    ...(theme.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function PublicBookPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  return (
    <PublicBookingConnected
      slug={slug}
      preselectTypeId={query.type}
      singleUseToken={query.singleUse}
      theme={query.theme as "light" | "dark" | "auto" | undefined}
      initialCategorySlug={query.category}
      initialStaffId={query.staff}
      initialLocationId={query.location}
    />
  );
}
