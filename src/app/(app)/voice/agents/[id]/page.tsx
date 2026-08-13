import { redirect } from "next/navigation";

export default async function VoiceAgentRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/voice/agents/${id}/about`);
}
