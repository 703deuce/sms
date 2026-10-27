type Marker = { id: string; outMs: number; label?: string }

export function markersSorted(markers: Marker[] | undefined): Marker[] {
  return [...(markers ?? [])].sort((a, b) => a.outMs - b.outMs)
}

export function nextMarkerOutMs(markers: Marker[] | undefined, playheadOutMs: number): number | null {
  const sorted = markersSorted(markers)
  const next = sorted.find((m) => m.outMs > playheadOutMs + 20)
  return next?.outMs ?? null
}

export function prevMarkerOutMs(markers: Marker[] | undefined, playheadOutMs: number): number | null {
  const sorted = markersSorted(markers)
  let prev: Marker | null = null
  for (const m of sorted) {
    if (m.outMs >= playheadOutMs - 20) break
    prev = m
  }
  return prev?.outMs ?? null
}
