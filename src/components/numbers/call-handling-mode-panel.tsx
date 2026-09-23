"use client";

import { Card, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

type Props = {
  numberId: string;
  e164: string;
  settingsJson?: Record<string, unknown> | null;
};

/**
 * Legacy per-number call-handling modes are superseded by PR #483 canonical Call Handling.
 * Customer-facing UI must not offer a second MCTB vs AI switch here.
 */
export function CallHandlingModePanel({ e164 }: Props) {
  return (
    <Card className="mb-6">
      <CardTitle>Call handling</CardTitle>
      <p className="mt-3 text-sm text-muted-foreground">
        Incoming call routing for {e164} is configured from Missed Call Text Back — choose whether
        forwarded calls use Missed Call Text Back or AI Receptionist on your canonical voice ingress.
      </p>
      <p className="mt-2 text-sm">
        <Link href={MCTB_ROUTES.home} className="font-semibold text-primary underline-offset-2 hover:underline">
          Open MCTB Overview
        </Link>
        {" "}
        to manage who handles forwarded calls.
      </p>
    </Card>
  );
}
