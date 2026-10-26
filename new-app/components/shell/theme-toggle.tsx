'use client'

import { useEffect, useState } from 'react'
import { Check, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <Button size="icon" variant="ghost" className="size-9" aria-hidden />

  const current = theme === 'system' ? resolvedTheme : theme

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon" variant="ghost" className="size-9" aria-label="Theme menu" aria-haspopup="menu" />
        }
      >
        {resolvedTheme === 'dark' ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" role="menu" aria-label="Theme">
        <DropdownMenuItem
          role="menuitemradio"
          aria-checked={current === 'light'}
          onClick={() => setTheme('light')}
        >
          <Sun className="size-4" aria-hidden />
          Light
          {current === 'light' ? <Check className="ml-auto size-4" aria-hidden /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          role="menuitemradio"
          aria-checked={current === 'dark'}
          onClick={() => setTheme('dark')}
        >
          <Moon className="size-4" aria-hidden />
          Dark
          {current === 'dark' ? <Check className="ml-auto size-4" aria-hidden /> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
