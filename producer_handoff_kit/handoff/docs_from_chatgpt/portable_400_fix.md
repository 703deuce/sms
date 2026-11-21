# Fix: Motion Studio live jobs fail at the final publish step (HTTP 400)

Repo: 703deuce/sms (master, currently at ef765a3)

## What happens
A live Motion Studio job renders fine on Modal (app `transovo-motion-render`), passes QA and uploads the master MP4. Then Modal's `publish_editable` step POSTs the native producer document to
`POST /api/motion-studio/agent/jobs/<jobId>/portable`
and the server answers **400 INVALID: "Producer project bridge: invalid producer document envelope"**. The job is marked failed, never completes, and the video never shows in the app.
Seen on job msaj_7eede2b4-beaf-497b-ad14-7ec5c7d4bfc5 (Nov 19, 11:35 PM ET) and very likely on msaj_8eb586dd (8:16 PM ET).

## Root cause
- For render-first live delivery, the producer's builder (`publish-live.mjs`) intentionally writes
  `master: { recipe, renderedInVersion: 0, origin: "live_delivery" }` with **no `asset`**, because no MP4 exists when the editable package is built (the MP4 is approved separately via approveMaster).
- `new-app/lib/motion-studio/producer-project-adapter.ts`, `validateNativeProducerEnvelope()` (around line 53), requires `master.asset` whenever a `master` block exists, so it rejects the document.
- It only fails on the Modal path: the old on-box delivery posted a pre-built `manifest`, which skips this check. Modal posts the raw `document`, which goes through it.
- Verified locally: with the change below, the real GTA payload passes all of the server's checks (44 assets, timeline and asset refs all valid).

## The fix belongs in the server (app), not the Modal publisher.

### 1. `new-app/lib/motion-studio/producer-project-adapter.ts`
Allow a master without an asset **only** when it has not been rendered yet (`renderedInVersion === 0`). A recipe stays required, and an asset is still required once a master has been rendered. Also make the "critical refs" check skip a missing asset.

### 2. `new-app/lib/server/motion-studio/http.ts`
Log the MotionStudioError message on 4xx responses (today it logs `detail: undefined`, which is why this 400 was invisible).

### 3. `worker/modal_motion/pipeline.py`
Include method, path and the server's `error` text (URLs stripped) in the "Job API failed" exception, so a Modal qa_fail says which check refused. Make sure `import re` exists at the top of the file.

### 4. Tests: `new-app/tests/motion-studio/motion-studio-producer-project-adapter.test.ts`
Add two cases: an unrendered live master is accepted, and a rendered master without an asset is still rejected.

### Also check
If the `NativeProducerDocument` TypeScript type declares `master.asset` as a required string, make it optional and null-guard any code that reads it. Then run the new-app typecheck plus the adapter vitest file, and `python -m py_compile worker/modal_motion/pipeline.py`.

### Deploy note
Pushing to master auto-redeploys the web app in Coolify (about 6 min). Check server disk first (prune old unused images above 90%). The `pipeline.py` change only takes effect after the Modal app `transovo-motion-render` is redeployed; the server fix alone is enough to stop the 400.

