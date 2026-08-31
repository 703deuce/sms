'use client';
import { swatches } from '../mock-data';

export default function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="tv-popover w-64 p-3.5">
      <div className="grid grid-cols-6 gap-1.5 mb-3">
        {swatches.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`w-8 h-8 rounded-md transition-shadow ${
              value.toLowerCase() === c
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-card'
                : 'ring-1 ring-inset ring-black/10 hover:ring-black/25'
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div
        className="relative h-32 rounded-md cursor-crosshair ring-1 ring-inset ring-black/10"
        style={{ background: 'linear-gradient(to right, #fff, #2986cc), linear-gradient(to bottom, transparent, #000)', backgroundBlendMode: 'multiply' }}
        onClick={(e) => {
          const r = (e.target as HTMLElement).getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width;
          const y = (e.clientY - r.top) / r.height;
          const b = Math.round(255 * (1 - y));
          const bl = Math.round(38 + x * 166);
          onChange(`#${((bl << 16) | (Math.round(b * 0.6 + 60) << 8) | b).toString(16).padStart(6, '0')}`);
        }}
      >
        <div className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-md" style={{ left: '40%', top: '30%' }} />
      </div>
      <div className="mt-2.5 h-3 rounded-md ring-1 ring-inset ring-black/10" style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }} />
    </div>
  );
}
