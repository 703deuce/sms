'use client'

import { useState } from 'react'
import { SimpleSelect } from '@/components/app/filters'

export function RangeSelect() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d')
  return (
    <SimpleSelect
      label="Date range"
      value={range}
      onChange={setRange}
      options={[
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
        { value: '90d', label: 'Last 90 days' },
      ]}
      className="w-40"
    />
  )
}
