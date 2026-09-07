import { PublicEmbedBookingConnected } from "@/features/appointments/kimi/public/public-embed-booking-connected";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; theme?: string; embed?: string; singleUse?: string }>;
};

export default async function EmbedBookPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  return (
    <PublicEmbedBookingConnected
      slug={slug}
      preselectTypeId={query.type}
      singleUseToken={query.singleUse}
      theme={query.theme as "light" | "dark" | "auto" | undefined}
    />
  );
}
