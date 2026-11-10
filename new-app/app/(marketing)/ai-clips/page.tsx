import { permanentRedirect } from 'next/navigation'

/** Permanent redirect from the retired `/ai-clips` slug (HTTP 308). */
export default function AiClipsLegacyRedirect() {
  permanentRedirect('/ai-clipper')
}
