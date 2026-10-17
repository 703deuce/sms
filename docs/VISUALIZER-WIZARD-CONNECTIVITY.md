# Bathroom Visualizer — new design wizard connectivity

This document maps **each wizard step** to the **UI state**, **API routes**, **database rows**, and **async jobs** so we can debug “clicked Continue / Save / Generate and nothing stuck” reports.

## Routes and shells

| Surface | Route | Component |
|---------|-------|-----------|
| Wizard | `/visualizer/new` | `visualizer-new-design-page.tsx` |
| Overview | `/visualizer` | `visualizer-overview-page.tsx` |
| Design result | `/visualizer/projects/:projectId/design/:designId` | `visualizer-design-page.tsx` |
| Materials | `/visualizer/materials/new` | `visualizer-material-form-page.tsx` |

All authenticated Visualizer pages use `VisualizerOpusShell` → `ArOpusPage` (Opus / newui-transplant). No Kimi UI.

## Wizard steps (4)

```
Photo → Scope → Materials → Generate
```

### Step 0 — Photo

| Action | API | Persistence |
|--------|-----|-------------|
| Create project (first upload) | `POST /api/visualizer/projects` | `visualizer_project` row |
| Upload room photo | `POST /api/visualizer/upload` (`assetType=ORIGINAL_ROOM`, `projectId`) | `visualizer_asset` + `visualizer_project.primary_room_asset_id` |
| Draft autosave | `PATCH /api/visualizer/projects/:id` | `wizard_draft_json`, `name`, `transformation` |

Client must have `projectId` + `roomAssetId` before Generate. Draft is restored from `?projectId=` on `/visualizer/new`.

### Step 1 — Scope

| State | Sent to server |
|-------|----------------|
| `transformation` | `POST /api/visualizer/generate` body |
| `showerWallHeight` (wet-area remodels) | same + `visualizer_generation_job.request_json` |

### Step 2 — Materials

| Source | API | IDs |
|--------|-----|-----|
| Built-in catalog | `GET /api/visualizer/materials` | `catalog:<slug>` (static JPGs under `/public/visualizer/materials/<line-folder>/`). Each row includes `panelLine` (**BCI** = Long Baths; **PIONEER_PLUS** = Samuel Mueller Pioneer Plus stone-block). Optional filter: `?panelLine=BCI` or `?panelLine=PIONEER_PLUS`. |
| Workspace uploads | `POST /api/visualizer/materials` | UUID rows in `visualizer_material` |

Generation resolves materials in `loadMaterialReferenceImage()` (catalog vs workspace).

### Step 3 — Generate

| Action | API | What happens next |
|--------|-----|-------------------|
| Start generation | `POST /api/visualizer/generate` | Creates `visualizer_design` + `visualizer_generation_job`, enqueues `visualizer_generation` job |
| Poll status | `GET /api/visualizer/jobs/:jobId` | Worker runs `executeVisualizerGenerationJob` → KIE (`provider-kie.ts`) |
| Complete | redirect | `/visualizer/projects/:projectId/design/:designId` |

**Worker dependency:** `visualizer_generation` jobs must be processed by the messaging/job worker (same queue as other `enqueueJob` types). If jobs stay `QUEUED`, check worker health and `DATABASE_URL` / Supabase storage / `KIE_API_KEY`.

## Materials “Save” button (separate from wizard)

| Step | API |
|------|-----|
| Upload reference image | `POST /api/visualizer/upload` (`assetType=MATERIAL_REFERENCE`) → `storagePath` |
| Save row | `POST /api/visualizer/materials` or `PATCH .../materials/:id` |

Requires **name** + **imageStoragePath**. Failures surface in the red alert; check browser console for `[visualizer:client]` logs.

## MCTB phone setup (often confused with this wizard)

If the issue is **business line / forwarding number not switching when you call**:

| UI | APIs |
|----|------|
| Setup → Phone & Forwarding | `POST /api/mctb/setup` (runtime `phone_number_id`, `businessLineE164`) + `POST /api/mctb/onboarding` (carrier, ring seconds, onboarding copy of business line) |

Changing the **active Transovo number** must **wire TeXML ingress** (`wireMctbWorkspaceIngressPhone`) — handled on setup save when `phoneNumberId` changes, and immediately when picking a number in the number drawer (`POST /api/mctb/numbers` `action: select`).

After changing the **public business line**, run **Save** then re-run **forwarding verification** (carrier CFNA must point at the current Transovo ingress).

## Quick production checks

1. Web deploy SHA: `GET /api/health` → `commitSha`
2. Overview crash: `GET /api/visualizer/overview` (must not 500)
3. Upload: `POST /api/visualizer/upload` (401 without session; 500 if Supabase bucket missing)
4. Stuck generation: `GET /api/visualizer/jobs/:id` status + worker logs
