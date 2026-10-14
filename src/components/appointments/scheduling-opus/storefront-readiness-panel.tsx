"use client";

import Link from "next/link";
import { Store } from "lucide-react";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/** Content-sized storefront / payments panel — not a full-height callout. */
export function StorefrontReadinessPanel({ className }: Props) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden
        >
          <Store className="size-4" />
        </span>
        <div className="min-w-0 space-y-3">
          <h3 className="text-[0.9375rem] font-semibold leading-5">Storefront &amp; payments</h3>
          <p className="text-[0.8125rem] leading-[1.25rem] text-muted-foreground line-clamp-3">
            Publish packages and connect Stripe before selling online. Customers see products on your
            public booking storefront.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              className="h-9"
              render={<Link href="/appointments/commerce" />}
            >
              Commerce
            </Button>
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              className="h-9"
              render={<Link href="/appointments/pricing-payments" />}
            >
              Payments
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
