'use client'

import { OptionGroup } from '@/components/app/option-group'
import { StatusBadge } from '@/components/app/status'
import { useAgent } from '@/components/providers/agent-provider'
import type { RuntimeProfile } from '@/lib/receptionist/runtime-profile'
import {
  CONVERSATIONAL_IVR_MODE_DESCRIPTION,
  CONVERSATIONAL_IVR_MODE_LABEL,
  FULL_RECEPTIONIST_MODE_DESCRIPTION,
  FULL_RECEPTIONIST_MODE_LABEL,
  RUNTIME_PROFILE_CONVERSATIONAL_IVR,
  RUNTIME_PROFILE_FULL_RECEPTIONIST,
  receptionistModeStatusCopy,
  resolveRuntimeProfile,
  runtimeProfileLabel,
} from '@/lib/receptionist/runtime-profile'

type Props = {
  showLiveHint?: boolean
  compact?: boolean
}

export function OperatingModeSelector({ showLiveHint = true, compact = false }: Props) {
  const { draft, live, update, unsaved, changes } = useAgent()
  const draftProfile = resolveRuntimeProfile(draft)
  const liveProfile = resolveRuntimeProfile(live)
  const modeChanged = draftProfile !== liveProfile
  const modeCopy = receptionistModeStatusCopy({
    draftProfile,
    liveProfile,
    hasUnpublishedDraft: changes.length > 0 || unsaved,
  })

  const setProfile = (profile: RuntimeProfile) => {
    update('runtimeProfile', profile)
  }

  return (
    <div className="flex flex-col gap-3">
      {showLiveHint && (
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{modeCopy.editingLine}</span>
            {modeChanged && <StatusBadge tone="warning">Publish to change live mode</StatusBadge>}
          </div>
          <span>
            {modeCopy.liveLine}
            {modeChanged ? (
              <>
                {' '}
                — you are editing{' '}
                <span className="font-medium text-foreground">{runtimeProfileLabel(draftProfile)}</span>
              </>
            ) : null}
          </span>
        </div>
      )}
      <OptionGroup
        label={compact ? 'Operating mode' : 'How should your AI receptionist operate?'}
        value={draftProfile}
        onChange={setProfile}
        columns={2}
        options={[
          {
            value: RUNTIME_PROFILE_CONVERSATIONAL_IVR,
            label: CONVERSATIONAL_IVR_MODE_LABEL,
            description: CONVERSATIONAL_IVR_MODE_DESCRIPTION,
          },
          {
            value: RUNTIME_PROFILE_FULL_RECEPTIONIST,
            label: FULL_RECEPTIONIST_MODE_LABEL,
            description: FULL_RECEPTIONIST_MODE_DESCRIPTION,
          },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        Operating mode is chosen by your business and applied to published calls. Switching modes keeps all saved
        settings — only navigation and live capabilities change after you publish.
      </p>
    </div>
  )
}
