import { redirect } from "next/navigation";

/** Legacy inbox URL — unified under Conversations. */
export default async function InboxRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
  }
  const suffix = qs.toString();
  redirect(suffix ? `/conversations?${suffix}` : "/conversations");
}
