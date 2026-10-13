#!/usr/bin/env node
/**
 * Static guard: Opus sidebar must not render all submenu trees at once.
 */
import fs from 'node:fs'

const sidebar = fs.readFileSync('src/newui-transplant/components/app/app-sidebar.tsx', 'utf8')
const failures = []

if (sidebar.includes('showChildren = hasChildren')) {
  failures.push('AppSidebar must not use showChildren = hasChildren (always-open submenus)')
}
if (!sidebar.includes('expandedKey === expandKey')) {
  failures.push('AppSidebar must gate submenus on expandedKey')
}
if (!sidebar.includes('expandedNavKeyForRoute')) {
  failures.push('AppSidebar must derive expanded group from findBestNavMatch')
}
if (!sidebar.includes('prevRouteSyncKey')) {
  failures.push('AppSidebar must only auto-expand on route change (not inbox badge polls)')
}

const kimi = fs.readFileSync('src/components/kimi/sidebar/TransovoSidebar.tsx', 'utf8')
if (kimi.includes('?? (active || childActive)')) {
  failures.push('TransovoSidebar must not default-expand every active parent')
}

if (failures.length) {
  console.error('verify-opus-sidebar-submenu-collapse FAIL')
  for (const f of failures) console.error(' -', f)
  process.exit(1)
}
console.log('verify-opus-sidebar-submenu-collapse PASS')
