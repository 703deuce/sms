# contract/

`manifest.mjs` loads Transovo's own validators from `contract/master-<commit>/` (a read-only copy of
`new-app/lib/motion-studio/{portable-contract,scene-graph,producer-project-adapter,universal-timeline}.ts`).
The copies are not committed here because they are this repo's own files. Recreate them on the producer box:

```bash
C=contract/master-$(git -C <sms clone> rev-parse --short=8 origin/master); mkdir -p $C
for f in portable-contract universal-timeline scene-graph producer-project-adapter; do
  git -C <sms clone> show origin/master:new-app/lib/motion-studio/$f.ts > $C/$f.ts; done
```
Then point `BG_DELIVERY_CONTRACT_DIR` at it (default: `contract/master-83a83d5c`).
