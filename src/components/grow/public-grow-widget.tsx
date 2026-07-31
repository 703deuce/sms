"use client";

import { PublicOptInForm } from "@/components/forms/public-opt-in-form";
import { useEffect, useState } from "react";

type WidgetData = {
  name: string;
  widgetType: string;
  config: Record<string, unknown>;
  linkedFormId?: string | null;
};

export function PublicGrowWidget({ slug }: { slug: string }) {
  const [widget, setWidget] = useState<WidgetData | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (widget.widgetType === "floating") {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          type="button"
          className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg"
        >
          {title}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-4">
          <PublicOptInForm variant="embed" />
        </div>
      </div>
    </div>
  );
}
