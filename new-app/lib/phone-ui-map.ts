import type { Call, CallOutcome } from '@/lib/data'
import type { PhoneCallDto } from '@/lib/phone/types'

export function mapPhoneCallDtoToCall(dto: PhoneCallDto): Call {
  const outcomeMap: Record<string, CallOutcome> = {
    answered: 'answered',
    missed: 'missed',
    voicemail: 'voicemail',
    failed: 'failed',
    busy: 'failed',
    canceled: 'failed',
  }
  return {
    id: dto.id,
    contactId: dto.contactId || undefined,
    caller: dto.caller,
    callerNumber: dto.callerNumber,
    numberId: dto.numberId || 'unknown',
    direction: dto.direction,
    startedAt: dto.startedAt,
    durationSec: dto.durationSec,
    outcome: outcomeMap[dto.outcome] || 'answered',
    routedTo: dto.routedTo,
    user: dto.user || undefined,
    recording: dto.recording,
    recordingUrl: dto.recordingUrl,
    callbackNeeded: dto.callbackNeeded,
    handled: dto.handled,
    disposition: dto.disposition || undefined,
    voicemail: dto.voicemail
      ? { transcript: dto.voicemail.transcript || '', durationSec: dto.voicemail.durationSec }
      : undefined,
  }
}
