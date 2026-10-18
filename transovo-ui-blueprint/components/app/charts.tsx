'use client'

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

type Row = Record<string, string | number>

export function TrendChart({ data, xKey, config, stacked = false }: { data: Row[]; xKey: string; config: ChartConfig; stacked?: boolean }) {
  const keys = Object.keys(config)
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((k) => (
          <Area
            key={k}
            dataKey={k}
            type="monotone"
            stackId={stacked ? 'a' : undefined}
            stroke={`var(--color-${k})`}
            fill={`var(--color-${k})`}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}

export function BarsChart({ data, xKey, config, horizontal = false }: { data: Row[]; xKey: string; config: ChartConfig; horizontal?: boolean }) {
  const keys = Object.keys(config)
  if (horizontal) {
    return (
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: data.length * 40 + 16 }}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
          <XAxis type="number" hide />
          <YAxis dataKey={xKey} type="category" tickLine={false} axisLine={false} width={140} />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          {keys.map((k) => (
            <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={4} barSize={18} />
          ))}
        </BarChart>
      </ChartContainer>
    )
  }
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {keys.map((k) => (
          <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

export function Funnel({ stages }: { stages: { stage: string; value: number; note: string }[] }) {
  const max = stages[0]?.value ?? 1
  return (
    <ol className="flex flex-col gap-3">
      {stages.map((s, i) => {
        const prev = i === 0 ? null : stages[i - 1].value
        return (
          <li key={s.stage} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 sm:grid-cols-[12rem_1fr_6rem]">
            <span className="flex flex-col">
              <span className="text-sm font-medium">{s.stage}</span>
              <span className="truncate text-xs text-muted-foreground">{s.note}</span>
            </span>
            <span className="h-7 overflow-hidden rounded-md bg-muted">
              <span className="block h-full rounded-md bg-primary" style={{ width: `${(s.value / max) * 100}%`, opacity: 1 - i * 0.11 }} />
            </span>
            <span className="flex flex-col items-end">
              <span className="text-sm font-semibold tabular">{s.value}</span>
              {prev !== null && <span className="text-[11px] text-muted-foreground tabular">{Math.round((s.value / prev) * 100)}% of prev</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
