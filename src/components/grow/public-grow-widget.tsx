"use client";

import { PublicOptInForm } from "@/components/forms/public-opt-in-form";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

type WidgetData = {
  name: string;
  widgetType: string;
  config: Record<string, unknown>;
  linkedFormId?: string | null;
  linkedFormSlug?: string | null;
};

export function PublicGrowWidget({ slug }: { slug: string }) {
  const [widget, setWidget] = useState<WidgetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [floatingOpen, setFloatingOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/public/widgets/${slug}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) {
          setError(j.error || "Widget not found");
          return;
        }
        setWidget(j.data);
      })
      .catch(() => setError("Failed to load widget"));
  }, [slug]);

  if (error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!widget) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const title = (widget.config.title as string) || widget.name;
  const subtitle = (widget.config.subtitle as string) || "Sign up for SMS updates";
  const formSlug = widget.linkedFormSlug || "";

  if (!formSlug) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-muted-foreground">
        This widget is not linked to an active form.
      </div>
    );
  }

  if (widget.widgetType === "floating") {
    return (
      <>
        <button
          type="button"
          onClick={() => setFloatingOpen(true)}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700"
        >
          {title}
        </button>
        {floatingOpen ? (
          <div className="fixed inset-0 z-[60] flex items-end justify-end bg-black/30 p-4 sm:items-center sm:justify-center">
            <div
              className={cn(
                "relative w-full max-w-md overflow-hidden rounded-[16px] border border-border bg-card shadow-2xl",
                "max-h-[90vh]",
              )}
            >
              <button
                type="button"
                onClick={() => setFloatingOpen(false)}
                className="absolute right-3 top-3 z-10 rounded-md p-1 hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="border-b border-border px-5 pb-3 pt-5">
                <h2 className="text-lg font-bold">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              </div>
              <div className="overflow-y-auto">
                <PublicOptInForm variant="embed" slug={formSlug} />
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-4">
          <PublicOptInForm variant="embed" slug={formSlug} />
        </div>
      </div>
    </div>
  );
}
