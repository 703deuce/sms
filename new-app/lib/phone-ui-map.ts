import type { Call, CallOutcome } from '@/lib/data'
import type { PhoneCallDto } from '@/lib/phone/types'

function summaryFromAiField(raw: string | null, transcript: string | null): string {
  if (!raw?.trim()) return transcript?.slice(0, 600) || 'Transcript available below.'
  try {
    const j = JSON.parse(raw) as { summary?: string; modelDerived?: boolean }
    if (j?.modelDerived && j.summary) return j.summary
  } catch {
    /* legacy text */
  }
  const stripped = raw.replace(/^Suggested follow-up:[^\n]*\n\nSummary:\s*/i, '').trim()
  return stripped || transcript?.slice(0, 600) || 'Transcript available below.'
}

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
    numberId: dto.numberId || dto.lineSummary?.id || 'unknown',
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
    callSource: dto.powerDialerSource
      ? {
          kind: dto.powerDialerSource.kind,
          label: dto.powerDialerSource.label,
          campaignId: dto.powerDialerSource.campaignId,
          listId: dto.powerDialerSource.listId,
        }
      : undefined,
    campaignId: dto.powerDialerSource?.campaignId,
    voicemail: dto.voicemail
      ? { transcript: dto.voicemail.transcript || '', durationSec: dto.voicemail.durationSec }
      : undefined,
    callNotes: dto.notes,
    contactSummary: dto.contactSummary || undefined,
    lineSummary: dto.lineSummary || undefined,
    ai:
      dto.transcriptText || dto.aiSummary
        ? {
            intent:
              dto.source === 'power_dialer' ? 'Power dialer conversation' : 'Recorded call',
            outcome: 'success',
            summary: summaryFromAiField(dto.aiSummary, dto.transcriptText),
            followUp: dto.aiSummary?.toLowerCase().includes('suggested follow-up') ? 'open' : 'none',
            tools: [],
            transcript: dto.transcriptText
              ? [
                  {
                    speaker: 'caller' as const,
                    text: dto.transcriptText,
                    at: '0:00',
                  },
                ]
              : [],
          }
        : undefined,
    metadata: dto.metadata,
  }
}
