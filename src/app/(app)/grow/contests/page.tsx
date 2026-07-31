"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import Link from "next/link";
import { growTabs } from "@/lib/grow-tabs";

export default function GrowContestsPage() {
  return (
    <div>
      <PageHeader
        title="Contests & text-to-win"
        description="Run voting, sweepstakes, and text-to-win campaigns from keywords and automations."
      />
      <Tabs items={growTabs} />
      <Card className="space-y-3 p-6 text-sm">
        <p>
          Contests are built from keywords, automations, and surveys — not a separate product suite.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <Link href="/grow/keywords" className="text-primary hover:underline">Keywords</Link>
            — entrants text a keyword to join.
          </li>
          <li>
            <Link href="/automations/templates" className="text-primary hover:underline">Automation templates</Link>
            — use contest and voting flows.
          </li>
          <li>
            <Link href="/surveys" className="text-primary hover:underline">Surveys & polls</Link>
            — collect votes and tally responses.
          </li>
        </ul>
      </Card>
    </div>
  );
}
