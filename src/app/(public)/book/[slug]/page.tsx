import { PublicBookingClient } from "@/components/appointments/public-booking-client";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; singleUse?: string; theme?: string }>;
};

export default async function PublicBookPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  return (
    <PublicBookingClient
      slug={slug}
      preselectTypeId={query.type}
      singleUseToken={query.singleUse}
      theme={query.theme as "light" | "dark" | "auto" | undefined}
    />
  );
}
