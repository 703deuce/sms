# Remotion: reference (tested on this lab, Remotion 4.0.528, 854x480, Nov 26 2026)

A complete project that renders a footage segment with: 2.5D push + parallax layers, a themed media frame that
springs in, word-synced kinetic type, a counter with a source line, and whip in/out edges. Render of a 4 s
segment: ~24 s, 0.4 MB at --crf 26. Copy these three files into `rm/src/`, then change data, not structure.

## src/index.ts
```ts
import {registerRoot} from 'remotion';
import {Root} from './Root';
registerRoot(Root);
```

## src/Root.tsx (one Composition per segment; times on the narration clock)
```tsx
import React from 'react';
import {Composition} from 'remotion';
import {FootageScene} from './FootageScene';

// One <Composition> per Remotion segment; t0/t1 come from public/timing.json (the narration clock).
const segs = [
  {id: 'Seg02', t0: 0.0, t1: 4.0, clip: 'clip.mp4', clipStart: 0, title: 'BREAKING POINT',
   words: [{w: 'THE', t: 0.6}, {w: 'NUMBER', t: 0.9}, {w: 'THAT', t: 1.3}, {w: 'MATTERED', t: 1.5}],
   count: {value: 40000, t: 2.2, prefix: '$', caption: 'SOURCE: COURT RECORDS'}},
];

export const Root: React.FC = () => (
  <>
    {segs.map((s) => (
      <Composition key={s.id} id={s.id} component={FootageScene} defaultProps={s}
        width={854} height={480} fps={30} durationInFrames={Math.round((s.t1 - s.t0) * 30)} />
    ))}
  </>
);
```

