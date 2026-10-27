'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Mic, Speaker, Video } from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { writeJoinPayload } from '@/lib/recording/rooms-join-storage'
import { RoomsFullPage, RoomsTopBar } from './rooms-layout-shell'

type Role = 'HOST' | 'GUEST'

/** §23 pre-join — 520 card + 360 side column at 1440×900 */
export function RoomsPrejoinClient({
  sessionId,
  sessionTitle,
  role,
  showHostBadge = role === 'HOST',
  producerMode = false,
  token,
  livekitUrl,
  identity,
  defaultDisplayName = '',
}: {
  sessionId: string
  sessionTitle: string
  role: Role
  showHostBadge?: boolean
  producerMode?: boolean
  token: string
  livekitUrl: string
  identity: string
  defaultDisplayName?: string
}) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [displayName, setDisplayName] = useState(defaultDisplayName)
  const [headphones, setHeadphones] = useState<'yes' | 'no' | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [micAvailable, setMicAvailable] = useState(false)
  const [camAvailable, setCamAvailable] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    async function startPreview() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        setMicAvailable(stream.getAudioTracks().length > 0)
        setCamAvailable(stream.getVideoTracks().length > 0)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setPreviewError(null)
      } catch {
        setPreviewError('No camera or microphone — you can still join muted.')
        setMicAvailable(false)
        setCamAvailable(false)
      }
    }
    void startPreview()
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const onJoin = useCallback(() => {
    if (!displayName.trim() || headphones === null) return
    setJoining(true)
    const studioRole = producerMode ? 'producer' : role === 'HOST' ? 'HOST' : 'GUEST'
    writeJoinPayload(sessionId, {
      token,
      url: livekitUrl,
      identity,
      displayName,
      role: studioRole,
      headphones,
      micEnabled: micAvailable,
      camEnabled: camAvailable,
    })
    router.push(`/app/rooms/${sessionId}/studio`)
  }, [
    camAvailable,
    displayName,
    headphones,
    identity,
    livekitUrl,
    micAvailable,
    producerMode,
    router,
    role,
    sessionId,
    token,
  ])

  return (
    <RoomsFullPage>
      <RoomsTopBar />
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="flex max-w-[928px] flex-col items-center gap-12 lg:flex-row lg:items-start">
          <div className="surface w-full max-w-[520px] rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[oklch(0.1_0_0)]">
              <video ref={videoRef} className="size-full object-cover -scale-x-100" muted playsInline />
              {previewError ? (
                <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-muted-foreground">
                  {previewError}
                </p>
              ) : null}
            </div>
            <div className="mt-3 space-y-2">
              <DeviceRow icon={Video} label={camAvailable ? 'Camera ready' : 'Camera off'} />
              <DeviceRow icon={Mic} label={micAvailable ? 'Microphone ready' : 'Microphone off'} />
              <DeviceRow icon={Speaker} label="Speakers" />
            </div>
          </div>
          <div className="w-full max-w-[360px] space-y-4">
            <div>
              <h1 className="text-xl font-semibold">Let&apos;s check your audio and video!</h1>
              <p className="mt-2 text-sm text-muted-foreground">Are you using headphones?</p>
              <div className="mt-3 flex gap-2">
                <ToggleChip active={headphones === 'yes'} onClick={() => setHeadphones('yes')}>Yes</ToggleChip>
                <ToggleChip active={headphones === 'no'} onClick={() => setHeadphones('no')}>No</ToggleChip>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-semibold">Your name</label>
              <div className="flex gap-2">
                <Input
                  className="h-9 flex-1"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                />
                {showHostBadge ? (
                  <Button variant="outline" className="h-9 w-24 shrink-0 gap-1 px-2 text-[13px]">
                    Host
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                ) : null}
              </div>
            </div>
            <PrimaryButton
              className="h-9 w-full"
              disabled={!displayName.trim() || headphones === null || joining}
              onClick={onJoin}
            >
              Join
            </PrimaryButton>
            <p className="text-xs text-muted-foreground">
              Session: {sessionTitle}. By joining you agree to Transovo&apos;s terms.
            </p>
          </div>
        </div>
      </div>
    </RoomsFullPage>
  )
}

function DeviceRow({ icon: Icon, label }: { icon: typeof Video; label: string }) {
  return (
    <button
      type="button"
      className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-left text-[13px]"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{label}</span>
      <ChevronDown className="size-4 shrink-0 opacity-60" />
    </button>
  )
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 w-[88px] rounded-lg border text-[13px] font-medium transition-colors',
        active ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-transparent hover:bg-accent/60',
      )}
    >
      {children}
    </button>
  )
}
