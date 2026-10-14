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
  /** Live preview column — cap decorative height per wireframe. */
  preview?: boolean;
};

export function OfferingCoverImage({ imageUrl, category, alt, className, preview }: Props) {
  const frameClass = cn(
    "relative aspect-[4/3] w-full overflow-hidden rounded-xl border",
    preview && "max-h-[13.125rem]",
    className,
  );
  if (imageUrl?.trim()) {
    return (
      <div className={frameClass}>
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
  return (
    <OfferingCoverPlaceholder
      category={category}
      className={cn(preview && "max-h-[13.125rem]", className)}
    />
  );
}