## src/FootageScene.tsx
```tsx
import React from 'react';
import {AbsoluteFill, Easing, interpolate, OffthreadVideo, spring, staticFile,
  useCurrentFrame, useVideoConfig} from 'remotion';

const PAL = {base: '#14161b', ink: '#e9e2d0', accent: '#d63a2f'};   // same palette as the other engine
const ease = Easing.bezier(0.16, 1, 0.3, 1);                         // ease-out (expo-like)
const io = Easing.inOut(Easing.cubic);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

type Word = {w: string; t: number};
type Props = {t0: number; t1: number; clip: string; clipStart: number; title: string; words: Word[];
  count?: {value: number; t: number; prefix?: string; suffix?: string; caption?: string}};

export const FootageScene: React.FC<Props> = ({t0, t1, clip, clipStart, title, words, count}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames: N} = useVideoConfig();
  const at = (t: number) => (t - t0) * fps;                         // film seconds -> frame in this segment

  // camera: slow push over the whole segment + slight lateral drift (2.5D)
  const z = interpolate(f, [0, N], [1.0, 1.18], {...clamp, easing: io});
  const cx = interpolate(f, [0, N], [12, -12], {...clamp, easing: io});
  // whip in/out at the segment edges (pairs with a whoosh cue)
  const whipIn = interpolate(f, [0, 8], [1, 0], {...clamp, easing: ease});
  const whipOut = interpolate(f, [N - 8, N], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
  const whipX = whipIn * 160 - whipOut * 160;
  const blur = (whipIn + whipOut) * 14;

  // themed frame lands with a spring (overshoot + settle)
  const land = spring({frame: f - 2, fps, config: {damping: 14, stiffness: 160}});
  const frameY = interpolate(land, [0, 1], [60, 0]);
  const rot = interpolate(land, [0, 1], [-3, -1]);

  return (
    <AbsoluteFill style={{background: PAL.base, overflow: 'hidden'}}>
      {/* far layer: moves at 0.3x the camera */}
      <AbsoluteFill style={{transform: `translateX(${cx * 0.3}px) scale(${1 + (z - 1) * 0.3})`,
        background: `radial-gradient(circle at 30% 40%, #2a2e38 0%, ${PAL.base} 70%)`}} />
      {/* mid layer: the themed media frame, moves 1x */}
      <AbsoluteFill style={{transform: `translateX(${cx + whipX}px) scale(${z})`, filter: `blur(${blur}px)`,
        justifyContent: 'center', alignItems: 'center'}}>
        <div style={{width: 560, transform: `translateY(${frameY}px) rotate(${rot}deg)`, background: '#0b0c10',
          borderRadius: 10, boxShadow: '0 18px 40px rgba(0,0,0,0.6)', overflow: 'hidden', border: '1px solid #333'}}>
          <div style={{height: 26, background: '#1d2027', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px',
            color: '#9aa0aa', font: '600 12px Inter, Arial', letterSpacing: 1}}>
            <span style={{width: 9, height: 9, borderRadius: 5, background: PAL.accent}} />{title}
          </div>
          <OffthreadVideo src={staticFile(clip)} startFrom={Math.round(clipStart * fps)} muted
            style={{width: 560, height: 315, objectFit: 'cover', display: 'block'}} />
        </div>
      </AbsoluteFill>
      {/* near layer: dust/light leak moves 1.5x, blurred */}
      <AbsoluteFill style={{transform: `translateX(${cx * 1.5}px)`, filter: 'blur(6px)', opacity: 0.25,
        background: 'radial-gradient(circle at 85% 15%, rgba(255,210,150,0.5), transparent 35%)'}} />
      {/* word-synced kinetic type: each word springs in at its spoken time, holds, exits with the segment */}
      <div style={{position: 'absolute', left: 43, top: 30, display: 'flex', gap: 10, flexWrap: 'wrap', maxWidth: 768}}>
        {words.map(({w, t}, i) => {
          const s = spring({frame: f - at(t), fps, config: {damping: 13, stiffness: 180}});
          const hit = i === words.length - 1;
          return (
            <span key={i} style={{font: `800 ${hit ? 40 : 30}px "Bebas Neue", Oswald, Impact, sans-serif`,
              color: hit ? PAL.accent : PAL.ink, opacity: s * (1 - whipOut), transform: `translateY(${(1 - s) * 24}px)`,
              textShadow: '0 2px 8px rgba(0,0,0,0.7)'}}>{w}</span>
          );
        })}
      </div>
      {/* counter / data callout */}
      {count ? (() => {
        const p = interpolate(f, [at(count.t), at(count.t) + 30], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
        const pop = spring({frame: f - at(count.t), fps, config: {damping: 12, stiffness: 200}});
        return (
          <div style={{position: 'absolute', right: 43, bottom: 30, textAlign: 'right', opacity: pop * (1 - whipOut),
            transform: `scale(${0.8 + 0.2 * pop})`, transformOrigin: 'right bottom'}}>
            <div style={{font: '800 64px "Bebas Neue", Oswald, Impact, sans-serif', color: PAL.ink, lineHeight: 1}}>
              {count.prefix ?? ''}{Math.round(count.value * p).toLocaleString('en-US')}{count.suffix ?? ''}</div>
            <div style={{height: 4, background: PAL.accent, width: `${p * 100}%`, marginLeft: 'auto'}} />
            <div style={{font: '600 13px Inter, Arial', color: '#9aa0aa', letterSpacing: 1.5, marginTop: 6}}>{count.caption}</div>
          </div>
        );
      })() : null}
    </AbsoluteFill>
  );
};
```

## Word times from the voice clock
```ts
// public/timing.json from Cinematic build_narration.py: {segments:[{id,start,end,vo}]}
import timing from '../public/timing.json';   // or fetch(staticFile('timing.json')) with delayRender
export const wordT = (lineId: number, word: string, text: string) => {
  const s = timing.segments.find((x: any) => x.id === lineId)!;
  const i = Math.max(0, text.toLowerCase().indexOf(word.toLowerCase()));
  return s.start + (s.end - s.start) * i / Math.max(1, text.length);   // letter share, like Cinematic doc.W
};
```
Exact word times: `transcribe audio/narration.m4a` (Deepgram words) when the key service passes Deepgram.
Generating the `segs` array in Python from timing.json + scene-plan and writing `src/segs.json` is fine.

## More patterns
- **Photo with Ken Burns in a polaroid:** `<div style={{background:'#f4f1ea', padding:'10px 10px 34px',
  transform:`rotate(${rot}deg)`}}><Img src={staticFile('p1.jpg')} style={{width:420, height:300,
  objectFit:'cover', transform:`scale(${interpolate(f,[0,N],[1.05,1.2])})`}}/></div>` + a tape strip div.
- **Zoom-through:** scale the frame from 1 to ~2.4 over 10 frames (ease-in), hard cut to the full-screen clip.
- **Bar/line chart draw-on:** bar height = `interpolate(f,[s+i*3, s+i*3+15],[0,h],{...clamp,easing:ease})`;
  SVG line: `strokeDasharray={len} strokeDashoffset={len*(1-p)}`.
- **Highlighter swipe on a word:** absolutely positioned accent div, `scaleX` 0 -> 1 from the left in 8 frames.
- **Lower third:** bar wipes in (scaleX), name types on (slice by frame), holds >= 2 s, exits 6 frames.
- **Fonts:** system has DejaVu/Liberation; for Bebas Neue/Oswald copy a TTF into public/ and use
  `@font-face` via `staticFile`, or reuse the Cinematic project's `fonts/` (get_fonts.py).
- **Audio:** render segments with `--muted`; sound is mixed once for the whole film (lab-video-edit).

## Render flags that matter here
`--browser-executable=/usr/bin/chromium` (no download), `--concurrency 1 --disallow-parallel-encoding`
(memory), `--crf 26`, `--muted`, `--frames 0-59` (partial), `--log=error`. `npx remotion still ... --frame N`
for review stills. Do not run `npm install` in the job (node_modules is a shared symlink).

## Sources (fetched Nov 26, 2026)
- interpolate(): https://www.remotion.dev/docs/interpolate
- spring(): https://www.remotion.dev/docs/spring
- <Sequence>: https://www.remotion.dev/docs/sequence
- <OffthreadVideo>: https://www.remotion.dev/docs/offthreadvideo
- CLI render flags: https://www.remotion.dev/docs/cli/render
- Licence (free for individuals and small teams): https://www.remotion.dev/docs/license
- Motion principles behind the snippets (easing, overshoot, stagger): see lab-video-motion/reference.md


---

## 5. Claude Remotion Skill (haidrrrry/claude-remotion-skill @ `1dcbe5e`)

- **Where:** `/opt/engines/repos/claude-remotion-skill`. **Manual:** `/opt/engines/repos/claude-remotion-skill/remotion-motion-graphics/SKILL.md` (ten non-negotiable motion rules; the mandatory render → inspect → fix loop).
  - Craft library: `…/remotion-motion-graphics/references/motion-patterns.md` (17 components: BgMesh, Grade, Grain, Vignette, KenBurns, WordReveal, Stagger, Counter, captions, transitions, parallax).
  - Design: `…/references/design-rules.md`, which ends in a final checklist to run.
  - Theme template: `…/assets/theme.ts`.
- **Runnable examples:** `/opt/engines/repos/claude-remotion-skill/examples` (`npm install && npm run audio`; scripts `render:profile|focuscat|selffix|codeedit`). These are for study, never output.
- **New scene project:**
  ```bash
  mkdir -p $J/scenes/S01 && cd $J/scenes/S01 && npm init -y && npm i remotion @remotion/cli react react-dom @remotion/transitions @remotion/google-fonts
  cp /opt/engines/repos/claude-remotion-skill/remotion-motion-graphics/assets/theme.ts src/theme.ts   # then set it from scenes/theme.json
  npx remotion still src/index.ts <Comp> out/check_45.png --frame 45 --overwrite
  npx remotion render src/index.ts <Comp> out/S01.tmp.mp4 --codec h264 --crf 16
  npx remotion render src/index.ts <Comp> out/S01_overlay.webm --codec vp9 --pixel-format yuva420p   # alpha overlay
  ```
  If Chrome errors, pass `--browser-executable=/usr/bin/chromium` (or a Playwright `headless_shell`).
- **Strengths:** kinetic typography, social shorts, promos, beat-synced edits, word-synced captions, logo stings, polishing existing footage (`<OffthreadVideo>`).
