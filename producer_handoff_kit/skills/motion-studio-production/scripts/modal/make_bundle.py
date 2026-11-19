#!/usr/bin/env python3
"""make_bundle.py: build and validate render_bundle_v1.zip for the Modal film renderer.

One ZIP carries (a) the composed film page the renderer captures and (b) the editable package that Modal's
publish step uploads at the end. It mirrors worker/modal_motion/pipeline.py (extract_bundle + publish_editable).
No network, no Transovo calls, no secrets. Python stdlib only (node + Chrome only for --check-page).

  python3 make_bundle.py --job-dir J                      # J/film + J/editable/live -> J/deliver_modal/render_bundle_v1.zip
  python3 make_bundle.py --job-dir J --check-page         # also load the page headless and seek first/middle/last frame
  python3 make_bundle.py --film-dir F --no-editable --out /tmp/x.zip     # validation/smoke only (cannot publish editable)
  python3 make_bundle.py --validate-only /path/render_bundle_v1.zip

Film dir (J/film) must hold the composed page and everything it loads (fonts, footage, images, mixed audio):
  film.json   {"title","width","height","fps","frameCount"}   (falls back to an existing project.json with those keys)
  index.html  (or --entry) exposing window.__scene.seek(t) and window.__ready (see bundle contract in README.md)
  audio.wav   (or --audio) the final mixed audio, exactly the film's length
Editable package: J/editable/live/payload/live.packed.json (preferred) or live.json from publish-live.mjs / repack-live.mjs.
"""
import argparse, hashlib, json, os, pathlib, re, shutil, subprocess, sys, tempfile, zipfile

MAX_ZIP = 2_000_000_000
MAX_UNPACKED = 3_000_000_000
MAX_FILES = 10000
RESERVED = {"package.json", "bundles.json", "live-project.json", "portable.json", "blobs"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".cache"}
SKIP_SUFFIX = (".tmp", ".tmp.mp4", ".DS_Store", ".swp", ".log")
STORED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".mp4", ".webm", ".mov", ".woff", ".woff2", ".zip", ".frames", ".mp3", ".m4a"}
# upload rules from agent-bridge botAssets prepare (same table bg_delivery/manifest.mjs checks)
KINDS = {"video", "project", "media", "audio", "source", "font", "image", "bundle"}
MIMES = {"video/mp4", "video/webm", "video/quicktime", "application/json", "image/png", "image/jpeg", "image/webp",
         "image/svg+xml", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "text/plain", "text/vtt",
         "application/x-subrip", "application/zip", "font/ttf", "font/otf", "font/woff", "font/woff2",
         "application/octet-stream", "application/wasm", "application/javascript", "text/javascript", "text/css"}
PLAIN_MIMES = {"text/html", "text/x-python", "text/x-shellscript", "text/markdown", "text/vtt"}
ID_RE = re.compile(r"[A-Za-z0-9_.:-]{1,128}")
PATH_RE = re.compile(r"[A-Za-z0-9_./-]{1,200}")
EXTERNAL = [re.compile(p, re.I) for p in (
    r"""\b(?:src|href)\s*=\s*["']https?://(?!127\.0\.0\.1|localhost)""",
    r"""url\(\s*["']?https?://(?!127\.0\.0\.1|localhost)""",
    r"""@import\s+(?:url\()?\s*["']https?://""",
    r"""\bfetch\(\s*["'`]https?://(?!127\.0\.0\.1|localhost)""",
    r"""\bimport\s*(?:\(|[^;]*?from)\s*["']https?://""",
    r"""new\s+(?:Worker|WebSocket|EventSource)\(\s*["'`](?:https?|wss?)://""")]


def fail(msg):
    print("FAIL: " + msg, file=sys.stderr)
    sys.exit(1)


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def load_json(p):
    return json.loads(pathlib.Path(p).read_text())


def ffprobe_duration(p):
    if not shutil.which("ffprobe"):
        return None
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(p)],
                       capture_output=True, text=True)
    try:
        return float(json.loads(r.stdout)["format"]["duration"])
    except Exception:
        return None


