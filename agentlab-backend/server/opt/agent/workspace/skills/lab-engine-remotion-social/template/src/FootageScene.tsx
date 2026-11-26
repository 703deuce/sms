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
