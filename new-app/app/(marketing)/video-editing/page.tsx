import { permanentRedirect } from 'next/navigation'

/** Permanent redirect from the retired `/video-editing` slug (HTTP 308). */
export default function VideoEditingLegacyRedirect() {
  permanentRedirect('/video-editor')
}
