"use client";

import { AppointmentReceptionistWizard } from "@/components/solutions/appointment-receptionist/wizard";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
import { Page, PageHeader } from "@/newui-transplant/components/app/kit";

/** Full 8-step appointment receptionist wizard with Opus presentation (edit agent). */
export function AppointmentReceptionistWizardOpusPage() {
  return (
    <Page className="pb-28">
      <PageHeader
        title="AI receptionist setup"
        description="Configure your receptionist in eight steps — phone, knowledge, booking, call handling, voice, test, and go live."
        actions={
          <ButtonLink href="/voice/receptionist" variant="ghost">
            Back to summary
          </ButtonLink>
        }
      />
      <AppointmentReceptionistWizard presentation="opus" />
    </Page>
  );
}
