// generates schemas/*.schema.json (JSON Schema 2020-12). Source of truth for the contract shapes.
import fs from 'node:fs';
const ID = 'https://transovo.example/schemas/';
const S = {};
const assetId = { type: 'string', pattern: '^ast_[a-f0-9]{32}$' }, fontId = { type: 'string', pattern: '^fnt_[a-f0-9]{32}(\\.[0-9]+)?$' }, bundleId = { type: 'string', pattern: '^bnd_[a-f0-9]{32}$' };
const anyAsset = { type: 'string', pattern: '^(ast|fnt|bnd)_[a-f0-9]{32}(\\.[0-9]+)?$' };
const hex = { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' }, sha = { type: 'string', pattern: '^[a-f0-9]{64}$' }, iso = { type: 'string', format: 'date-time' };
const fontSel = { type: 'object', required: ['faces'], additionalProperties: false, properties: { faces: { type: 'array', minItems: 1, items: fontId }, weight: { type: 'number', minimum: 1, maximum: 1000 }, style: { enum: ['normal', 'italic'] }, label: { type: 'string' } } };
const sceneId = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' };
S['common'] = { $defs: { assetId, fontId, bundleId, anyAsset, hex, sha, iso, fontSel, sceneId } };
const R = n => ({ $ref: 'common.schema.json#/$defs/' + n });
S['theme'] = { title: 'Project theme (transovo.motion-theme/1)', type: 'object', required: ['schema', 'colors', 'fonts'], properties: {
  schema: { const: 'transovo.motion-theme/1' }, themeId: { type: 'string' }, origin: { type: 'object' },
  colors: { type: 'object', minProperties: 1, additionalProperties: { oneOf: [R('hex'), { type: 'object', required: ['value'], properties: { value: R('hex'), label: { type: 'string' }, designName: { type: 'string' } } }] } },
  fonts: { type: 'object', additionalProperties: R('fontSel') },
  brand: { type: 'object', properties: { logo: { oneOf: [{ type: 'null' }, { type: 'object', required: ['asset'], properties: { asset: R('assetId') } }] } } } } };
const prop = { type: 'object', required: ['tier', 'type'], properties: {
  tier: { enum: ['live_editable', 'render_editable', 'ai_editable'] }, type: { enum: ['text', 'number', 'color', 'enum', 'boolean', 'point', 'font', 'image'] },
  bind: { type: 'string', pattern: '^(colors|fonts|derived)\\.[A-Za-z0-9]+$' }, fallbackBind: { type: 'string' }, default: {}, min: { type: 'number' }, max: { type: 'number' }, enum: { type: 'array' },
  maxChars: { type: 'integer' }, maxLines: { type: 'integer' }, maxCharsPerLine: { type: 'integer' }, transform: { enum: ['uppercase', 'none'] }, overflow: { enum: ['auto_fit', 'reject'] }, spokenInNarration: { type: 'boolean' },
  formats: { type: 'array', items: { type: 'string' } }, minWidth: { type: 'integer' }, minHeight: { type: 'integer' }, aspect: { type: 'number' }, worker: { type: 'string' }, why: { type: 'string' } } };
S['editable-elements'] = { title: 'Per-scene editable-elements manifest (transovo.editable-elements/1). Describes THIS custom scene; not a template.', type: 'object',
  required: ['schema', 'sceneId', 'format', 'engines', 'entry', 'livePreview', 'elements', 'protected'], properties: {
  schema: { const: 'transovo.editable-elements/1' }, sceneId: R('sceneId'), sceneRevision: { type: 'integer' }, origin: { type: 'object' },
  format: { type: 'object', required: ['width', 'height', 'fps', 'frames'], properties: { width: { type: 'integer' }, height: { type: 'integer' }, fps: { type: 'number' }, frames: { type: 'integer' }, holdFrame: { type: 'integer' } } },
  engines: { type: 'array', minItems: 1, items: { type: 'object', required: ['engine'], properties: { engine: { enum: ['three.js', 'gsap', 'pixi.js', 'dom', 'svg', 'canvas2d', 'ms-props', 'skia-python', 'pil', 'opencv', 'ffmpeg', 'canvaskit', 'd3'] }, version: { type: 'string' }, role: { type: 'string' } } } },
  fontEngine: { enum: ['browser', 'skia-python', 'pil', 'ffmpeg-drawtext', 'canvaskit'] },
  entry: { type: 'object', properties: { html: { type: 'string' }, python: { type: 'string' }, api: { type: 'string' } } },
  livePreview: { type: 'object', required: ['capability'], properties: { capability: { enum: ['live', 'live_degraded', 'render_only'] }, requirements: { type: 'object' }, fallback: { type: 'object', required: ['mode'], properties: { mode: { enum: ['poster_then_render', 'still_then_render', 'rendered_clip'] } } } } },
  colorTokensUsed: { type: 'array', items: { type: 'string' } }, fontTokensUsed: { type: 'array', items: { type: 'string' } },
  derivedTokens: { type: 'object', additionalProperties: { type: 'object', required: ['from', 'designFrom', 'designValue', 'method'], properties: { from: { type: 'string' }, designFrom: R('hex'), designValue: R('hex'), method: { const: 'oklch-delta' } } } },
  contrast: { type: 'array', items: { type: 'object', required: ['element', 'fg', 'bg', 'min'] } },
  elements: { type: 'array', items: { type: 'object', required: ['id', 'kind', 'properties'], properties: { id: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_]*$' }, kind: { enum: ['text', 'image', 'shape', 'group', 'video', 'color'] }, layer: { enum: ['dom', 'svg', 'webgl-texture', 'webgl-mesh', 'pixi', 'canvas2d', 'skia', 'opencv', 'ffmpeg'] }, timing: { type: 'object' }, layout: { type: 'object' }, properties: { type: 'object', additionalProperties: prop }, aiEditable: { type: 'array' } } } },
  renderSettings: { type: 'object', additionalProperties: { type: 'object', required: ['type', 'default'] } },
  protected: { type: 'array', items: { type: 'object', required: ['what'], properties: { what: { type: 'string' }, props: { type: 'array', items: { type: 'string' } } } } },
  aiEditable: { type: 'array' }, allowedOverlaps: { type: 'array' }, safeArea: { type: 'object' } } };
S['edit-patch'] = { title: 'Edit patch / overrides (transovo.edit-patch/1). null deletes an override.', type: 'object', additionalProperties: false, properties: {
  schema: { const: 'transovo.edit-patch/1' }, theme: { type: 'object' },
  scenes: { type: 'object', propertyNames: { pattern: '^[A-Za-z0-9_-]{1,64}$' }, additionalProperties: { type: 'object', additionalProperties: false, properties: { tokens: { type: 'object' }, elements: { type: 'object', additionalProperties: { type: ['object', 'null'] } }, render: { type: 'object' } } } } } };
S['scene-bundle'] = { title: 'Immutable scene bundle (transovo.scene-bundle/1); stored as a kind=bundle asset, id = bnd_<sha256(canonical json)>', type: 'object',
  required: ['schema', 'sceneId', 'revision', 'engine', 'files', 'capabilities', 'runtime', 'render'], properties: {
  schema: { const: 'transovo.scene-bundle/1' }, sceneId: R('sceneId'), revision: { type: 'integer', minimum: 1 }, parentBundle: { oneOf: [{ type: 'null' }, R('bundleId')] },
  engine: { enum: ['browser', 'python', 'clip'] }, entry: { type: ['string', 'null'] }, manifest: { type: ['string', 'null'] },
  files: { type: 'object', additionalProperties: { type: 'object', required: ['asset', 'sha256', 'bytes'], properties: { asset: R('assetId'), sha256: R('sha'), bytes: { type: 'integer' } } } },
  dependencies: { type: 'object', properties: { assets: { type: 'array', items: R('anyAsset') } } }, liveAssets: { type: 'array', items: R('anyAsset') },
  capabilities: { $ref: 'capabilities.schema.json' }, runtime: { type: 'object' }, render: { type: 'object', required: ['adapter'], properties: { adapter: { enum: ['browser-capture', 'python-frames', 'python-video', 'static-clip'] } } }, createdBy: { type: 'object' } } };
S['capabilities'] = { title: 'Capability declaration of a scene bundle or worker', type: 'object', required: ['livePreview', 'requires'], properties: {
  livePreview: { enum: ['live', 'live_degraded', 'render_only'] }, fallback: { type: 'object' }, editable: { type: 'boolean' }, themeAware: { type: 'boolean' },
  requires: { type: 'object', description: 'what a worker must have to render this bundle', properties: { chrome: { type: 'string' }, webgl: { type: 'string' }, python: { type: 'string' }, pythonPackages: { type: 'object' }, ffmpeg: { type: 'string' }, fontEngine: { type: 'string' }, node: { type: 'string' } } },
  deterministic: { type: 'object', properties: { level: { enum: ['bit_exact', 'visual', 'none'] }, note: { type: 'string' } } } } };
S['project-version'] = { title: 'Immutable project version (transovo.motion-project/1). Never edited in place; edits publish version+1.', type: 'object',
  required: ['schema', 'projectId', 'version', 'parentVersion', 'createdAt', 'createdBy', 'format', 'theme', 'overrides', 'scenes', 'master', 'assetRefs'], properties: {
  schema: { const: 'transovo.motion-project/1' }, projectId: { type: 'string', pattern: '^[A-Za-z0-9_-]+$' }, version: { type: 'integer', minimum: 1 }, parentVersion: { type: ['integer', 'null'] },
  title: { type: 'string' }, createdAt: R('iso'), createdBy: { type: 'object', required: ['mode'], properties: { mode: { enum: ['import', 'creative_production', 'deterministic_render'] }, workerId: { type: 'string' }, jobId: { type: 'string' } } },
  changes: { type: 'array' }, format: { type: 'object', required: ['width', 'height', 'fps'] }, theme: { $ref: 'theme.schema.json' }, overrides: { $ref: 'edit-patch.schema.json' },
  fontRecords: { type: 'array', items: { $ref: 'font-record.schema.json' } },
  scenes: { type: 'array', items: { type: 'object', required: ['sceneId', 'bundle', 'clip', 'timeline'], properties: { sceneId: R('sceneId'), bundle: R('bundleId'), editable: { type: 'boolean' }, themeAware: { type: 'boolean' }, timeline: { type: 'object' },
    clip: { type: 'object', required: ['asset', 'renderKey'], properties: { asset: R('assetId'), renderKey: { type: 'string' }, frames: { type: 'integer' }, renderedInVersion: { type: 'integer' } } }, preview: { type: ['object', 'null'] }, narrationRefs: { type: 'array' } } } },
  sources: { type: 'object', description: 'narration script, word timestamps, stems, captions, music, footage, cut-outs, graphics' },
  master: { type: 'object', required: ['recipe', 'asset'], properties: { recipe: R('assetId'), asset: R('assetId'), renderKey: { type: 'string' }, encode: { type: 'object' }, renderedInVersion: { type: 'integer' } } },
  runtimeLock: R('assetId'), validation: { type: 'object' }, assetRefs: { type: 'array', items: R('anyAsset') } } };
S['font-record'] = { title: 'Engine-native font record (transovo.font-record/1)', type: 'object', required: ['fontId', 'assetId', 'sha256', 'family', 'engines'], properties: {
  fontId: R('fontId'), assetId: R('fontId'), faceIndex: { type: 'integer' }, sha256: R('sha'), family: { type: ['string', 'null'] }, subfamily: { type: ['string', 'null'] }, fullName: { type: ['string', 'null'] }, postscriptName: { type: ['string', 'null'] }, version: { type: ['string', 'null'] },
  weightClass: { type: 'integer' }, italic: { type: 'boolean' }, axes: { type: 'array' }, coverage: { type: 'array', items: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer' } } },
  engines: { type: 'object', additionalProperties: { type: 'object', required: ['ok'] } } } };
S['font-catalog'] = { title: 'Per-engine font catalog (only fonts that engine really rendered)', type: 'object', required: ['schema', 'engine', 'fonts'], properties: { schema: { const: 'transovo.font-catalog/1' }, engine: { type: 'string' }, fonts: { type: 'array', items: { type: 'object', required: ['fontId', 'assetId', 'sha256'] } } } };
S['render-job'] = { title: 'Job input (transovo.motion-job/1) carried in job.input', type: 'object', required: ['schema', 'mode', 'projectId'], properties: {
  schema: { const: 'transovo.motion-job/1' }, mode: { enum: ['deterministic_render', 'creative_production'] }, projectId: { type: 'string' }, baseVersion: { type: 'integer' },
  edits: { $ref: 'edit-patch.schema.json' }, assetIds: { type: 'array', items: R('anyAsset') }, scenes: { type: 'array', items: R('sceneId'), description: 'optional restriction; dependency analysis decides what re-renders' },
  output: { type: 'object', properties: { master: { type: 'boolean', default: true }, previews: { type: 'boolean', default: true }, stillOnly: { type: 'object', description: 'preview job: validate + render one still per changed scene; nothing is published', properties: { t: { type: 'number', minimum: 0 }, frame: { type: 'integer', minimum: 0 } }, additionalProperties: false }, encode: { type: 'object', properties: { codec: { const: 'h264' }, level: { const: '4.2' }, crf: { type: 'number' } } } } },
  brief: { type: 'string', description: 'creative_production only; untrusted customer text' }, dryRun: { type: 'boolean' } } };
S['job-event'] = { title: 'Worker -> Transovo job event', type: 'object', required: ['type', 'at'], properties: {
  type: { enum: ['log', 'stage', 'artifact', 'warning', 'error', 'validation', 'usage', 'checkpoint'] }, at: R('iso'), stage: { type: 'string' }, message: { type: 'string', maxLength: 2000 },
  artifact: { type: 'object', properties: { assetId: R('anyAsset'), role: { type: 'string' }, sceneId: { type: 'string' }, sha256: R('sha') } }, issues: { type: 'array' }, data: { type: 'object' } } };
S['worker-registration'] = { title: 'Worker self-description (PUT /workers/{workerId})', type: 'object', required: ['schema', 'workerId', 'machineId', 'planId', 'capabilities', 'wakeup'], properties: {
  schema: { const: 'transovo.worker/1' }, workerId: { type: 'string' }, machineId: { type: 'string' }, planId: { type: 'string' }, account: { type: 'object', description: 'opaque account handle; several workers may share one account or machine' },
  modes: { type: 'array', items: { enum: ['deterministic_render', 'creative_production'] } }, capabilities: { type: 'object' }, wakeup: { type: 'object', required: ['type'], properties: { type: { const: 'webhook_routine' }, routineId: { type: 'string' } } }, softwareVersion: { type: 'string' },
  machine: { type: 'object', description: 'rendering capacity of the machine this worker runs on (shared by every worker on it)', required: ['cpus', 'memTotalMb'], properties: { cpus: { type: 'integer' }, cpuModel: { type: 'string' }, memTotalMb: { type: 'integer' }, gpu: { type: 'string' }, renderSlots: { type: 'integer', description: 'concurrent heavy renders this worker can take on this machine (Transovo enforces machine-wide limits across workers)' } } },
  activeJob: { type: ['object', 'null'], description: 'job currently running on this worker, if any' } } };
const planUsage = { type: 'object', description: 'Grok plan usage observed by the waking routine (the worker process cannot read it). Shared by every worker on the same plan.', required: ['available'], properties: {
  available: { type: 'boolean' }, usedPercent: { type: 'number', minimum: 0, maximum: 100 }, window: { enum: ['weekly', 'daily', 'monthly', 'unknown'] }, observedAt: iso, resetsAt: { oneOf: [iso, { type: 'null' }] },
  source: { type: 'string', description: 'e.g. CheckSubscriptionUsage' }, planId: { type: 'string' }, ageSec: { type: 'number', description: 'observation age when the worker attached it' }, stale: { type: 'boolean', description: 'true when older than 15 min at attach time' }, note: { type: 'string' } } };
const snap = { type: 'object', required: ['at'], properties: { at: iso, cpu: { type: ['object', 'null'] }, maxRssKb: { type: 'number' }, loadavg: { type: 'array' }, memFreeMb: { type: 'number' }, diskFreeMb: { type: ['number', 'null'] }, cacheMb: { type: 'number' }, aiCallsTotal: { type: 'integer' }, planUsage } };
S['usage-report'] = { title: 'Usage report around one job (POST /workers/{workerId}/usage)', type: 'object', required: ['schema', 'workerId', 'machineId', 'planId', 'jobId', 'mode', 'before', 'after', 'renderDurationMs', 'status'], properties: {
  schema: { const: 'transovo.usage/1' }, workerId: { type: 'string' }, machineId: { type: 'string' }, planId: { type: 'string' }, jobId: { type: 'string' }, mode: { type: 'string' },
  projectId: { type: 'string' }, startedAt: iso, finishedAt: iso, before: snap, after: snap,
  planUsageDelta: { type: ['object', 'null'], description: 'after.usedPercent - before.usedPercent when both observations exist and no reset happened between them', properties: { percent: { type: 'number' }, resetBetween: { type: 'boolean' } } },
  renderDurationMs: { type: 'integer' }, wallMs: { type: 'integer' }, aiCalls: { type: 'integer' }, status: { enum: ['completed', 'failed', 'rejected'] },
  failures: { type: 'array', items: { type: 'object', required: ['stage'], properties: { stage: { type: 'string' }, message: { type: 'string' }, issues: { type: 'array' } } } } } };
S['assembly-recipe'] = { title: 'Declarative master assembly recipe (transovo.assembly/1). No shell; the worker compiles it to ffmpeg args.', type: 'object', required: ['schema', 'format', 'segments', 'audio', 'encode'], properties: {
  schema: { const: 'transovo.assembly/1' }, format: { type: 'object' },
  segments: { type: 'array', items: { type: 'object', required: ['id', 'source'], properties: { id: { type: 'string' }, source: { type: 'object', description: '{scene: S01} or {asset: ast_...}' }, frames: { type: 'integer' }, filters: { type: 'array' }, padFrames: { type: 'integer' }, grade: { type: 'string' }, xfadeOutSec: { type: 'number' } } } },
  overlays: { type: 'array' }, audio: { type: 'object' }, post: { type: 'array' }, encode: { type: 'object' }, themeBindings: { type: 'object' } } };
fs.mkdirSync('schemas', { recursive: true });
for (const [k, v] of Object.entries(S)) fs.writeFileSync(`schemas/${k}.schema.json`, JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: ID + k + '.schema.json', ...v }, null, 1) + '\n');
console.log(Object.keys(S).length, 'schemas');