def collect_film(film):
    files = []
    for dirpath, dirnames, filenames in os.walk(film, followlinks=False):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for d in dirnames:
            if os.path.islink(os.path.join(dirpath, d)):
                fail("symlink directory in film dir: " + os.path.relpath(os.path.join(dirpath, d), film))
        for name in sorted(filenames):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, film).replace(os.sep, "/")
            if os.path.islink(full):
                fail("symlink in film dir (forbidden in the bundle): " + rel)
            if name.endswith(SKIP_SUFFIX) or rel == "project.json":
                continue
            if rel.split("/")[0] in RESERVED:
                fail(f"film file '{rel}' collides with a reserved bundle path ({', '.join(sorted(RESERVED))})")
            if not PATH_RE.fullmatch(rel):
                fail("film file name has unsupported characters (use A-Z a-z 0-9 _ . / -): " + rel)
            files.append((rel, full))
    return files


def check_external(root, files):
    bad = []
    for rel, full in files:
        if not rel.lower().endswith((".html", ".htm", ".js", ".mjs", ".css", ".svg")):
            continue
        if os.path.getsize(full) > 8_000_000:
            continue
        text = pathlib.Path(full).read_text(errors="ignore")
        for rx in EXTERNAL:
            if rx.search(text):
                bad.append(rel)
                break
    if bad:
        fail("external network references found (renderer blocks all non-local requests); self-host: " + ", ".join(bad[:8]))


def pick_live(live_dir):
    for name in ("live.packed.json", "live.json"):
        p = pathlib.Path(live_dir, "payload", name)
        if p.is_file():
            return p
    fail(f"no editable package: {live_dir}/payload/live.packed.json or live.json missing (run publish-live.mjs --dry-run, "
         "then repack-live.mjs); use --no-editable only for smoke tests")


def map_strings(v, fn):
    if isinstance(v, str):
        return fn(v)
    if isinstance(v, list):
        return [map_strings(x, fn) for x in v]
    if isinstance(v, dict):
        return {k: map_strings(x, fn) for k, x in v.items()}
    return v


def build_editable(live_dir, stage, project_duration_ms):
    pkg_path = pick_live(live_dir)
    live = load_json(pkg_path)
    for k in ("durationMs", "document", "assets", "bundles", "liveProject"):
        if k not in live:
            fail(f"{pkg_path.name} missing '{k}'")
    document, assets, bundles = live["document"], live["assets"], live["bundles"]
    if not document.get("projectId") or document["projectId"] == "PLACEHOLDER_PROJECT_ID":
        fail("editable package has a placeholder projectId (rebuild publish-live with --job-dir / --project-id)")
    if live["liveProject"].get("format", {}).get("durationMs") != live["durationMs"]:
        fail("live timeline durationMs does not match package durationMs")
    if project_duration_ms is not None and project_duration_ms != live["durationMs"]:
        fail(f"film durationMs {project_duration_ms} != editable durationMs {live['durationMs']} (complete would be refused)")
    if len(assets) > MAX_FILES - 50:
        fail(f"{len(assets)} editable assets; repack with repack-live.mjs (packs are <=6 MB)")
    amap, ids = {}, set()
    live_root = pkg_path.parent.parent
    (stage / "blobs").mkdir(parents=True)
    for a in assets:
        aid = a["id"]
        if not ID_RE.fullmatch(aid) or aid in ids:
            fail("invalid or duplicate native asset id " + aid)
        ids.add(aid)
        if not re.fullmatch(r"[a-f0-9]{64}", a.get("sha256", "")):
            fail("asset without sha256: " + aid)
        mime = a.get("mime") or "application/json"
        wire_mime = "text/plain" if mime in PLAIN_MIMES else mime
        kind = "bundle" if aid.startswith("bnd_") else "font" if aid.startswith("fnt_") else a.get("kind", "source")
        if kind not in KINDS or wire_mime not in MIMES:
            fail(f"upload would be refused (kind {kind}, mime {wire_mime}): {a.get('filename')}")
        if wire_mime == "application/octet-stream" and not (kind == "source" and str(a.get("filename", "")).endswith(".frames")
                                                         and a["bytes"] <= 16 * 1024 * 1024):
            fail("octet-stream only for .frames packs <=16 MB: " + str(a.get("filename")))
        if kind in ("font", "image", "bundle") and a["bytes"] > 25 * 1024 * 1024:
            fail("font/image/bundle over 25 MB: " + str(a.get("filename")))
        src = pathlib.Path(live_root, a["file"])
        if not src.is_file() or src.is_symlink():
            fail("editable blob missing: " + str(a.get("filename")))
        if src.stat().st_size != a["bytes"] or sha256_file(src) != a["sha256"]:
            fail("editable blob changed since build (size/sha mismatch): " + str(a.get("filename")))
        dest = stage / "blobs" / a["sha256"]
        if not dest.exists():
            shutil.copyfile(src, dest)
        amap[aid] = {"sha256": a["sha256"], "bytes": a["bytes"], "mime": mime, "kind": a.get("kind", kind),
                     "filename": a.get("filename") or aid}
    for b in bundles:
        if b.get("bundleId") not in ids:
            fail("bundle references an asset that is not in the package: " + str(b.get("bundleId")))
    refs = []
    map_strings(live["liveProject"], lambda s: (refs.append(s) if s in ids else None) or s)
    (stage / "package.json").write_text(json.dumps({"schema": "transovo.motion-package/1", "projectId": document["projectId"],
                                                    "durationMs": live["durationMs"], "document": document, "assets": amap}))
    (stage / "bundles.json").write_text(json.dumps(bundles))
    (stage / "live-project.json").write_text(json.dumps(live["liveProject"]))
    return {"package": pkg_path.name, "durationMs": live["durationMs"], "assets": len(assets), "bundles": len(bundles),
            "projectId": document["projectId"], "liveAssetRefs": len(refs)}


