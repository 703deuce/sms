import { PublicBookingConnected } from "@/features/appointments/kimi/public/public-booking-connected";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; singleUse?: string; theme?: string }>;
};

export default async function PublicBookPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  return (
    <PublicBookingConnected
      slug={slug}
      preselectTypeId={query.type}
      singleUseToken={query.singleUse}
      theme={query.theme as "light" | "dark" | "auto" | undefined}
    />
  );
}
