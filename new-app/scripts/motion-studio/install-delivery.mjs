// Install the tracked overlay into an existing complete producer kit.
import {copyFile,mkdir,readFile,rename,stat} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const kit=process.argv[2]
if (!kit || !path.isAbsolute(kit)) throw new Error('Pass the absolute installed kit directory')
await stat(path.join(kit,'producer/lib/store-client.mjs'))
const overlay=fileURLToPath(new URL('../../../producer_handoff_kit/build/ms_producer_editable/',import.meta.url))
for (const rel of ['producer/lib/frame-packs.mjs','producer/lib/bundle.mjs','producer/lib/engines/browser.mjs','sim/transovo-sim.mjs']) {
  const src=path.join(overlay,rel), dest=path.join(kit,rel)
  const desired=await readFile(src)
  let previous
  try { previous=await readFile(dest) } catch(e) { if(e.code!=='ENOENT') throw e }
  if (previous?.equals(desired)) continue
  await mkdir(path.dirname(dest),{recursive:true})
  if (previous) {
    const hash=createHash('sha256').update(previous).digest('hex').slice(0,16)
    await copyFile(dest,dest+'.before-'+hash)
  }
  const staged=dest+'.'+randomUUID()+'.tmp'
  await copyFile(src,staged)
  await rename(staged,dest)
}
console.log('Editable delivery modules installed in '+kit)
