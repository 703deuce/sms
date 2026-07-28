import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center rounded-xl px-6 py-16 text-center">
      {icon ? <div className="mb-4 text-primary">{icon}</div> : null}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="mt-5">
          <Button>{actionLabel}</Button>
        </Link>
      ) : null}
    </div>
  );
}
