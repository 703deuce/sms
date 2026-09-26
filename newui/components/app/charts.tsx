'use client'

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

type Row = Record<string, string | number>

export function TrendArea({
  data,
  series,
  xKey = 'day',
  height = 220,
}: {
  data: Row[]
  series: { key: string; label: string; color: string }[]
  xKey?: string
  height?: number
}) {
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`var(--color-${s.key})`} stopOpacity={0.25} />
              <stop offset="100%" stopColor={`var(--color-${s.key})`} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        {series.map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            fill={`url(#fill-${s.key})`}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}

export function MiniBars({
  data,
  dataKey,
  label,
  color = 'var(--chart-1)',
  height = 140,
}: {
  data: Row[]
  dataKey: string
  label: string
  color?: string
  height?: number
}) {
  const config = { [dataKey]: { label, color } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ left: 0, right: 0, top: 4 }}>
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={6} fontSize={11} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
