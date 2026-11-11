import type { DeliverFormat } from '@/lib/clips/export-deliver'

export function mp3EncoderAvailable(encoders: string[] | undefined): boolean {
  if (!encoders?.length) return true
  return encoders.includes('libmp3lame')
}

/** Preserve the requested format. Capability errors must never silently substitute another codec. */
export function effectiveAudioDeliverFormat(format: DeliverFormat, encoders: string[] | undefined): DeliverFormat {
  void encoders
  return format
}

export function exportActionLabel(format: DeliverFormat, encoders?: string[]): string {
  const f = effectiveAudioDeliverFormat(format, encoders)
  if (f === 'gif') return 'Export GIF'
  if (f === 'png') return 'Export PNG'
  if (f === 'mp3') return 'Export MP3'
  if (f === 'm4a') return 'Export Audio (M4A)'
  if (f === 'wav') return 'Export WAV'
  if (f === 'flac') return 'Export FLAC'
  if (f === 'mov') return 'Export MOV'
  return 'Export MP4'
}

export function exportDownloadLabel(format: DeliverFormat, encoders?: string[]): string {
  const f = effectiveAudioDeliverFormat(format, encoders)
  if (f === 'gif') return 'Download GIF'
  if (f === 'png') return 'Download PNG'
  if (f === 'mp3') return 'Download MP3'
  if (f === 'm4a') return 'Download M4A'
  if (f === 'wav') return 'Download WAV'
  if (f === 'flac') return 'Download FLAC'
  if (f === 'mov') return 'Download MOV'
  return 'Download MP4'
}

export function audioFormatOptionLabel(format: 'mp3' | 'm4a', encoders?: string[]): string {
  if (format === 'mp3') return 'MP3'
  if (format === 'm4a') return 'M4A'
  return format.toUpperCase()
}
