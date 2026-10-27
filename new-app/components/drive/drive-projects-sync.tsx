'use client'

import { useEffect } from 'react'
import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import { useClipsDrive } from '@/components/drive/clips-drive-context'

export function DriveProjectsSync({ projects }: { projects: ClipProjectListItem[] }) {
  const { setActivityProjects } = useClipsDrive()
  useEffect(() => {
    setActivityProjects(projects)
  }, [projects, setActivityProjects])
  return null
}
