/** System music catalog (§5.6). generationId filled after seed-t2v-music.ts or manual MUSIC jobs. */
export type T2vMusicLibraryTrack = {
  id: string
  title: string
  mood: string
  durationSec: number
  generationId?: string
  previewUrl?: string
}

export const T2V_MUSIC_LIBRARY: T2vMusicLibraryTrack[] = [
  { id: 'mus_upbeat_1', title: 'Bright steps', mood: 'Upbeat', durationSec: 90 },
  { id: 'mus_upbeat_2', title: 'Morning rush', mood: 'Upbeat', durationSec: 120 },
  { id: 'mus_calm_1', title: 'Soft horizon', mood: 'Calm', durationSec: 90 },
  { id: 'mus_calm_2', title: 'Quiet room', mood: 'Calm', durationSec: 120 },
  { id: 'mus_corp_1', title: 'Boardroom', mood: 'Corporate', durationSec: 90 },
  { id: 'mus_corp_2', title: 'Quarterly', mood: 'Corporate', durationSec: 120 },
  { id: 'mus_cine_1', title: 'Wide lens', mood: 'Cinematic', durationSec: 120 },
  { id: 'mus_insp_1', title: 'Rise up', mood: 'Inspiring', durationSec: 90 },
  { id: 'mus_play_1', title: 'Bounce', mood: 'Playful', durationSec: 60 },
  { id: 'mus_dram_1', title: 'Tension line', mood: 'Dramatic', durationSec: 90 },
  { id: 'mus_lofi_1', title: 'Late night', mood: 'Lo-fi', durationSec: 120 },
  { id: 'mus_lofi_2', title: 'Study lamp', mood: 'Lo-fi', durationSec: 90 },
]
