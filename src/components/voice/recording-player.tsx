"use client";

import { useEffect, useState } from "react";

type Props = {
  recordingId: string;
  label?: string;
};

export function RecordingPlayer({ recordingId, label }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [channels, setChannels] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/voice/recordings/${recordingId}/url`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setUrl(j.data.url);
        setChannels(j.data.channels || 1);
        setExpiresAt(j.data.expiresAt);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [recordingId]);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!url) return <p className="text-sm text-muted-foreground">Loading recording…</p>;

  const expiryNote =
    expiresAt
      ? `Link expires ${new Date(expiresAt * 1000).toLocaleString()}`
      : null;

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium">{label}</p>}
      {channels >= 2 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Dual-channel (agent + caller)</p>
          <audio controls preload="none" className="w-full" src={url}>
            Your browser does not support audio.
          </audio>
          <p className="text-xs text-muted-foreground">
            Stereo recording — left/right channels contain separate legs when provided by Telnyx.
          </p>
        </div>
      ) : (
        <audio controls preload="none" className="w-full" src={url}>
          Your browser does not support audio.
        </audio>
      )}
      {expiryNote && <p className="text-xs text-muted-foreground">{expiryNote}</p>}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs hover:bg-muted"
      >
        Open signed URL
      </a>
    </div>
  );
}
