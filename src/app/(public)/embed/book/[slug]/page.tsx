import { PublicBookingClient } from "@/components/appointments/public-booking-client";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; theme?: string; embed?: string; singleUse?: string }>;
};

export default async function EmbedBookPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  return (
    <div className="min-h-screen bg-background">
      <PublicBookingClient
        slug={slug}
        embed
        preselectTypeId={query.type}
        singleUseToken={query.singleUse}
        theme={query.theme as "light" | "dark" | "auto" | undefined}
      />
    </div>
  );
}
