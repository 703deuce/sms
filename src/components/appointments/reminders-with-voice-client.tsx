"use client";

import { AppointmentRemindersClient } from "@/components/appointments/reminders-client";
import { VoiceRemindersClient } from "@/components/appointments/voice-reminders-client";

export function RemindersWithVoiceClient() {
  return (
    <div className="space-y-10">
      <AppointmentRemindersClient />
      <section className="border-t pt-8" aria-labelledby="voice-reminders-heading">
        <div className="mx-auto max-w-[1100px] px-8">
          <h2 id="voice-reminders-heading" className="text-[18px] font-semibold text-foreground">
            Voice channel
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Appointment voice reminders use your verified caller ID. This is not a standalone phone product.
          </p>
        </div>
        <VoiceRemindersClient />
      </section>
    </div>
  );
}
