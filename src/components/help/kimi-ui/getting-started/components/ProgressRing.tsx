export function ProgressRing({
  progress,
  size = 48,
  stroke = 4.5,
}: {
  progress: number; // 0–100
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, progress)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`Setup ${progress}% complete`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="var(--muted)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={progress === 100 ? "var(--success)" : "var(--primary)"}
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="gs-ring-arc"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-display font-semibold tabular-nums text-foreground"
        style={{ fontSize: size * 0.23 }}
      >
        {progress}%
      </span>
    </div>
  );
}
