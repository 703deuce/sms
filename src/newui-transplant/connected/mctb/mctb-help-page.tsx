"use client";

import Link from "next/link";
import { Page, PageHeader, TextLink } from "@/newui-transplant/components/app/kit";
import { OPUS_INSET_LIST } from "@/newui-transplant/components/app/opus-surfaces";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export function MctbHelpPage() {
  return (
    <Page className="max-w-3xl">
      <PageHeader
        title="Help"
        description="Setup guides, troubleshooting, and support for Missed Call Text Back."
        actions={<TextLink href="/getting-started">Getting started checklist →</TextLink>}
      />
      <ul className={`${OPUS_INSET_LIST} text-sm`}>
        <li className="px-4 py-3">
          <Link href={MCTB_ROUTES.phone} className="font-medium hover:underline">Phone &amp; forwarding</Link>
          <p className="mt-0.5 text-xs text-muted-foreground">Business line, Transovo ingress, and verification.</p>
        </li>
        <li className="px-4 py-3">
          <Link href={MCTB_ROUTES.setupTest} className="font-medium hover:underline">Setup test &amp; troubleshooting</Link>
          <p className="mt-0.5 text-xs text-muted-foreground">Live missed-call test and common fixes.</p>
        </li>
        <li className="px-4 py-3">
          <Link href={`${MCTB_ROUTES.missedCallRecovery}?tab=consent`} className="font-medium hover:underline">
            Consent &amp; compliance
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">Press-1 and permission modes.</p>
        </li>
        <li className="px-4 py-3">
          <Link href="/settings" className="font-medium hover:underline">Account &amp; support</Link>
          <p className="mt-0.5 text-xs text-muted-foreground">Team, billing, and business settings.</p>
        </li>
      </ul>
    </Page>
  );
}
