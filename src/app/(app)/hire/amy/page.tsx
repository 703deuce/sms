import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/** Amy hire entry — Company Brain first, then locked appointment booking wizard. */
export default async function HireAmyPage({
  searchParams,
}: {
  searchParams?: Promise<{ skipBrain?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/hire/amy");
  const sp = (await searchParams) || {};
  if (sp.skipBrain === "1") {
    redirect(
      "/solutions/ai-call-handling/appointment-assistant/setup?hire=amy",
    );
  }
  redirect("/hire/brain?next=amy");
}
