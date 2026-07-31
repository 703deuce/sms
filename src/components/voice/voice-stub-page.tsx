import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import Link from "next/link";

export default function VoiceStubPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <VoiceSubNav />
      <p className="text-sm text-muted-foreground">
        Configure this module from the voice APIs and agent builder. See{" "}
        <Link href="/voice/agents" className="text-primary underline">agents</Link> and{" "}
        <Link href="/voice/settings" className="text-primary underline">settings</Link>.
      </p>
    </div>
  );
}
