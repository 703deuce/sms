// Deterministic pseudo-random QR-style pattern rendered as SVG.
export default function QrCode({ color, size = 260 }: { color: string; size?: number }) {
  const modules = 25;
  const cell = size / modules;
  let seed = 42;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const cells: React.ReactNode[] = [];
  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= modules - 8 && y < 8) || (x < 8 && y >= modules - 8);
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (inFinder(x, y)) continue;
      if (rand() > 0.55) {
        cells.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell + 0.4} height={cell + 0.4} rx={cell * 0.18} fill={color} />);
      }
    }
  }
  const finder = (fx: number, fy: number) => (
    <g key={`f${fx}-${fy}`}>
      <rect x={fx * cell} y={fy * cell} width={7 * cell} height={7 * cell} rx={cell * 0.9} fill={color} />
      <rect x={(fx + 1) * cell} y={(fy + 1) * cell} width={5 * cell} height={5 * cell} rx={cell * 0.6} fill="#fff" />
      <rect x={(fx + 2) * cell} y={(fy + 2) * cell} width={3 * cell} height={3 * cell} rx={cell * 0.4} fill={color} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded bg-white">
      {cells}
      {finder(0, 0)}
      {finder(modules - 7, 0)}
      {finder(0, modules - 7)}
      <rect x={(modules / 2 - 2.5) * cell} y={(modules / 2 - 2.5) * cell} width={5 * cell} height={5 * cell} rx={cell * 0.6} fill={color} />
      <rect x={(modules / 2 - 1.5) * cell} y={(modules / 2 - 1.5) * cell} width={3 * cell} height={3 * cell} rx={cell * 0.4} fill="#fff" />
      <rect x={(modules / 2 - 0.5) * cell} y={(modules / 2 - 0.5) * cell} width={cell} height={cell} rx={cell * 0.2} fill={color} />
    </svg>
  );
}
