import Link from "next/link";
import { scoreBarColor } from "@/lib/design/score-colors";
import { cn } from "@/lib/utils";

export function SemiCircleGauge({
  score,
  size = 140,
  strokeWidth = 12,
  className,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = Math.PI;
  const endAngle = 0;
  const scoreAngle = startAngle - (clamped / 100) * Math.PI;

  function polar(angle: number) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy - radius * Math.sin(angle),
    };
  }

  const bgStart = polar(startAngle);
  const bgEnd = polar(endAngle);
  const scoreEnd = polar(scoreAngle);

  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;
  const scorePath =
    clamped > 0
      ? `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 0 1 ${scoreEnd.x} ${scoreEnd.y}`
      : "";

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size / 2 + 8 }}>
      <svg width={size} height={size / 2 + 8} className="overflow-visible">
        <path d={bgPath} fill="none" stroke="#e4e4e7" strokeWidth={strokeWidth} strokeLinecap="round" />
        {scorePath && (
          <path d={scorePath} fill="none" stroke="#059669" strokeWidth={strokeWidth} strokeLinecap="round" />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className={cn("font-bold tabular-nums leading-none text-zinc-900", size <= 120 ? "text-lg" : "text-3xl")}>
          {Math.round(clamped)}
        </span>
        <span className="mt-0.5 text-xs font-medium text-zinc-500">/100</span>
      </div>
    </div>
  );
}

export function DonutScore({
  score,
  size = 72,
  strokeWidth = 7,
  className,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#059669"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold tabular-nums text-zinc-900">{Math.round(clamped)}</span>
      </div>
    </div>
  );
}

export function CircularGauge({
  score,
  size = 120,
  className,
}: {
  score: number;
  size?: number;
  className?: string;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#059669"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-bold tabular-nums text-zinc-900",
            size <= 96 ? "text-lg" : "text-2xl"
          )}
        >
          {Math.round(clamped)}
        </span>
        <span className="text-[10px] font-medium text-zinc-500">/100 Score</span>
      </div>
    </div>
  );
}

export function Sparkline({
  data,
  color = "#3b82f6",
  width = 80,
  height = 32,
  className,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const points = data.length > 1 ? data : [data[0] ?? 0, data[0] ?? 0];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className={cn("shrink-0", className)}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}

export function MiniBarChart({
  data,
  color = "#3b82f6",
  width = 72,
  height = 36,
  className,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const bars = data.length ? data : [0];
  const max = Math.max(...bars, 1);
  const barWidth = width / bars.length - 2;

  return (
    <svg width={width} height={height} className={cn("shrink-0", className)}>
      {bars.map((v, i) => {
        const barHeight = (v / max) * (height - 4);
        const x = i * (barWidth + 2) + 1;
        const y = height - barHeight;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={2}
            fill={color}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

export { scoreBarColor };

export function ScoreProgressBar({
  score,
  color,
  className,
}: {
  score: number;
  color?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-zinc-100", className)}>
      <div
        className={cn("h-full rounded-full transition-all", color ?? scoreBarColor(clamped))}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function OverviewCardShell({
  href,
  children,
  className,
}: {
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const classes = cn(
    "block rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:border-emerald-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return <div className={classes}>{children}</div>;
}
