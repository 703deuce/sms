import { redirect } from "next/navigation";

export default async function RealtorMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const { channel } = await searchParams;
  if (channel === "email") redirect("/send?channel=email");
  redirect("/send");
}
