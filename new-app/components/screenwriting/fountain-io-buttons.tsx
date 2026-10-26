'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'

export function FountainIoButtons({ scriptId }: { scriptId: string }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const importFountain = async (file: File) => {
    const text = await file.text()
    if (!window.confirm('Replace this script with the imported Fountain file?')) return
    const res = await fetch(`/api/sw/scripts/${scriptId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'fountain', text }),
    })
    if (!res.ok) throw new Error('Import failed')
    window.location.reload()
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".fountain,.txt,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void importFountain(f).catch(() => alert('Import failed'))
          e.target.value = ''
        }}
      />
      <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
        Import Fountain
      </Button>
      <Button type="button" size="sm" variant="outline" render={<a href={`/api/sw/scripts/${scriptId}/export?format=fountain`} />} nativeButton={false}>
        Export Fountain
      </Button>
      <Button type="button" size="sm" variant="outline" render={<a href={`/api/sw/scripts/${scriptId}/export?format=txt`} />} nativeButton={false}>
        Export TXT
      </Button>
    </div>
  )
}
