"use client";

import { useEffect, useMemo } from "react";
import {
  clientFrameQuantumMs,
  filmstripTiles,
  spriteTileAt,
  type FilmstripSprite,
} from "@/lib/clips/editor/editor-assets";
import {
  useFilmstripFrames,
  type FrameExtractor,
} from "@/components/clips/editor/timeline/use-filmstrip-frames";

/**
 * FV2 CapCut-style filmstrip: frame thumbnails tiled along one lane item. One thumb per tile width,
 * so zooming in shows more (and closer-spaced) frames. Sources, best first:
 *   1. client frames (exact times at this zoom; clips and zoomed-in full videos)
 *   2. full-video sprite sheet tile (worker-made; instant overview at any zoom)
 *   3. a still (B-roll thumbnail / poster)
 * Only tiles inside the visible window are rendered (an hour-long item stays light).
 */
export function TimelineFilmstrip({
  fromMs,
  toMs,
  widthPx,
  heightPx,
  pxPerMs,
  visLeftPx,
  visRightPx,
  sprite = null,
  frames = null,
  stillUrl = null,
  aspect = 16 / 9,
  className,
}: {
  fromMs: number;
  toMs: number;
  widthPx: number;
  heightPx: number;
  /** Track px per OUTPUT ms (for the extraction quantum). */
  pxPerMs: number;
  visLeftPx?: number;
  visRightPx?: number;
  sprite?: FilmstripSprite | null;
  frames?: FrameExtractor | null;
  stillUrl?: string | null;
  aspect?: number;
  className?: string;
}) {
  const scale = sprite ? heightPx / sprite.tileH : 1;
  const frameAspect = sprite
    ? sprite.tileW / sprite.tileH
    : (frames?.aspect ?? aspect);
  const tileW = Math.max(
    16,
    Math.min(
      160,
      Math.round(heightPx * (frameAspect > 0 ? frameAspect : 16 / 9)),
    ),
  );
  const tiles = useMemo(
    () =>
      filmstripTiles({ fromMs, toMs, widthPx, tileW, visLeftPx, visRightPx }),
    [fromMs, toMs, widthPx, tileW, visLeftPx, visRightPx],
  );
  // Media ms per on-screen px can differ from 1/pxPerMs under speed changes; use the item's own ratio.
  const itemPxPerMs =
    widthPx > 0 && toMs > fromMs ? widthPx / (toMs - fromMs) : pxPerMs;
  const quantum = clientFrameQuantumMs(itemPxPerMs, tileW);
  // Full video: the sprite already covers coarse zooms — only refine when it is too coarse.
  const useClient = Boolean(
    frames && !frames.failed && (!sprite || quantum <= sprite.intervalMs / 2),
  );
  const wantKey = useClient
    ? tiles.map((t) => Math.round(t.mediaMs / quantum)).join(",")
    : "";
  useEffect(() => {
    if (!useClient || !frames) return;
    frames.want(
      tiles.map((t) => t.mediaMs),
      quantum,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantKey, quantum, useClient, frames]);

  if (!tiles.length) return null;
  return (
    <div
      className={`pointer-events-none absolute left-0 top-0 overflow-hidden ${className ?? ""}`}
      style={{ width: widthPx, height: heightPx }}
      data-testid="timeline-filmstrip"
      data-tiles={tiles.length}
      data-source={
        useClient ? "client" : sprite ? "sprite" : stillUrl ? "still" : "none"
      }
      aria-hidden
    >
      {tiles.map((t) => {
        const client =
          useClient && frames ? frames.get(t.mediaMs, quantum) : null;
        const st = !client && sprite ? spriteTileAt(sprite, t.mediaMs) : null;
        const style: React.CSSProperties = {
          left: t.leftPx,
          width: t.widthPx,
          height: heightPx,
        };
        if (client) {
          style.backgroundImage = `url("${client}")`;
          style.backgroundSize = "cover";
          style.backgroundPosition = "center";
        } else if (st && sprite) {
          style.backgroundImage = `url("${sprite.sheetUrls[st.sheet]}")`;
          style.backgroundSize = `${sprite.cols * sprite.tileW * scale}px ${sprite.rows * sprite.tileH * scale}px`;
          style.backgroundPosition = `${-st.x * scale}px ${-st.y * scale}px`;
        } else if (stillUrl) {
          style.backgroundImage = `url("${stillUrl}")`;
          style.backgroundSize = "cover";
          style.backgroundPosition = "center";
        }
        return (
          <span
            key={t.leftPx}
            className="absolute top-0 border-r border-black/40 bg-black/20 bg-no-repeat"
            style={style}
            data-testid="timeline-filmstrip-tile"
            data-media-ms={Math.round(t.mediaMs)}
          />
        );
      })}
    </div>
  );
}

/**
 * E5×FV2: filmstrip for a Video-lane span played from ANOTHER source (upload / angle / still), so
 * the thumbnails show that source's own frames — not the main video's. Positioned by the caller.
 */
export function SourceSegmentFilmstrip({
  url,
  mediaType,
  fromMs,
  toMs,
  leftPx,
  topPx,
  widthPx,
  heightPx,
  pxPerMs,
  visLeftPx,
  visRightPx,
}: {
  url: string | null;
  mediaType: "video" | "image" | "audio";
  fromMs: number;
  toMs: number;
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
  pxPerMs: number;
  visLeftPx?: number;
  visRightPx?: number;
}) {
  const isImage = mediaType === "image";
  const frames = useFilmstripFrames(
    !isImage && mediaType === "video" ? url : null,
  );
  if (mediaType === "audio") return null;
  return (
    <div
      className="pointer-events-none absolute overflow-hidden rounded-[3px] bg-zinc-800 ring-1 ring-amber-400/70"
      style={{ left: leftPx, top: topPx, width: widthPx, height: heightPx }}
      data-testid="timeline-source-filmstrip"
      data-source-url={url ?? ""}
    >
      {/* No URL yet (media list loading): a dark span, never the main video's frames. */}
      {url ? (
        <TimelineFilmstrip
          fromMs={fromMs}
          toMs={isImage ? fromMs + Math.max(1, toMs - fromMs) : toMs}
          widthPx={widthPx}
          heightPx={heightPx}
          pxPerMs={pxPerMs}
          visLeftPx={visLeftPx}
          visRightPx={visRightPx}
          frames={isImage ? null : frames}
          stillUrl={isImage ? url : null}
        />
      ) : null}
    </div>
  );
}