def write_zip(stage, out):
    entries = []
    for dirpath, dirnames, filenames in os.walk(stage):
        dirnames.sort()
        for n in filenames:
            full = os.path.join(dirpath, n)
            entries.append((os.path.relpath(full, stage).replace(os.sep, "/"), full))
    entries.sort(key=lambda e: (e[0] != "project.json", e[0]))
    if len(entries) > MAX_FILES:
        fail(f"{len(entries)} files in the bundle (limit {MAX_FILES}). Pack footage frames into video files or .frames packs "
             "so the page + editable package stay under the limit")
    out = pathlib.Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp.zip")
    with zipfile.ZipFile(tmp, "w") as z:
        for rel, full in entries:
            zi = zipfile.ZipInfo(rel, (2020, 1, 1, 0, 0, 0))
            zi.external_attr = 0o100644 << 16
            zi.compress_type = zipfile.ZIP_STORED if pathlib.Path(rel).suffix.lower() in STORED_EXT or rel.startswith("blobs/") \
                else zipfile.ZIP_DEFLATED
            with open(full, "rb") as src, z.open(zi, "w", force_zip64=True) as dst:
                shutil.copyfileobj(src, dst, 1 << 20)
    tmp.replace(out)


def validate_zip(path, require_editable=True):
    """Mirror of pipeline.extract_bundle + publish_editable (local, no network)."""
    path = pathlib.Path(path)
    if path.stat().st_size > MAX_ZIP:
        fail("bundle over 2 GB")
    tmp = tempfile.mkdtemp(prefix="bundlecheck_")
    try:
        root = pathlib.Path(tmp, "bundle")
        root.mkdir()
        with zipfile.ZipFile(path) as z:
            members = z.infolist()
            if len(members) > MAX_FILES or sum(m.file_size for m in members) > MAX_UNPACKED:
                fail("bundle exceeds file-count/size limits")
            names = [m.filename for m in members]
            if "project.json" not in names:
                fail("project.json must be at the ZIP root (not under a folder)")
            for m in members:
                target = (root / m.filename).resolve()
                if not str(target).startswith(str(root.resolve()) + os.sep):
                    fail("unsafe path in bundle: " + m.filename)
                if (m.external_attr >> 16) & 0o170000 == 0o120000:
                    fail("symlink in bundle: " + m.filename)
            bad = z.testzip()
            if bad:
                fail("corrupt zip member " + bad)
            z.extractall(root)
        p = load_json(root / "project.json")
        w, h, fps = (p.get(k) for k in ("width", "height", "fps"))
        if not all(isinstance(v, int) for v in (w, h, fps)) or not (2 <= w <= 3840 and 2 <= h <= 2160 and 1 <= fps <= 120):
            fail("invalid native project format (width/height/fps)")
        n, d = p.get("frameCount"), p.get("durationMs")
        if not isinstance(n, int) or not 0 < n <= 2000000:
            fail("frameCount missing")
        if not isinstance(d, int) or abs(d - n * 1000 / fps) > 100:
            fail("durationMs inconsistent with frameCount/fps")
        entry = (p.get("composition") or {}).get("entryFile")
        if not isinstance(entry, str) or not PATH_RE.fullmatch(entry) or not (root / entry).is_file():
            fail("composition.entryFile missing or not in bundle")
        audio = p.get("mixedAudioFile")
        if not isinstance(audio, str) or not PATH_RE.fullmatch(audio) or not (root / audio).is_file():
            fail("mixedAudioFile missing or not in bundle")
        dur = ffprobe_duration(root / audio)
        if dur is not None and abs(dur - n / fps) > 0.2:
            fail(f"mixed audio is {dur:.3f}s, film is {n / fps:.3f}s (QA allows 0.2 s)")
        html = (root / entry).read_text(errors="ignore")
        for token in ("__scene", "seek", "__ready"):
            if token not in html and not any(token in (root / x).read_text(errors="ignore")
                                             for x in names if x.endswith((".js", ".mjs")) and (root / x).stat().st_size < 4_000_000):
                fail(f"page contract: '{token}' not found in the entry page or its scripts")
        for a in p.get("assets", []):
            f = root / a["path"]
            if not f.is_file() or sha256_file(f) != a["sha256"]:
                fail("project.json asset list does not match files: " + a["path"])
        editable = None
        if (root / "package.json").exists() or require_editable:
            pj, bj = root / "package.json", root / "bundles.json"
            if not pj.is_file() or not bj.is_file():
                fail("editable package missing (package.json + bundles.json); needed for production")
            pkg, bundles = load_json(pj), load_json(bj)
            if pkg.get("schema") != "transovo.motion-package/1" or not isinstance(bundles, list):
                fail("unsupported producer package")
            assets = pkg.get("assets")
            if not isinstance(assets, dict) or len(assets) > 10000:
                fail("invalid editable asset map")
            for nid, a in assets.items():
                blob = root / "blobs" / a.get("sha256", "")
                if not ID_RE.fullmatch(nid) or not blob.is_file() or blob.is_symlink():
                    fail("immutable source blob missing for " + nid)
                if blob.stat().st_size != a.get("bytes") or sha256_file(blob) != a["sha256"]:
                    fail("native source length/digest mismatch for " + nid)
            live = load_json(root / "live-project.json") if (root / "live-project.json").exists() else None
            if live is None:
                fail("live-project.json missing (live jobs need the shared timeline)")
            if live.get("format", {}).get("durationMs") != d:
                fail(f"live timeline durationMs {live.get('format', {}).get('durationMs')} != project durationMs {d}")
            editable = {"assets": len(assets), "bundles": len(bundles), "projectId": pkg.get("projectId")}
        return {"width": w, "height": h, "fps": fps, "frameCount": n, "durationMs": d, "entry": entry, "audio": audio,
                "files": len(names), "zipBytes": path.stat().st_size, "zipSha256": sha256_file(path), "editable": editable}, str(root), tmp
    except SystemExit:
        shutil.rmtree(tmp, ignore_errors=True)
        raise


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--job-dir")
    ap.add_argument("--film-dir")
    ap.add_argument("--live-dir")
    ap.add_argument("--out")
    ap.add_argument("--spec", help="film.json (default <film-dir>/film.json, else <film-dir>/project.json)")
    ap.add_argument("--entry", default="index.html")
    ap.add_argument("--audio", default="audio.wav")
    ap.add_argument("--no-editable", action="store_true", help="smoke/validation only: no editable package (never for delivery)")
    ap.add_argument("--check-page", action="store_true", help="load the page headless and seek first/middle/last frame")
    ap.add_argument("--validate-only")
    a = ap.parse_args()
    if a.validate_only:
        info, root, tmp = validate_zip(a.validate_only, require_editable=not a.no_editable)
        if a.check_page:
            run_check_page(root, info)
        shutil.rmtree(tmp, ignore_errors=True)
        print(json.dumps({"ok": True, **info}, indent=1))
        return
    J = pathlib.Path(a.job_dir).resolve() if a.job_dir else None
    film = pathlib.Path(a.film_dir or (J / "film" if J else "")).resolve()
    if not film.is_dir():
        fail("film dir not found (pass --job-dir with J/film or --film-dir)")
    out = pathlib.Path(a.out or (J / "deliver_modal" / "render_bundle_v1.zip" if J else "render_bundle_v1.zip")).resolve()
    spec_path = pathlib.Path(a.spec) if a.spec else next((film / n for n in ("film.json", "project.json") if (film / n).is_file()), None)
    if not spec_path:
        fail("film.json missing in film dir")
    spec = load_json(spec_path)
    for k in ("width", "height", "fps", "frameCount"):
        if not isinstance(spec.get(k), int):
            fail(f"film.json needs integer '{k}'")
    if not (film / a.entry).is_file():
        fail(f"entry page {a.entry} not found in film dir")
    if not (film / a.audio).is_file():
        fail(f"mixed audio {a.audio} not found in film dir")
    files = collect_film(film)
    check_external(film, files)
    stage = pathlib.Path(tempfile.mkdtemp(prefix="bundlestage_"))
    try:
        rels = []
        for rel, full in files:
            dest = stage / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            try:
                os.link(full, dest)
            except OSError:
                shutil.copyfile(full, dest)
            rels.append({"path": rel, "bytes": os.path.getsize(full), "sha256": sha256_file(full)})
        editable = None
        duration_ms = round(spec["frameCount"] * 1000 / spec["fps"])
        if not a.no_editable:
            live_dir = pathlib.Path(a.live_dir or (J / "editable" / "live" if J else "")).resolve()
            editable = build_editable(live_dir, stage, None)
            duration_ms = editable["durationMs"]  # server compares /complete durationMs to the live timeline
        project = {"title": spec.get("title", ""), "width": spec["width"], "height": spec["height"], "fps": spec["fps"],
                   "frameCount": spec["frameCount"], "durationMs": duration_ms,
                   "composition": {"entryFile": a.entry}, "mixedAudioFile": a.audio,
                   "entry": a.entry, "audio": a.audio,
                   "seek": {"ready": "window.__ready === true", "method": "await window.__scene.seek(t)", "tSeconds": "frameIndex / fps"},
                   "assets": rels}
        (stage / "project.json").write_text(json.dumps(project, indent=1))
        write_zip(stage, out)
    finally:
        shutil.rmtree(stage, ignore_errors=True)
    info, root, tmp = validate_zip(out, require_editable=not a.no_editable)
    if a.check_page:
        run_check_page(root, info)
    shutil.rmtree(tmp, ignore_errors=True)
    print(json.dumps({"ok": True, "bundle": str(out), "editableSource": editable, **info}, indent=1))


def run_check_page(root, info):
    here = pathlib.Path(__file__).resolve().parent
    r = subprocess.run(["node", str(here / "check_page.mjs"), root, info["entry"], str(info["width"]), str(info["height"]),
                        str(info["fps"]), str(info["frameCount"])], capture_output=True, text=True, timeout=600)
    sys.stderr.write(r.stdout[-1500:] + r.stderr[-1500:])
    if r.returncode:
        fail("page check failed (see above)")


if __name__ == "__main__":
    main()
