'use client'

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

type Row = Record<string, string | number>

export function TrendArea({
  data,
  config,
  keys,
  height = 240,
}: {
  data: Row[]
  config: ChartConfig
  keys: string[]
  height?: number
}) {
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <defs>
          {keys.map((k) => (
            <linearGradient key={k} id={`fill-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`var(--color-${k})`} stopOpacity={0.28} />
              <stop offset="100%" stopColor={`var(--color-${k})`} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        {keys.map((k) => (
          <Area
            key={k}
            dataKey={k}
            type="monotone"
            stroke={`var(--color-${k})`}
            strokeWidth={2}
            fill={`url(#fill-${k})`}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}

export function TrendBars({
  data,
  config,
  dataKey,
  height = 180,
}: {
  data: Row[]
  config: ChartConfig
  dataKey: string
  height?: number
}) {
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart data={data} margin={{ left: -24, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <YAxis tickLine={false} axisLine={false} width={36} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
        <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
