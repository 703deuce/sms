import Link from 'next/link'
import { streamerNearLiveEnabled } from '@/lib/server/streamer/env'

export function TwitchClipsScopeBanner({ needsClipsEdit }: { needsClipsEdit: boolean }) {
  if (!streamerNearLiveEnabled() || !needsClipsEdit) return null
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
      <p className="font-medium text-amber-900 dark:text-amber-100">Enable chat !clip</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Re-connect Twitch to grant <code className="text-xs">clips:edit</code> so we can create official clips from chat
        commands.
      </p>
      <Link
        href="/api/streamer/oauth/twitch/start?upgrade=clips"
        className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
      >
        Re-authorize Twitch
      </Link>
    </div>
  )
}
