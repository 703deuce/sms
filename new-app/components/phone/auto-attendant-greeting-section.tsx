'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Panel } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'

type Props = {
  menuId: string
  greeting: string
  greetingMode: 'tts' | 'audio'
  audioUrl: string | null
  onGreetingChange: (text: string) => void
  onAudioUploaded: (url: string) => void
  onElevenLabsGenerated?: (url: string) => void
}

export function AutoAttendantGreetingSection({
  menuId,
  greeting,
  greetingMode,
  audioUrl,
  onGreetingChange,
  onAudioUploaded,
  onElevenLabsGenerated,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [recording, setRecording] = useState(false)
  const [elVoices, setElVoices] = useState<Array<{ id: string; label: string; description: string }>>([])
  const [elVoiceId, setElVoiceId] = useState('')
  const [elLoading, setElLoading] = useState(false)

  useEffect(() => {
    void fetch('/api/phone/elevenlabs/voices')
      .then((r) => r.json())
      .then((j) => {
        const voices = j.data?.voices || []
        setElVoices(voices)
        if (voices[0]?.id) setElVoiceId(voices[0].id)
      })
      .catch(() => undefined)
  }, [])

  const generateElevenLabs = async () => {
    if (!elVoiceId || !greeting.trim()) {
      toast.error('Enter greeting text and choose a voice')
      return
    }
    setElLoading(true)
    try {
      const res = await fetch(
        `/api/phone/auto-attendant/${encodeURIComponent(menuId)}/greeting-elevenlabs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: greeting, voiceId: elVoiceId }),
        },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Generation failed')
      const url = json.data?.url as string
      onAudioUploaded(url)
      onElevenLabsGenerated?.(url)
      toast.success('AI greeting audio saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ElevenLabs failed')
    } finally {
      setElLoading(false)
    }
  }
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const uploadFile = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`/api/phone/auto-attendant/${encodeURIComponent(menuId)}/greeting-audio`, {
      method: 'POST',
      body: form,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Upload failed')
    onAudioUploaded(json.data.url)
    toast.success('Greeting audio saved')
  }

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => chunksRef.current.push(e.data)
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], 'greeting.webm', { type: 'audio/webm' })
        void uploadFile(file).catch((e) => toast.error(e instanceof Error ? e.message : 'Upload failed'))
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRef.current = rec
      rec.start()
      setRecording(true)
    } catch {
      toast.error('Microphone permission is required to record')
    }
  }

  const stopRecord = () => {
    mediaRef.current?.stop()
    setRecording(false)
  }

  return (
    <Panel title="Welcome greeting" description="What callers hear before choosing an option.">
      <Tabs defaultValue={greetingMode === 'audio' ? 'upload' : 'tts'}>
        <TabsList>
          <TabsTrigger value="tts">Type greeting</TabsTrigger>
          <TabsTrigger value="elevenlabs">ElevenLabs AI</TabsTrigger>
          <TabsTrigger value="upload">Upload audio</TabsTrigger>
          <TabsTrigger value="record">Record</TabsTrigger>
        </TabsList>
        <TabsContent value="tts" className="mt-4">
          <Label htmlFor="greeting-text" className="sr-only">Greeting text</Label>
          <Textarea
            id="greeting-text"
            value={greeting}
            onChange={(e) => onGreetingChange(e.target.value)}
            rows={5}
            className="min-h-[120px]"
          />
          <p className="mt-1 text-xs text-muted-foreground">{greeting.length} characters</p>
        </TabsContent>
        <TabsContent value="elevenlabs" className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Generate a hosted MP3 from your script (sales, billing, or general voices). Saved audio is used on live calls.
          </p>
          <SimpleSelect
            label="AI voice"
            value={elVoiceId}
            onValueChange={setElVoiceId}
            options={elVoices.map((v) => ({
              value: v.id,
              label: `${v.label} — ${v.description}`,
            }))}
          />
          <Button type="button" disabled={elLoading} onClick={() => void generateElevenLabs()}>
            {elLoading ? 'Generating…' : 'Generate and save greeting'}
          </Button>
          {audioUrl && (
            <audio controls src={audioUrl} className="w-full">
              <track kind="captions" />
            </audio>
          )}
        </TabsContent>
        <TabsContent value="upload" className="mt-4 flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadFile(f).catch((err) => toast.error(err instanceof Error ? err.message : 'Failed'))
            }}
          />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Choose audio file
          </Button>
          {audioUrl && (
            <audio controls src={audioUrl} className="w-full">
              <track kind="captions" />
            </audio>
          )}
        </TabsContent>
        <TabsContent value="record" className="mt-4 flex flex-col gap-2">
          {!recording ? (
            <Button type="button" variant="outline" onClick={() => void startRecord()}>
              <Mic className="size-4" />
              Start recording
            </Button>
          ) : (
            <Button type="button" variant="destructive" onClick={stopRecord}>Stop and save</Button>
          )}
          <p className="text-xs text-muted-foreground">Recording uses your browser microphone and uploads when you stop.</p>
        </TabsContent>
      </Tabs>
    </Panel>
  )
}
