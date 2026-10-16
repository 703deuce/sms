"use client";

import type { VoiceProductSwitchConflict } from "@/lib/phone/voice-product-switch-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/newui-transplant/components/ui/dialog";
import { Button } from "@/newui-transplant/components/ui/button";

export function VoiceProductSwitchDialog({
  open,
  conflict,
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  conflict: VoiceProductSwitchConflict | null;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  if (!conflict) return null;
  const switchLabel = `Switch to ${conflict.targetProductLabel}`;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>This number is already in use</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-2">
            {conflict.message}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-foreground">
          Do you want to continue?
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy}>
            {switchLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
