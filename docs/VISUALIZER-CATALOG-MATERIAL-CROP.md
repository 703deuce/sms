# Visualizer catalog material crop

Outdoor / slab product photos often include concrete, margins, and manufacturer stickers. KIE generation uses these JPGs as **Image 2**; backdrop gray can bias panel color (e.g. toward concrete).

## Layout

| Path | Role |
|------|------|
| `public/visualizer/materials/<line>/<slug>.jpg` | **Active** reference sent to generation (cropped) |
| `public/visualizer/materials/<line>/source/<slug>.jpg` | **Original** full photo (first-run backup only) |

`readCatalogMaterialBytes()` reads the active `<slug>.jpg` — no code change required after crop.

## Commands

```bash
# Preview bounding boxes
npx tsx scripts/crop-visualizer-catalog-materials.ts --dry-run

# Write crops + create source/ backups
npx tsx scripts/crop-visualizer-catalog-materials.ts --apply

# Single SKU
npx tsx scripts/crop-visualizer-catalog-materials.ts --apply --only tundra-grey

npx tsx scripts/test-visualizer-catalog-material-crop.ts
```

Detection lives in `src/lib/visualizer/catalog-material-crop.ts` (corner concrete sample + column/row backdrop scan).

To restore one material from backup:

```bash
cp public/visualizer/materials/sam-mueller-pioneer-plus/source/tundra-grey.jpg \
   public/visualizer/materials/sam-mueller-pioneer-plus/tundra-grey.jpg
```
