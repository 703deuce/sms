#!/usr/bin/env python3
"""Batch 2B pinned OFL font vendor. Run only in CI/manual checkout, never at runtime.
All new fonts are real upstream TTF bytes at a fixed google/fonts commit; fail closed.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
REVISION = "c30b221beb0c1da59d563feb91ec8656a1fa972a"
TARGET_NEW = 62  # 18 existing selectable design faces + 62 = 80
# Candidates intentionally exceed 62; a missing OFL/font pair is not bundled.
CANDIDATES = [
    ("Open Sans", "opensans"), ("Roboto", "roboto"), ("Nunito Sans", "nunitosans"),
    ("Work Sans", "worksans"), ("Manrope", "manrope"), ("DM Sans", "dmsans"),
    ("Quicksand", "quicksand"), ("Comfortaa", "comfortaa"),
    ("Alfa Slab One", "alfaslabone"), ("Black Ops One", "blackopsone"),
    ("Bungee", "bungee"), ("Righteous", "righteous"), ("Russo One", "russoone"),
    ("Teko", "teko"), ("Fjalla One", "fjallaone"), ("League Gothic", "leaguegothic"),
    ("Roboto Condensed", "robotocondensed"), ("Barlow Condensed", "barlowcondensed"),
    ("Rajdhani", "rajdhani"), ("Saira Condensed", "sairacondensed"),
    ("Lora", "lora"), ("Merriweather", "merriweather"),
    ("Libre Baskerville", "librebaskerville"), ("Cormorant Garamond", "cormorantgaramond"),
    ("Fraunces", "fraunces"), ("Bodoni Moda", "bodonimoda"),
    ("Abril Fatface", "abrilfatface"), ("Cinzel", "cinzel"),
    ("Pacifico", "pacifico"), ("Lobster", "lobster"),
    ("Dancing Script", "dancingscript"), ("Great Vibes", "greatvibes"),
    ("Satisfy", "satisfy"), ("Sacramento", "sacramento"),
    ("Allura", "allura"), ("Kaushan Script", "kaushanscript"),
    ("Kalam", "kalam"), ("Patrick Hand", "patrickhand"), ("Handlee", "handlee"),
    ("Indie Flower", "indieflower"), ("Permanent Marker", "permanentmarker"),
    ("Rock Salt", "rocksalt"), ("Amatic SC", "amaticsc"),
    ("Fredoka", "fredoka"), ("Baloo 2", "baloo2"), ("Varela Round", "varelaround"),
    ("Dosis", "dosis"), ("JetBrains Mono", "jetbrainsmono"),
    ("IBM Plex Mono", "ibmplexmono"), ("Fira Code", "firacode"),
    ("Inconsolata", "inconsolata"), ("Source Code Pro", "sourcecodepro"),
    ("Roboto Mono", "robotomono"), ("Share Tech Mono", "sharetechmono"),
    ("Monoton", "monoton"), ("Press Start 2P", "pressstart2p"),
    ("Special Elite", "specialelite"), ("Rubik Spray Paint", "rubikspraypaint"),
    ("Rubik Wet Paint", "rubikwetpaint"), ("Rubik Dirt", "rubikdirt"),
    ("Rubik Glitch", "rubikglitch"), ("Rubik Vinyl", "rubikvinyl"),
    ("Rubik Moonrocks", "rubikmoonrocks"), ("Rubik Puddles", "rubikpuddles"),
    ("Rubik Glitch Pop", "rubikglitchpop"), ("Assistant", "assistant"),
    ("Asap", "asap"), ("Barlow", "barlow"), ("Cabin", "cabin"),
    ("Chivo", "chivo"), ("Exo 2", "exo2"), ("Josefin Sans", "josefinsans"),
    ("Lexend", "lexend"), ("Mulish", "mulish"), ("PT Sans", "ptsans"),
    ("Red Hat Display", "redhatdisplay"), ("Sora", "sora"),
]
API = "https://api.github.com/repos/google/fonts/contents/ofl/"
RAW = "https://raw.githubusercontent.com/google/fonts/"
HEADERS = {"Accept": "application/vnd.github+json", "User-Agent": "transovo-b2b-license-vendor"}
if os.environ.get("GITHUB_TOKEN"):
    HEADERS["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as response:
        return response.read()


def blobsha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\x00" + data).hexdigest()


def file_for(entries: list[dict]) -> dict | None:
    choices = [x for x in entries if x["name"].endswith(".ttf")]
    if not choices:
        return None
    return sorted(choices, key=lambda x: (
        not x["name"].endswith("-Regular.ttf"), "[" not in x["name"],
        x["size"], x["name"],
    ))[0]


def generate() -> None:
    browser = ROOT / "new-app/public/fonts/clip"
    worker = ROOT / "worker/v3/fonts/t6"
    rows, sources, worker_rows = [], [], []
    css_metrics_file = ROOT / "new-app/lib/clips/caption-font-metrics.json"
    fit_metrics_file = ROOT / "new-app/lib/clips/caption-fit-metrics.json"
    worker_metrics_file = ROOT / "worker/clips_worker/caption_font_metrics.json"
    css_metrics = json.loads(css_metrics_file.read_text())
    fit_metrics = json.loads(fit_metrics_file.read_text())

    for display, slug in CANDIDATES:
        if len(rows) == TARGET_NEW:
            break
        try:
            directory = json.loads(fetch(API + slug + "?ref=" + REVISION))
        except (urllib.error.HTTPError, ValueError) as exc:
            print("[b2b-font-vendor] skipping absent directory", slug, str(exc))
            continue
        face = file_for(directory)
        notice = next((x for x in directory if x["name"] == "OFL.txt"), None)
        if not face or not notice:
            print("[b2b-font-vendor] skipping family without TTF and OFL", slug)
            continue
        font_data = fetch(RAW + REVISION + "/ofl/" + slug + "/" + urllib.parse.quote(face["name"]))
        license_data = fetch(RAW + REVISION + "/ofl/" + slug + "/OFL.txt")
        if blobsha(font_data) != face["sha"] or len(font_data) != face["size"]:
            raise RuntimeError("font mismatch at pinned upstream revision: " + slug)
        if blobsha(license_data) != notice["sha"] or b"SIL OPEN FONT LICENSE" not in license_data:
            raise RuntimeError("OFL license mismatch: " + slug)
        font = TTFont(io.BytesIO(font_data), recalcBBoxes=False, recalcTimestamp=False)
        family = font["name"].getDebugName(1)
        if not family:
            raise RuntimeError("missing font family name ID 1: " + slug)
        font_name = str(family)
        os2 = font["OS/2"]
        upm = int(font["head"].unitsPerEm)
        asc = int(os2.usWinAscent)
        desc = int(os2.usWinDescent)
        weight = int(os2.usWeightClass)
        cmap = font.getBestCmap() or {}
        if not all(ord(x) in cmap for x in "Aa09!?"):
            print("[b2b-font-vendor] skip insufficient basic Latin coverage", slug)
            continue
        glyphs = {
            "latin": "A", "greek": "Ω", "cyrillic": "Ж",
            "arabic": "ش", "devanagari": "म", "thai": "ก",
            "cjk": "日", "emoji": "🙂",
        }
        coverage = [k for k, v in glyphs.items() if ord(v) in cmap]
        file_name = "B2B-" + slug + ".ttf"
        license_name = "b2b-" + slug + "-OFL.txt"
        row = {
            "id": display, "assFamily": font_name, "cssWeight": weight,
            "browserFile": "/fonts/clip/" + file_name,
            "workerFile": "worker/v3/fonts/t6/" + file_name,
            "browserGitBlobSha1": face["sha"], "metricsKey": font_name,
            "sourceRevision": REVISION, "licenseStatus": "OFL-1.1",
            "licenseFile": "/fonts/clip/licenses/" + license_name,
            "licenseNoticeRevision": REVISION, "fallback": "DejaVu Sans",
            "glyphCoverage": coverage,
        }
        advances = font["hmtx"].metrics
        codepoints = [*range(32, 383), 0x410, 0x411, 0x627, 0x645, 0x905, 0x915]
        advances_by_cp = {
            str(i): advances[cmap[i]][0] for i in codepoints
            if i in cmap and cmap[i] in advances
        }
        default_adv = advances.get(cmap.get(ord("n"), ""), (upm * 0.6, 0))[0]
        em = round(upm / max(1, asc + desc), 6)
        css_metrics[display] = {
            "unitsPerEm": upm, "winAscent": asc,
            "winDescent": desc, "cssEmPerAssFontsize": em,
        }
        fit_row = {
            "unitsPerEm": upm, "defaultAdv": default_adv,
            "assEmPerFontsize": em, "adv": advances_by_cp,
        }
        fit_metrics[display] = fit_row
        fit_metrics[font_name] = fit_row
        rows.append(row)
        sources.append({"slug": slug, "upstream": face["name"], "local": file_name,
                        "blobSha": face["sha"], "licenseBlobSha": notice["sha"],
                        "assFamily": font_name, "cssWeight": weight, "size": len(font_data)})
        worker_rows.append({"id": display, "assFamily": font_name, "local": file_name, "weight": weight})
        for dest in [browser, worker]:
            (dest / "licenses").mkdir(parents=True, exist_ok=True)
            (dest / file_name).write_bytes(font_data)
            (dest / "licenses" / license_name).write_bytes(license_data)
        print("[b2b-font-vendor] verified", len(rows), display, font_name, face["sha"])
    if len(rows) != TARGET_NEW:
        raise RuntimeError("Only " + str(len(rows)) + " of 62 new verified licensed font faces; refusing to publish")
    (ROOT / "new-app/lib/clips/font-manifest-b2b.generated.ts").write_text(
        "import type { ClipFontManifestRow } from './font-manifest'\n"
        "export const B2B_CLIP_FONT_MANIFEST: readonly ClipFontManifestRow[] = "
        + json.dumps(rows, indent=2, ensure_ascii=False) + "\n"
    )
    (ROOT / "new-app/scripts/pinned-b2b-font-sources.json").write_text(
        json.dumps({"revision": REVISION, "fonts": sources}, indent=2) + "\n"
    )
    (ROOT / "worker/clips_worker/font_library_b2b.json").write_text(json.dumps(worker_rows, indent=2) + "\n")
    css_metrics_file.write_text(json.dumps(css_metrics, indent=2) + "\n")
    fit_metrics_file.write_text(json.dumps(fit_metrics, separators=(",", ":")) + "\n")
    worker_metrics_file.write_text(json.dumps(fit_metrics, separators=(",", ":")) + "\n")
    # All integration edits use stable anchors; refuse to silently break an editor.
    def patch(path: str, find: str, replace: str) -> None:
        p = ROOT / path
        current = p.read_text()
        if replace in current:
            return
        if find not in current:
            raise RuntimeError("integration anchor absent: " + path)
        p.write_text(current.replace(find, replace, 1))

    patch("new-app/lib/clips/font-manifest.ts",
          "export const CLIP_FONT_MANIFEST_VERSION = 1 as const",
          "import { B2B_CLIP_FONT_MANIFEST } from './font-manifest-b2b.generated'\n"
          "export const CLIP_FONT_MANIFEST_VERSION = 1 as const")
    patch("new-app/lib/clips/font-manifest.ts",
          "] as const\n\nexport function findClipFont",
          "  ...B2B_CLIP_FONT_MANIFEST,\n] as const\n\nexport function findClipFont")
    patch("new-app/components/clips/editor/clip-editor-fonts.ts",
          "import { Archivo_Black",
          "import { B2B_CLIP_FONT_MANIFEST } from '@/lib/clips/font-manifest-b2b.generated'\n"
          "import { Archivo_Black")
    patch("new-app/components/clips/editor/clip-editor-fonts.ts",
          "  'Space Mono',\n] as const",
          "  'Space Mono',\n  ...B2B_CLIP_FONT_MANIFEST.map(r => r.id),\n] as const")
    patch("new-app/lib/clips/editor/text-items.ts",
          "import { normAnim, normLayerAnim",
          "import { B2B_CLIP_FONT_MANIFEST } from '@/lib/clips/font-manifest-b2b.generated'\n"
          "import { normAnim, normLayerAnim")
    patch("new-app/lib/clips/editor/text-items.ts",
          "  { id: 'Space Mono', label: 'Space Mono', ass: 'Space Mono', weight: 400 },\n] as const",
          "  { id: 'Space Mono', label: 'Space Mono', ass: 'Space Mono', weight: 400 },\n"
          "  ...B2B_CLIP_FONT_MANIFEST.map(f => ({ id: f.id, label: f.id, ass: f.assFamily, weight: f.cssWeight })),\n] as const")
    patch("new-app/lib/clips/caption-fonts.ts",
          "import { cssFallbackStack }",
          "import { B2B_CLIP_FONT_MANIFEST } from '@/lib/clips/font-manifest-b2b.generated'\n"
          "import { cssFallbackStack }")
    patch("new-app/lib/clips/caption-fonts.ts",
          "  if (font === 'Poppins') return",
          "  const pinnedB2B = B2B_CLIP_FONT_MANIFEST.find(row => row.id === font || row.assFamily === font)\n"
          "  if (pinnedB2B) return '\"' + pinnedB2B.assFamily.replace(/\"/g, '') + '\", sans-serif'\n"
          "  if (font === 'Poppins') return")
    patch("new-app/lib/clips/render-plan/text-items-ass.ts",
          "import { textWidthPx }",
          "import { B2B_CLIP_FONT_MANIFEST } from '@/lib/clips/font-manifest-b2b.generated'\n"
          "import { textWidthPx }")
    # Text font normalization and render use the same canonical family.
    text_ass = ROOT / "new-app/lib/clips/render-plan/text-items-ass.ts"
    text = text_ass.read_text()
    marker = "export const TEXT_FONTS: Record<string, string> = {"
    if "  ...Object.fromEntries(B2B_CLIP_FONT_MANIFEST.map" not in text:
        start = text.index(marker)
        end = text.index("\n}", start)
        text = text[:end] + "\n  ...Object.fromEntries(B2B_CLIP_FONT_MANIFEST.map(f => [f.id, f.assFamily])), " + text[end:]
        text_ass.write_text(text)
    for worker_file, addition in [
        ("worker/clips_worker/captions_ass.py",
         "\n# B2B: generated pinned font inventory shared by preview/export.\n"
         "import json as _b2b_json\n"
         "from pathlib import Path as _b2b_Path\n"
         "_b2b_rows = _b2b_json.loads(_b2b_Path(__file__).with_name('font_library_b2b.json').read_text())\n"
         "_ASS_FONT_FILES.update({r['assFamily']: _T6_FONTS / r['local'] for r in _b2b_rows})\n"
         "_ASS_FONT_ALIASES.update({r['id']: r['assFamily'] for r in _b2b_rows})\n"),
        ("worker/clips_worker/text_items.py",
         "\n# B2B: same canonical ASS font names as the browser.\n"
         "import json as _b2b_json\n"
         "from pathlib import Path as _b2b_Path\n"
         "_b2b_rows = _b2b_json.loads(_b2b_Path(__file__).with_name('font_library_b2b.json').read_text())\n"
         "TEXT_FONTS.update({r['id']: r['assFamily'] for r in _b2b_rows})\n"),
    ]:
        p = ROOT / worker_file
        current = p.read_text()
        if "# B2B: " not in current:
            p.write_text(current + addition)
    (ROOT / "worker/tests/test_b2b_font_library.py").write_text("\"\"\"Batch 2B: shipped 62 additional fonts, file hashes, licences and ASS lookup.\"\"\"\nfrom __future__ import annotations\nimport hashlib\nimport json\nimport subprocess\nfrom pathlib import Path\n\nimport pytest\nfrom fontTools.ttLib import TTFont\n\nROOT = Path(__file__).resolve().parents[2]\nMETA = json.loads((ROOT / \"new-app/scripts/pinned-b2b-font-sources.json\").read_text())\nROWS = json.loads((ROOT / \"worker/clips_worker/font_library_b2b.json\").read_text())\nBROWSER = ROOT / \"new-app/public/fonts/clip\"\nWORKER = ROOT / \"worker/v3/fonts/t6\"\n\n\ndef blobsha(data: bytes) -> str:\n    return hashlib.sha1(b\"blob \" + str(len(data)).encode() + b\"\\x00\" + data).hexdigest()\n\n\ndef test_exact_62_new_fonts():\n    assert len(META[\"fonts\"]) == len(ROWS) == 62\n    assert len({r[\"id\"] for r in ROWS}) == 62\n    assert len({r[\"assFamily\"] for r in ROWS}) == 62\n\n\n@pytest.mark.parametrize(\"font\", META[\"fonts\"], ids=lambda f: f[\"slug\"])\ndef test_browser_and_worker_font_bytes_licenses_and_coverage(font):\n    b = (BROWSER / font[\"local\"]).read_bytes()\n    w = (WORKER / font[\"local\"]).read_bytes()\n    assert b == w\n    assert len(b) == font[\"size\"]\n    assert blobsha(b) == font[\"blobSha\"]\n    license_name = \"b2b-\" + font[\"slug\"] + \"-OFL.txt\"\n    for base in (BROWSER, WORKER):\n        notice = (base / \"licenses\" / license_name).read_bytes()\n        assert blobsha(notice) == font[\"licenseBlobSha\"]\n        assert b\"SIL OPEN FONT LICENSE\" in notice\n    face = TTFont(WORKER / font[\"local\"])\n    names = {n.toUnicode() for n in face[\"name\"].names if n.nameID in (1, 16)}\n    assert font[\"assFamily\"] in names\n    cmap = face.getBestCmap() or {}\n    assert all(ord(c) in cmap for c in \"Aa09!?\")\n    resolved = subprocess.run([\"fc-match\", \"-f\", \"%{file}\", font[\"assFamily\"]],\n                              capture_output=True, text=True, check=True)\n    selected = Path(resolved.stdout)\n    assert selected.exists()\n    assert selected.read_bytes() == b, (font[\"assFamily\"], str(selected))\n\n\n@pytest.mark.parametrize(\"font\", META[\"fonts\"], ids=lambda f: f[\"slug\"])\ndef test_worker_resolves_selected_pinned_face(font):\n    from clips_worker.captions_ass import resolve_ass_font_name\n    from clips_worker.text_items import font_names\n    assert resolve_ass_font_name({}, {\"font\": font[\"assFamily\"]}) == font[\"assFamily\"]\n    assert font_names({\"font\": font[\"assFamily\"]})[0] == font[\"assFamily\"]\n")
    # Don't mutate old project presets or model schema.
    assert len(rows) == 62
    print("[b2b-font-vendor] 62 new + 18 existing = 80 design families; all bytes and licenses pinned")


if __name__ == "__main__":
    generate()
