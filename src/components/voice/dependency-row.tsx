import Link from "next/link";

export function DependencyRow({
  title,
  detail,
  href,
  linkLabel,
}: {
  title: string;
  detail: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 max-w-xl">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      <Link href={href} className="shrink-0 text-sm font-medium text-primary hover:underline">
        {linkLabel} →
      </Link>
    </div>
  );
}
