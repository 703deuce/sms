'use client'

import type { RecurringEditScope } from '@/lib/appointments/service-booking/types'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/newui-transplant/components/ui/dialog'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (scope: RecurringEditScope) => void
}

export function ArCalendarRecurringScopeDialog({ open, onClose, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply this change to</DialogTitle>
          <DialogDescription>This appointment is part of a recurring series.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Button type="button" onClick={() => onConfirm('this_only')}>This appointment</Button>
          <Button type="button" variant="outline" onClick={() => onConfirm('this_and_future')}>
            This and future appointments
          </Button>
          <Button type="button" variant="outline" onClick={() => onConfirm('entire_series')}>
            Entire series
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
