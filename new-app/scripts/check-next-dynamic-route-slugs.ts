/**
 * Fail if any App Router directory has sibling dynamic segments with different param names
 * (e.g. [id] and [projectId] under the same parent). Next.js crashes at boot.
 */
import fs from 'node:fs'
import path from 'node:path'

const APP_ROOT = path.join(process.cwd(), 'app')

function isDynamicDir(name: string): boolean {
  return name.startsWith('[') && name.endsWith(']')
}

function dynamicSlug(name: string): string {
  return name.slice(1, -1)
}

export function findDynamicSlugConflicts(root = APP_ROOT): string[] {
  const conflicts: string[] = []

  function walk(dir: string) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    const dynamicChildren = entries.filter((e) => e.isDirectory() && isDynamicDir(e.name))
    if (dynamicChildren.length > 1) {
      const slugs = [...new Set(dynamicChildren.map((e) => dynamicSlug(e.name)))]
      if (slugs.length > 1) {
        conflicts.push(
          `${dir.replace(root, 'app')}: sibling dynamic folders ${dynamicChildren.map((e) => e.name).join(', ')}`,
        )
      }
    }
    for (const e of entries) {
      if (e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) {
        walk(path.join(dir, e.name))
      }
    }
  }

  walk(root)
  return conflicts
}
