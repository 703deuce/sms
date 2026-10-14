"use client";

import { Layers, ShoppingBag } from "lucide-react";
import type { PackageFormState } from "@/lib/appointments/packages/package-form";
import { formatMoney } from "@/lib/appointments/packages/package-form";
import type { OfferingOption } from "@/features/appointments/kimi/packages/use-package-editor";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";
import { OfferingCoverImage } from "./offering-cover-image";

function templateLabel(form: PackageFormState): string {
  if (form.sellTemplate === "prepaid_sessions") return "Prepaid sessions";
  return "Bundle of services and classes";
}

type Props = {
  form: PackageFormState;
  includedOfferings: OfferingOption[];
  mode?: "draft" | "preview" | "published";
  className?: string;
};

export function PackageLivePreview({ form, includedOfferings, mode = "draft", className }: Props) {
  const totalItems =
    form.packageKind === "pooled"
      ? form.totalCredits
      : includedOfferings.reduce((sum, o) => {
          const key = `${o.kind}:${o.id}`;
          return sum + (form.itemizedQuantities[key] ?? 1);
        }, 0);

  return (
    <section className={cn(OPUS_CARD, "overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.06] p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live preview</p>
        <Pill tone={mode === "published" ? "success" : "neutral"} dot={false}>
          {mode === "published" ? "Published" : mode === "preview" ? "Preview" : "Draft"}
        </Pill>
      </div>
      <OfferingCoverImage
        imageUrl={form.imageUrl}
        category="package"
        alt={form.name || "Package cover"}
        preview
        className="mb-4"
      />
      <h2 className="mt-4 text-lg font-semibold tracking-tight">
        {form.name.trim() || "Untitled package"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{templateLabel(form)}</p>
      {form.description ? (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-4">{form.description}</p>
      ) : null}

      <div className="mt-5 border-t pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Price</p>
        <p className="text-2xl font-semibold tabular-nums">{formatMoney(form.priceCents)}</p>
      </div>

      <div className="mt-4 border-t pt-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Layers className="size-3.5" aria-hidden />
          What&apos;s included
        </p>
        {includedOfferings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add services or classes to see them here.</p>
        ) : (
          <ul className="space-y-2">
            {includedOfferings.map((o) => {
              const qty =
                form.packageKind === "pooled"
                  ? form.totalCredits
                  : form.itemizedQuantities[`${o.kind}:${o.id}`] ?? 1;
              return (
                <li key={o.id} className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{o.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">×{qty}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {totalItems > 0
            ? `${totalItems} total booking${totalItems === 1 ? "" : "s"} in this package`
            : "Set quantities on included items"}
        </p>
      </div>

      <div className="mt-5 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          Validity:{" "}
          {form.expirationMode === "none"
            ? "Does not expire"
            : form.expirationMode === "days"
              ? `${form.expirationDays} days after purchase`
              : form.expirationDate || "Fixed date"}
        </p>
      </div>

      <Button type="button" className="mt-5 w-full" variant="secondary" disabled>
        <ShoppingBag className="mr-2 size-4" aria-hidden />
        Buy package
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">Customer preview — not live checkout</p>
    </section>
  );
}
