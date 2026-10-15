"use client";

import Link from "next/link";
import {
  ArOpusPage,
  OpusDataSurface,
} from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { PageHeader, TextLink } from "@/newui-transplant/components/app/kit";
import { NewUiMctbOverviewPage } from "@/newui-transplant/connected/mctb/overview-page";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { cn } from "@/lib/utils";

export type UnifiedOverviewServices = {
  hasMctb: boolean;
  hasAppointmentReminders: boolean;
  hasMassSms: boolean;
};

export function UnifiedOverviewPage({
  services,
  mctbData,
}: {
  services: UnifiedOverviewServices;
  mctbData: MctbOverviewPayload | null;
}) {
  const anyService = services.hasMctb || services.hasAppointmentReminders || services.hasMassSms;

  if (!anyService) {
    return (
      <ArOpusPage wide className="pb-8">
        <PageHeader title="Overview" description="Transovo Business Messaging" />
        <OpusDataSurface className={cn(OPUS_CARD, "p-6")}>
          <p className="text-sm text-muted-foreground">
            Activate Missed Call Text Back to see activity here, or manage your plan under
            Settings → Billing.
          </p>
          <TextLink href="/settings/billing" className="mt-3 inline-block">
            View plans
          </TextLink>
        </OpusDataSurface>
      </ArOpusPage>
    );
  }

  if (services.hasMctb && mctbData) {
    return (
      <div className="flex flex-col">
        {(services.hasAppointmentReminders || services.hasMassSms) && (
          <div className="border-b bg-muted/20 px-4 py-2 md:px-6">
            <p className="text-xs text-muted-foreground">
              Also active:{" "}
              {services.hasAppointmentReminders ? (
                <Link href={AR_ROUTES.home} className="font-medium text-primary hover:underline">
                  Appointment Reminders
                </Link>
              ) : null}
              {services.hasAppointmentReminders && services.hasMassSms ? " · " : null}
              {services.hasMassSms ? (
                <Link href="/campaigns" className="font-medium text-primary hover:underline">
                  Campaigns
                </Link>
              ) : null}
            </p>
          </div>
        )}
        <NewUiMctbOverviewPage data={mctbData} />
      </div>
    );
  }

  const links = [
    services.hasAppointmentReminders
      ? { label: "Appointment Reminders", href: AR_ROUTES.home, hint: "Calendar & reminders" }
      : null,
    services.hasMassSms
      ? { label: "Campaigns", href: "/campaigns", hint: "Scheduled sends" }
      : null,
    services.hasMctb
      ? { label: "Missed Call Text Back", href: MCTB_ROUTES.home, hint: "Recovery activity" }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string; hint: string }>;

  return (
    <ArOpusPage wide className="pb-8">
      <PageHeader title="Overview" description="Activity across your enabled messaging services." />
      <OpusDataSurface className={cn(OPUS_CARD, "p-6")}>
        <ul className="space-y-3">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 hover:bg-muted/40"
              >
                <span className="font-medium">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
        <TextLink href="/conversations" className="mt-4 inline-block">
          Open inbox
        </TextLink>
      </OpusDataSurface>
    </ArOpusPage>
  );
}
