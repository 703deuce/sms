import { redirect } from "next/navigation";

/** Blocking is managed per-number and from Call Activity — no standalone nav page. */
export default async function PersonalBlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  const { numberId } = await searchParams;
  if (numberId) {
    redirect(`/personal/activity?numberId=${encodeURIComponent(numberId)}`);
  }
  redirect("/personal/activity");
}
