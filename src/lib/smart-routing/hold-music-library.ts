export type HoldMusicTrackDef = {
  slug: string;
  title: string;
  description: string;
  prompt: string;
  musicLengthMs: number;
};

const BASE_PROMPT =
  "Instrumental telephone hold music for a professional business. No vocals, no speech, no lyrics, no recognizable copyrighted melody. Smooth consistent arrangement, moderate-low energy, no abrupt transitions, no dramatic ending, designed to loop seamlessly.";

export const DEFAULT_HOLD_MUSIC_SLUG = "hold-modern-corporate";

export const HOLD_MUSIC_TRACKS: HoldMusicTrackDef[] = [
  {
    slug: "hold-modern-corporate",
    title: "Modern Corporate",
    description: "Polished warm professional — light piano, subtle synth",
    prompt: `${BASE_PROMPT} Style: modern corporate, polished, warm, professional, light piano, subtle synth, soft percussion.`,
    musicLengthMs: 90000,
  },
  {
    slug: "hold-calm-acoustic",
    title: "Calm Acoustic",
    description: "Acoustic guitar, relaxed and friendly",
    prompt: `${BASE_PROMPT} Style: calm acoustic guitar, soft percussion, relaxed, friendly, unobtrusive.`,
    musicLengthMs: 90000,
  },
  {
    slug: "hold-soft-piano",
    title: "Soft Piano",
    description: "Gentle piano with subtle ambient backing",
    prompt: `${BASE_PROMPT} Style: soft piano, subtle ambient backing, calm, premium, no dramatic changes.`,
    musicLengthMs: 90000,
  },
  {
    slug: "hold-light-jazz",
    title: "Light Jazz",
    description: "Clean light jazz waiting-room feel",
    prompt: `${BASE_PROMPT} Style: light jazz, soft piano, brushed drums, subtle bass, professional waiting room.`,
    musicLengthMs: 90000,
  },
  {
    slug: "hold-upbeat-business",
    title: "Upbeat Business",
    description: "Positive energetic without being distracting",
    prompt: `${BASE_PROMPT} Style: upbeat business, positive energy without distraction, light percussion, bright keys.`,
    musicLengthMs: 90000,
  },
  {
    slug: "hold-ambient",
    title: "Ambient",
    description: "Smooth ambient pads, modern and low distraction",
    prompt: `${BASE_PROMPT} Style: ambient pads, light melodic texture, relaxed, modern, low distraction.`,
    musicLengthMs: 90000,
  },
  {
    slug: "hold-minimal",
    title: "Minimal",
    description: "Sparse clean modern for long hold periods",
    prompt: `${BASE_PROMPT} Style: minimal, sparse, clean, modern, soft electronic and piano elements.`,
    musicLengthMs: 90000,
  },
  {
    slug: "hold-classic",
    title: "Classic Hold",
    description: "Traditional professional telephone hold feel",
    prompt: `${BASE_PROMPT} Style: classic professional telephone hold, clean instrumentation, modern production, not cheesy.`,
    musicLengthMs: 90000,
  },
  {
    slug: "hold-soft-electronic",
    title: "Soft Electronic",
    description: "Subtle electronic rhythm, warm synth",
    prompt: `${BASE_PROMPT} Style: soft electronic, subtle rhythm, warm synth, contemporary, low intensity.`,
    musicLengthMs: 90000,
  },
  {
    slug: "hold-warm-lounge",
    title: "Warm Lounge",
    description: "Relaxed lounge — soft keys, light bass",
    prompt: `${BASE_PROMPT} Style: warm lounge, relaxed, soft keys, light bass, gentle percussion, upscale neutral.`,
    musicLengthMs: 90000,
  },
];

export function getHoldMusicTrack(slug: string): HoldMusicTrackDef | undefined {
  return HOLD_MUSIC_TRACKS.find((t) => t.slug === slug);
}
