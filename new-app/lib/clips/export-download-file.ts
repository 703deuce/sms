/** Trigger a browser download for cross-origin signed URLs (anchor.download is ignored). */
export async function downloadFileFromUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`)
  }
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename || 'clip.mp4'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
