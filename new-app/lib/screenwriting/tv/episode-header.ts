export interface EpisodeHeader {
  showTitle?: string
  episodeTitle?: string
  episodeNo?: string
  draft?: string
}

export function formatEpisodeHeaderPdfLine(h: EpisodeHeader): string {
  const parts = [h.showTitle, h.episodeNo ? `Episode ${h.episodeNo}` : null, h.episodeTitle, h.draft].filter(Boolean)
  return parts.join(' — ')
}
