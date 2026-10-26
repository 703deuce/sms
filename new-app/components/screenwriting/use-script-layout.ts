'use client'

import { useMemo } from 'react'
import type { JSONContent } from '@tiptap/core'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import { layoutElementsFromPmJson, paginateFromElements } from '@/lib/screenwriting/layout'

export function useScriptLayout(pmJson: JSONContent | null | undefined) {
  return useMemo(() => {
    if (!pmJson) return null
    const elements = layoutElementsFromPmJson(pmJson)
    return paginateFromElements(elements, {
      spec: FEATURE_FORMAT_SPEC,
      bodyLinesPerPage: FEATURE_FORMAT_SPEC.page.bodyLines,
      firstPageUnnumbered: true,
    })
  }, [pmJson])
}
