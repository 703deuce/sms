import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { TransovoProductFeature } from "@/lib/products/feature-entitlements";

const FEATURE_COPY: Record<
  TransovoProductFeature,
  { title: string; description: string; upgradeParam: string }
> = {
  mctb: {
    title: "Missed Call Text Back",
    description: "Recover missed calls with automated text-back.",
    upgradeParam: "mctb",
  },
  mass_texting: {
    title: "Mass Texting",
    description: "Upload contacts, send campaigns, and manage replies in one inbox.",
    upgradeParam: "mass_texting",
  },
  smart_routing: {
    title: "Smart Routing",
    description: "Route inbound calls to your team with menus and schedules.",
    upgradeParam: "smart_routing",
  },
  call_forwarding: {
    title: "Call Forwarding",
    description:
      "One business number that rings your existing phone — voicemail, business hours, and SMS callbacks.",
    upgradeParam: "call_forwarding",
  },
  visual_voicemail: {
    title: "Visual Voicemail",
    description: "Transcribed voicemail inbox with assignment and callbacks.",
    upgradeParam: "visual_voicemail",
  },
  callback_requests: {
    title: "Callback Requests",
    description:
      "Queue callers who asked to be contacted later from your menu or overflow routes.",
    upgradeParam: "callback_requests",
  },
  ai_transcription: {
    title: "Transcription",
    description:
      "Turn voicemails into readable text and get a quick AI summary of what the caller needs.",
    upgradeParam: "ai_transcription",
  },
};

export function AddOnUpgradeCard({
  feature,
  title,
  description,
}: {
  feature: TransovoProductFeature;
  title?: string;
  description?: string;
}) {
  const copy = FEATURE_COPY[feature];
  const heading = title ?? copy.title;
  const body = description ?? copy.description;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Add-on not active</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upgrade your workspace to unlock this feature. Your existing routes and data stay in
              place once enabled.
            </p>
          </div>
          <Link
            href={`/settings/billing?upgrade=${copy.upgradeParam}`}
            className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-white hover:bg-primary-hover"
          >
            View upgrade options
          </Link>
        </div>
      </Card>
    </div>
  );
}
