'use client'

import { useEffect, useMemo, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'

type Member = { id: string; name: string; email: string }

export function CommentMentionTextarea({
  value,
  onChange,
  onMentionIds,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onMentionIds?: (ids: string[]) => void
  placeholder?: string
  className?: string
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)

  useEffect(() => {
    void clipsFetch<{ members: Member[] }>('/api/clips/workspace-members')
      .then((r) => setMembers(r.members))
      .catch(() => setMembers([]))
  }, [])

  const mentionQuery = useMemo(() => {
    const m = value.match(/@([\w.-]*)$/)
    return m ? m[1].toLowerCase() : null
  }, [value])

  const filtered = useMemo(() => {
    if (mentionQuery == null) return []
    return members
      .filter((m) => m.name.toLowerCase().includes(mentionQuery) || m.email.toLowerCase().includes(mentionQuery))
      .slice(0, 8)
  }, [members, mentionQuery])

  useEffect(() => {
    setMentionOpen(mentionQuery != null && filtered.length > 0)
  }, [mentionQuery, filtered.length])

  useEffect(() => {
    if (!onMentionIds) return
    const ids: string[] = []
    for (const m of members) {
      if (value.includes(`@${m.name}`) || value.includes(`@${m.email}`)) ids.push(m.id)
    }
    onMentionIds(ids)
  }, [value, members, onMentionIds])

  const insertMention = (m: Member) => {
    const base = value.replace(/@[\w.-]*$/, '')
    onChange(`${base}@${m.name} `)
    setMentionOpen(false)
  }

  return (
    <div className="relative">
      <textarea
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {mentionOpen && (
        <ul className="absolute bottom-full left-0 z-20 mb-1 max-h-48 w-60 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-accent"
                onClick={() => insertMention(m)}
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 truncate">
                  <span className="font-medium">{m.name}</span>
                  <span className="ml-1 text-xs text-muted-foreground">{m.email}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
