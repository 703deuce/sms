"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { useState } from "react";

export default function VoiceSettingsPage() {
  const [emergencyStop, setEmergencyStop] = useState(false);

  return (
    <div>
      <PageHeader title="Voice settings" description="Defaults, compliance, retention, and emergency controls." />
      <VoiceSubNav />
      <Card className="max-w-lg space-y-4 p-5">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={emergencyStop} onChange={(e) => setEmergencyStop(e.target.checked)} />
          Emergency stop (blocks new outbound campaigns and calls)
        </label>
        <Button variant="outline" disabled>Save workspace voice settings (API pending)</Button>
      </Card>
    </div>
  );
}
