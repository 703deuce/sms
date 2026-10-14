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

/** 52px catalog thumbnail + name stack (wireframe package/class rows). */
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
      className="relative size-[3.25rem] shrink-0 overflow-hidden rounded-lg border bg-muted/30"
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
    <div className="min-w-0">
      <span className="block truncate text-sm font-semibold">{name}</span>
      {description?.trim() ? (
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn("flex min-w-0 items-center gap-3 text-primary hover:underline", className)}
      >
        {thumb}
        {text}
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
