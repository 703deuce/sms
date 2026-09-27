"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { PremiumCheckoutState } from "@/components/numbers/premium-number-checkout";
import { Panel, TextLink } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";

export function PremiumSuccessOpus({
  state,
  onClose,
}: {
  state: PremiumCheckoutState;
  onClose: () => void;
}) {
  const headline = state.vanityDisplay ?? state.displayNumber ?? state.phoneNumber;

  return (
    <Panel title="Number purchased" bodyClassName="text-center">
      <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
      <p className="mt-3 font-mono text-lg font-semibold">{headline}</p>
      {state.vanityDisplay ? <p className="text-sm text-muted-foreground">{state.displayNumber}</p> : null}
      <p className="mt-4 text-sm text-muted-foreground">Your number is ready to assign in Numbers and MCTB setup.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button type="button" asChild>
          <Link href="/voice/numbers">View numbers</Link>
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
      </div>
      <p className="mt-4">
        <TextLink href="/mctb/setup/phone">Configure MCTB sender</TextLink>
      </p>
    </Panel>
  );
}
