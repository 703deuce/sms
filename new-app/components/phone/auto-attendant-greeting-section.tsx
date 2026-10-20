'use client'

import { useRef, useState } from 'react'
import { Mic, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Panel } from '@/components/app/page-primitives'

type Props = {
  menuId: string
  greeting: string
  greetingMode: 'tts' | 'audio'
  audioUrl: string | null
  onGreetingChange: (text: string) => void
  onAudioUploaded: (url: string) => void
}

export function AutoAttendantGreetingSection({
  menuId,
  greeting,
  greetingMode,
  audioUrl,
  onGreetingChange,
  onAudioUploaded,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [recording, setRecording] = useState(false)
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
