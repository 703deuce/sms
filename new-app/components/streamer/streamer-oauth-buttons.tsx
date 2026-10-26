'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Flags = { twitchOAuth?: boolean; kickOAuth?: boolean }

export function StreamerOAuthButtons() {
  const [flags, setFlags] = useState<Flags | null>(null)

  useEffect(() => {
    void fetch('/api/streamer/config')
      .then((r) => r.json())
      .then((j: { data?: Flags }) => setFlags(j.data ?? {}))
      .catch(() => setFlags({}))
  }, [])

  if (!flags) {
    return (
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">Loading connect options…</div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {flags.twitchOAuth ? (
        <Button size="sm" variant="outline" render={<a href="/api/streamer/oauth/twitch/start" />} nativeButton={false}>
          Connect Twitch
        </Button>
      ) : null}
      {flags.kickOAuth ? (
        <Button size="sm" variant="outline" render={<a href="/api/streamer/oauth/kick/start" />} nativeButton={false}>
          Connect Kick
        </Button>
      ) : null}
    </div>
  )
}
