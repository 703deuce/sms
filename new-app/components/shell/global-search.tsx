'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="w-9 justify-start gap-2 px-0 text-muted-foreground sm:w-44 sm:px-2.5 md:w-56 max-sm:justify-center"
          >
            <Search />
            <span className="hidden sm:inline">Search projects</span>
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[min(92vw,26rem)] p-0">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clip projects"
            aria-label="Search clip projects"
          />
        </div>
        <div className="p-4 text-center text-sm text-muted-foreground">
          {q.trim() ? 'Project search ships with the clips API.' : 'Type a project title to search.'}
        </div>
      </PopoverContent>
    </Popover>
  )
}
