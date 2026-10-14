"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/newui-transplant/components/ui/button";
import { Label } from "@/newui-transplant/components/ui/label";
import { cn } from "@/lib/utils";
import {
  OfferingCoverPlaceholder,
  type OfferingCoverCategory,
} from "./offering-cover-placeholder";

type Props = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  category: OfferingCoverCategory;
  disabled?: boolean;
  className?: string;
};

export function OpusCoverImageUploader({
  label = "Cover image",
  value,
  onChange,
  category,
  disabled,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Choose an image file (JPEG, PNG, or WebP).");
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("name", file.name);
        const res = await fetch("/api/media/upload", { method: "POST", body: form });
        const json = (await res.json()) as { data?: { storageUrl?: string }; error?: string };
        if (!res.ok) throw new Error(json.error || "Upload failed");
        const url = json.data?.storageUrl;
        if (!url) throw new Error("Upload did not return a URL");
        onChange(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void upload(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  return (
    <div className={cn("max-w-[21.25rem] space-y-2", className)}>
      <Label>{label}</Label>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-dashed bg-muted/30 transition-colors",
          !disabled && !uploading && "hover:border-primary/40",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {value ? (
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={value}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 320px"
              unoptimized
            />
            {!disabled ? (
              <div className="absolute right-2 top-2 flex gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-9 bg-background/90 shadow"
                  aria-label="Remove cover image"
                  onClick={() => onChange("")}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full flex-col items-center gap-2 p-4 text-center disabled:opacity-60"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            <OfferingCoverPlaceholder category={category} className="max-h-28 border-0" />
            <span className="text-xs text-muted-foreground">
              Drag and drop or click · 4:3 recommended
            </span>
            {uploading ? (
              <span className="inline-flex items-center gap-2 text-sm text-primary">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Uploading…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                <ImagePlus className="size-4" aria-hidden />
                Add cover image
              </span>
            )}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={onFileChange}
          disabled={disabled || uploading}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}
      {value && !disabled ? (
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          Replace image
        </Button>
      ) : null}
    </div>
  );
}
