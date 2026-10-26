'use client'

import { useState } from 'react'

type MenuAction = { label: string; action: () => void; disabled?: boolean }

export function FdMenuBar({ menus }: { menus: Record<string, MenuAction[]> }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <nav className="sw-fd-menubar relative flex flex-wrap gap-0 border-b px-1 py-0 text-xs">
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className="relative">
          <button
            type="button"
            className={`px-2 py-1 hover:bg-muted ${open === name ? 'bg-muted' : ''}`}
            onClick={() => setOpen(open === name ? null : name)}
            onBlur={() => setTimeout(() => setOpen((o) => (o === name ? null : o)), 150)}
          >
            {name}
          </button>
          {open === name ? (
            <ul className="absolute left-0 top-full z-50 min-w-[180px] rounded border bg-popover py-1 shadow-md">
              {items.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    disabled={item.disabled}
                    className="block w-full px-3 py-1 text-left hover:bg-muted disabled:opacity-40"
                    onClick={() => {
                      item.action()
                      setOpen(null)
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </nav>
  )
}
