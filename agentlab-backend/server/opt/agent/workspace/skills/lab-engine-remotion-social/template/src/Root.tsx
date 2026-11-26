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
