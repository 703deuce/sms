"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  OfferingCoverPlaceholder,
  type OfferingCoverCategory,
} from "./offering-cover-placeholder";

type Props = {
  href?: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  category: OfferingCoverCategory;
  className?: string;
};

/** 48px catalog thumbnail + vertically centered name stack. */
export function OfferingCatalogProductCell({
  href,
  name,
  description,
  imageUrl,
  category,
  className,
}: Props) {
  const thumb = (
    <div
      className="relative size-12 shrink-0 overflow-hidden rounded-lg border bg-muted/30"
      aria-hidden={!imageUrl}
    >
      {imageUrl?.trim() ? (
        <Image src={imageUrl} alt="" fill className="object-cover" sizes="52px" unoptimized />
      ) : (
        <OfferingCoverPlaceholder category={category} variant="thumb" className="h-full w-full" />
      )}
    </div>
  );

  const text = (
    <div className="flex min-w-0 flex-col justify-center gap-1">
      <span className="block truncate text-sm font-semibold leading-5 text-foreground">{name}</span>
      {description?.trim() ? (
        <span className="block truncate text-xs leading-4 text-muted-foreground">{description}</span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "group flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          className,
        )}
      >
        {thumb}
        <span className="min-w-0 [&_span:first-child]:group-hover:underline">{text}</span>
      </Link>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {thumb}
      {text}
    </div>
  );
}
