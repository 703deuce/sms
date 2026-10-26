export function ObsFallbackDocs() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border bg-muted/20 p-4 text-sm">
      <h3 className="text-base font-semibold">OBS fallback (no OAuth)</h3>
      <p>
        If you cannot connect Twitch or Kick yet, record locally with OBS and upload the finished file on the Streamer tab.
        Use MP4, 1080p or 720p, and include your facecam in-frame if you want stack layout detection.
      </p>
      <ol className="list-decimal pl-4">
        <li>OBS → Settings → Output → Recording format MP4.</li>
        <li>After your stream, drag the file into the Streamer upload dropzone.</li>
        <li>We run the same highlight pipeline as connected auto-pull.</li>
      </ol>
    </div>
  )
}
