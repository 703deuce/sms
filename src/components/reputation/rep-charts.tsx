"use client";

import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { REP_GREEN } from "@/components/reputation/rep-ui";

const GRID = "#EEF2F6";
const TICK = "#98A2B3";
const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #E6EAF0",
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(16,24,40,0.08)",
  background: "#fff",
};

type Series = {
  dataKey: string;
  name: string;
  color: string;
  fillOpacity?: number;
  strokeWidth?: number;
  dashed?: boolean;
};

type Marker = {
  x: string;
  label: string;
  color?: string;
};

function formatAxisDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function formatTooltipDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Smooth multi-series area chart — mockup-quality velocity graphs. */
export function RepAreaTrendChart({
  data,
  series,
  xKey = "date",
  height = 360,
  yAllowDecimals = false,
  markers = [],
}: {
  data: Array<Record<string, unknown>>;
  series: Series[];
  xKey?: string;
  height?: number;
  yAllowDecimals?: boolean;
  markers?: Marker[];
}) {
  const gradientId = (key: string) => `rep-grad-${key.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 18, right: 18, left: -8, bottom: 4 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.dataKey} id={gradientId(s.dataKey)} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={s.fillOpacity ?? 0.22} />
                <stop offset="60%" stopColor={s.color} stopOpacity={0.06} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="4 6" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: TICK }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            allowDecimals={yAllowDecimals}
            tick={{ fontSize: 11, fill: TICK }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
          />
          {markers.map((marker) => (
            <ReferenceLine
              key={`${marker.x}-${marker.label}`}
              x={marker.x}
              stroke={marker.color ?? "#F79009"}
              strokeDasharray="4 4"
              label={{
                value: marker.label,
                fontSize: 9,
                fill: "#667085",
                position: "insideTopLeft",
              }}
            />
          ))}
          {series.map((s, index) => (
            <Area
              key={s.dataKey}
              type="natural"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? (index === 0 ? 3 : 2.4)}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              fill={`url(#${gradientId(s.dataKey)})`}
              fillOpacity={1}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              isAnimationActive
              animationDuration={650}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Cumulative multi-series line chart (Review Velocity Over Time).
 * Solid primary line + dashed competitor lines, with brush zoom under the plot.
 */
export function RepCumulativeLineChart({
  data,
  series,
  xKey = "date",
  height = 420,
  markers = [],
  showBrush = true,
  highlightedKey = null,
  onPointClick,
}: {
  data: Array<Record<string, unknown>>;
  series: Series[];
  xKey?: string;
  height?: number;
  markers?: Marker[];
  showBrush?: boolean;
  highlightedKey?: string | null;
  onPointClick?: (payload: { date: string; values: Record<string, number> }) => void;
}) {
  const useBrush = showBrush && data.length > 14;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 16, right: 18, left: 4, bottom: useBrush ? 8 : 4 }}
          onClick={(state) => {
            if (!onPointClick || !state?.activeLabel) return;
            const point = data.find((row) => String(row[xKey]) === String(state.activeLabel));
            if (!point) return;
            const values: Record<string, number> = {};
            for (const s of series) {
              values[s.dataKey] = Number(point[s.dataKey] ?? 0);
            }
            onPointClick({ date: String(state.activeLabel), values });
          }}
        >
          <CartesianGrid stroke={GRID} strokeDasharray="4 6" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: TICK }}
            tickLine={false}
            axisLine={false}
            minTickGap={36}
            tickFormatter={formatAxisDate}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: TICK }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(value: number) =>
              value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value)
            }
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(label) => formatTooltipDate(String(label))}
            formatter={(value, name) => [Number(value).toLocaleString(), name]}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
          />
          {markers.map((marker) => (
            <ReferenceLine
              key={`${marker.x}-${marker.label}`}
              x={marker.x}
              stroke={marker.color ?? "#F79009"}
              strokeDasharray="4 4"
              label={{
                value: marker.label,
                fontSize: 9,
                fill: "#667085",
                position: "insideTopLeft",
              }}
            />
          ))}
          {series.map((s, index) => {
            const dimmed = highlightedKey != null && highlightedKey !== s.dataKey;
            return (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                strokeWidth={
                  highlightedKey === s.dataKey
                    ? Math.max(s.strokeWidth ?? 3, 3.5)
                    : dimmed
                      ? 1.5
                      : s.strokeWidth ?? (index === 0 ? 3 : 2)
                }
                strokeOpacity={dimmed ? 0.25 : 1}
                strokeDasharray={s.dashed ? "6 4" : undefined}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff", cursor: "pointer" }}
                isAnimationActive
                animationDuration={650}
                connectNulls
              />
            );
          })}
          {useBrush ? (
            <Brush
              dataKey={xKey}
              height={28}
              stroke="#D0D5DD"
              fill="#F9FAFB"
              travellerWidth={10}
              tickFormatter={formatAxisDate}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Rounded vertical bar chart for daily volume. */
export function RepVolumeBarChart({
  data,
  xKey = "date",
  yKey = "reviews",
  height = 260,
  color = REP_GREEN,
  emptyColor = "#D0D5DD",
}: {
  data: Array<Record<string, string | number>>;
  xKey?: string;
  yKey?: string;
  height?: number;
  color?: string;
  emptyColor?: string;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid stroke={GRID} strokeDasharray="4 6" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: TICK }}
            tickLine={false}
            axisLine={false}
            minTickGap={14}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: TICK }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(19,119,82,0.06)" }} />
          <Bar dataKey={yKey} name="Reviews" radius={[7, 7, 2, 2]} maxBarSize={28}>
            {data.map((point, idx) => {
              const value = Number(point[yKey] ?? 0);
              return <Cell key={`${String(point[xKey])}-${idx}`} fill={value > 0 ? color : emptyColor} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal rounded gap bars (competitor intelligence). */
export function RepHorizontalGapChart({
  rows,
  height = 260,
  youColor = REP_GREEN,
  otherColor = "#B2DDFF",
}: {
  rows: Array<{ id?: string; name: string; value: number; isYou?: boolean }>;
  height?: number;
  youColor?: string;
  otherColor?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3" style={{ minHeight: height }}>
      {rows.map((row) => (
        <div key={row.id ?? row.name}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className={`truncate text-sm ${row.isYou ? "font-semibold text-[#101828]" : "text-[#344054]"}`}>
              {row.name}
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-[#101828]">
              {row.value.toLocaleString()}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#F2F4F7]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(4, (row.value / max) * 100)}%`,
                backgroundColor: row.isYou ? youColor : otherColor,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
