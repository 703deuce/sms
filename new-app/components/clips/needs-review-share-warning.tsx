'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { clipNeedsReview, clipNeedsReviewReasons } from '../../lib/clips/clip-needs-review'

export function NeedsReviewShareWarning({
  open,
  aiMeta,
  title = 'This clip needs review before you share it',
  confirmLabel = 'Share anyway',
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  aiMeta?: unknown
  title?: string
  confirmLabel?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const reasons = clipNeedsReviewReasons(aiMeta)
  const flagged = clipNeedsReview(aiMeta)

  return (
    <AlertDialog open={open && flagged} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="needs-review-share-warning" size="default">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            It published with leftover editorial notes. You can cancel, or confirm and continue. This will not share
            until you confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {reasons.length ? (
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-foreground" data-testid="needs-review-share-reasons">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="needs-review-share-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            data-testid="needs-review-share-confirm"
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Run `action` immediately when the clip is not flagged; otherwise open the confirm first. */
export function requestNeedsReviewAck(
  aiMeta: unknown,
  openWarning: () => void,
  action: () => void,
): void {
  if (clipNeedsReview(aiMeta)) openWarning()
  else action()
}
