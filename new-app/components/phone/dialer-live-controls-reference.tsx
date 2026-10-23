'use client'

import { Button } from '@/components/ui/button'
import { SimpleSelect } from '@/components/app/filters'

/**
 * Certification / browser-audit surface: shows every in-session control with stable test ids
 * when `?pd_audit=live_controls` is on the dialer URL (controls are disabled here — not on a live call).
 */
export function DialerLiveControlsReference() {
  return (
    <section
      aria-label="Live session controls reference"
      data-testid="pd-live-controls-reference"
      className="mb-4 rounded-lg border border-dashed bg-muted/20 p-3"
    >
      <p className="mb-2 text-xs text-muted-foreground">
        Reference panel (audit mode): the same controls appear during an active call in the session toolbar above.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled data-testid="pd-control-mute">
          Mute
        </Button>
        <Button type="button" size="sm" variant="outline" disabled data-testid="pd-control-hold">
          Hold
        </Button>
        <Button type="button" size="sm" variant="outline" disabled data-testid="pd-control-voicemail-drop">
          Voicemail drop
        </Button>
        <Button type="button" size="sm" variant="outline" disabled data-testid="pd-control-live-voicemail">
          Live voicemail
        </Button>
        <Button type="button" size="sm" variant="outline" disabled data-testid="pd-control-recording">
          Pause recording
        </Button>
        <div data-testid="pd-control-transfer-type">
          <SimpleSelect
            label="Transfer type"
            value="cold"
            onChange={() => undefined}
            options={[
              { value: 'cold', label: 'Cold transfer' },
              { value: 'warm', label: 'Warm transfer' },
              { value: 'three_way', label: '3-way conference' },
            ]}
            className="min-w-[140px]"
            disabled
          />
        </div>
        <Button type="button" size="sm" variant="outline" disabled data-testid="pd-control-transfer">
          Transfer
        </Button>
        <Button type="button" size="sm" variant="outline" disabled data-testid="pd-control-warm-complete">
          Complete warm transfer
        </Button>
        <Button type="button" size="sm" variant="outline" disabled data-testid="pd-control-pause-session">
          Pause
        </Button>
        <Button type="button" size="sm" variant="outline" disabled data-testid="pd-control-end-session">
          End session
        </Button>
        <Button type="button" size="sm" variant="outline" disabled data-testid="pd-control-schedule-appointment">
          Schedule appointment
        </Button>
        <Button type="button" size="sm" disabled data-testid="pd-control-save-next">
          Save &amp; next
        </Button>
      </div>
      <fieldset className="mt-3 flex flex-col gap-2">
        <legend className="text-sm font-medium">Disposition</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled className="rounded-full border px-3 py-1.5 text-sm" data-testid="pd-control-disposition">
            Callback
          </button>
        </div>
      </fieldset>
    </section>
  )
}