## Exact patch (applies cleanly to ef765a3 with `git apply`)
```diff
diff --git a/new-app/lib/motion-studio/producer-project-adapter.ts b/new-app/lib/motion-studio/producer-project-adapter.ts
index 58e964d..c2262a1 100644
--- a/new-app/lib/motion-studio/producer-project-adapter.ts
+++ b/new-app/lib/motion-studio/producer-project-adapter.ts
@@ -50,7 +50,11 @@ export function validateNativeProducerEnvelope(value:unknown):NativeProducerDocu
        (Number.isSafeInteger(value.parentVersion)&&Number(value.parentVersion)>=1&&Number(value.parentVersion)<Number(value.version)))||
      !object(value.format)||!Array.isArray(value.scenes)||value.scenes.length<1||
      value.scenes.length>1000||!object(value.theme)||!object(value.overrides)||
-     (value.master!=null&&(!object(value.master)||!id(value.master.asset)||!id(value.master.recipe)))||
+     // Render-first live delivery (publish-live.mjs) ships the export recipe before
+     // any master exists: master.renderedInVersion===0 with no asset. The MP4 is
+     // approved separately (approveMaster), so only an unrendered master may omit it.
+     (value.master!=null&&(!object(value.master)||!id(value.master.recipe)||
+       !(id(value.master.asset)||(value.master.asset==null&&value.master.renderedInVersion===0))))||
      !Array.isArray(value.assetRefs)||value.assetRefs.length>10000||
      value.assetRefs.some(v=>!id(v)))
     reject('invalid producer document envelope')
@@ -77,7 +81,8 @@ export function adaptProducerProject(input:ProducerImport):MsPortableManifest{
   }
   // Do not lose the native project's stems/assembly/font/source references.
   for(const ref of native.assetRefs)if(!assetMap.has(ref))reject('native asset missing: '+ref)
-  const critical=native.master?[native.master.asset,native.master.recipe]:[]
+  const critical=native.master?[native.master.recipe,
+    ...(native.master.asset!=null?[native.master.asset]:[])]:[]
   for(const ref of critical)if(!id(ref)||!assetMap.has(ref))reject('master asset missing: '+ref)
   const bundleMap=new Map<string,ProducerSceneBundle>()
   for(const b of input.bundles){
diff --git a/new-app/lib/server/motion-studio/http.ts b/new-app/lib/server/motion-studio/http.ts
index 2d5bba1..17bb95c 100644
--- a/new-app/lib/server/motion-studio/http.ts
+++ b/new-app/lib/server/motion-studio/http.ts
@@ -19,7 +19,8 @@ export function motionStudioJsonError(err: unknown) {
   const error = err instanceof MotionStudioError ? err : new MotionStudioError('INTERNAL', 'Motion Studio could not complete the request.', 500)
   console.error('[motion-studio:api] request_failed', {
     code: error.code, status: error.status, type: err instanceof Error ? err.name : typeof err,
-    detail: err instanceof MotionStudioError ? undefined : err instanceof Error ? err.message.slice(0, 200) : undefined,
+    // MotionStudioError messages are server-authored validation text; log them so a 400 is diagnosable.
+    detail: err instanceof Error ? err.message.slice(0, 200) : undefined,
   })
   return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
 }
diff --git a/new-app/tests/motion-studio/motion-studio-producer-project-adapter.test.ts b/new-app/tests/motion-studio/motion-studio-producer-project-adapter.test.ts
index 94f450c..0977713 100644
--- a/new-app/tests/motion-studio/motion-studio-producer-project-adapter.test.ts
+++ b/new-app/tests/motion-studio/motion-studio-producer-project-adapter.test.ts
@@ -50,6 +50,18 @@ describe('native producer project -> editable portable project',()=>{
     expect((m as unknown as {producerAssetMap:Record<string,string>}).producerAssetMap.fnt_display).toBe('upload_5')
     expect((m as unknown as {producerDocument:ReturnType<typeof document>}).producerDocument.assetRefs).toContain('fnt_display')
   })
+  it('accepts a render-first live document whose master is not rendered yet',()=>{
+    const live={...document(),delivery:{mode:'live'},
+      master:{recipe:'ast_recipe',renderedInVersion:0,origin:'live_delivery'}}
+    const m=adaptProducerProject({document:live,assets,bundles})
+    expect((m as unknown as {producerDocument:unknown}).producerDocument).toEqual(live)
+  })
+  it('still requires a master asset once a master has been rendered',()=>{
+    expect(()=>validateNativeProducerEnvelope({...document(),
+      master:{recipe:'ast_recipe',renderedInVersion:1}})).toThrow(/envelope/)
+    expect(()=>validateNativeProducerEnvelope({...document(),
+      master:{asset:'ast_master'}})).toThrow(/envelope/)
+  })
   it('refuses missing referenced media rather than silently omitting',()=>{
     expect(()=>adaptProducerProject({document:document(),assets:assets.slice(1),bundles})).toThrow()
   })
diff --git a/worker/modal_motion/pipeline.py b/worker/modal_motion/pipeline.py
index 8ca3d0e..6e21ea3 100644
--- a/worker/modal_motion/pipeline.py
+++ b/worker/modal_motion/pipeline.py
@@ -33,7 +33,13 @@ def api(job_id,method,path="",payload=None,params=None,timeout=120,attempts=8):
         if r.status_code in (429,500,502,503,504) and attempt<attempts:
             time.sleep(min(60,2**attempt)+random.uniform(0,3)); continue
         if not r.ok:
-            raise RuntimeError("Job API failed: "+str(r.status_code))
+            # Keep the server's own validation message (never the URL or token) so a
+            # qa_fail reason says WHICH check refused, e.g. "POST /portable 400: ...".
+            try: detail=str((r.json() or {}).get("error") or "")
+            except Exception: detail=""
+            detail=re.sub(r"https?://\S+","[url]",detail)[:300]
+            raise RuntimeError("Job API failed: "+str(r.status_code)+
+                (" "+method+" "+(path or "/")+(": "+detail if detail else "")))
         return r.json()
 
 def heartbeat(job_id,stop):
```
