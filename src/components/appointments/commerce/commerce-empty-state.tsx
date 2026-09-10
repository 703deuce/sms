"use client";

import { Button } from "@/components/ui/button";

export function CommerceEmptyState({
  title,
  description,
  example,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  example?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {example ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Example: <span className="font-medium text-foreground">{example}</span>
        </p>
      ) : null}
      <Button type="button" className="mt-4" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
