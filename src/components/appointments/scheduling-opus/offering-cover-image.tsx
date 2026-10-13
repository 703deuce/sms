"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  OfferingCoverPlaceholder,
  type OfferingCoverCategory,
} from "./offering-cover-placeholder";

type Props = {
  imageUrl?: string | null;
  category: OfferingCoverCategory;
  alt: string;
  className?: string;
};

export function OfferingCoverImage({ imageUrl, category, alt, className }: Props) {
  if (imageUrl?.trim()) {
    return (
      <div className={cn("relative aspect-[4/3] w-full overflow-hidden rounded-xl border", className)}>
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 360px"
          unoptimized
        />
      </div>
    );
  }
  return <OfferingCoverPlaceholder category={category} className={className} />;
}
