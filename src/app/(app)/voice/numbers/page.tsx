import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import Link from "next/link";

export default function VoiceNumbersPage() {
  return (
    <div>
      <PageHeader
        title="Voice phone numbers"
        description="Assign voice-capable numbers to agents. Purchase and manage numbers in Phone Numbers."
        actions={
          <Link href="/numbers" className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
            Open Phone Numbers
          </Link>
        }
      />
      <VoiceSubNav />
      <p className="text-sm text-muted-foreground">
        Voice uses your workspace Telnyx numbers. Assign numbers per agent in the agent builder Identity section.
      </p>
    </div>
  );
}
