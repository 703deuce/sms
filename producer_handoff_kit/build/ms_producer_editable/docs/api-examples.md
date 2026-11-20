# Transovo API: recorded request/response examples

Recorded from the simulator (`sim/transovo-sim.mjs`) by `tools/capture_api_examples.mjs` on 2026-11-17T15:35:25.871Z. Tokens and URL signatures are redacted. Long arrays are shortened.

### Create a job (Transovo-internal; the sim exposes it so tests can play Transovo)

```http
POST /api/motion-studio/_sim/jobs
Content-Type: application/json

{
 "projectId": "api_demo",
 "mode": "deterministic_render",
 "action": "deterministic_render",
 "workerId": "wrk_grokbot_A",
 "input": {
  "schema": "transovo.motion-job/1",
  "mode": "deterministic_render",
  "projectId": "api_demo",
  "baseVersion": 1,
  "edits": {
   "schema": "transovo.edit-patch/1",
   "scenes": {
    "S01": {
     "elements": {
      "location": {
       "text": "Central Islip, New York"
      }
     }
    }
   }
  }
 }
}
```
```json
201
{
 "jobId": "msaj_<id>",
 "jobToken": "<job token, shown once>",
 "jobUrl": "http://127.0.0.1:8787/api/motion-studio/agent/jobs/msaj_<id>",
 "apiBase": "http://127.0.0.1:8787/api/motion-studio"
}
```

### Read the job (worker, first call after the webhook)

```http
GET /api/motion-studio/agent/jobs/msaj_<id>
Authorization: Bearer <job token>
```
```json
200
{
 "job": {
  "id": "msaj_<id>",
  "projectId": "api_demo",
  "workspaceId": "ws_sim",
  "mode": "deterministic_render",
  "action": "deterministic_render",
  "status": "queued",
  "phase": "queued",
  "progress": 0,
  "createdAt": "2026-11-17T15:35:25.731Z",
  "input": {
   "schema": "transovo.motion-job/1",
   "mode": "deterministic_render",
   "projectId": "api_demo",
   "baseVersion": 1,
   "edits": {
    "schema": "transovo.edit-patch/1",
    "scenes": {
     "S01": {
      "elements": {
       "location": {
        "text": "Central Islip, New York"
       }
      }
     }
    }
   }
  },
  "assignedWorker": "wrk_grokbot_A",
  "artifacts": [],
  "events": 0
 }
}
```

### Asset lookup by sha256 (dedupe before upload)

```http
POST /api/motion-studio/assets/lookup
Authorization: Bearer <job token>
Content-Type: application/json

{
 "sha256": [
  "e2f1462e922e7024d402413fe75e2be72c18a6e8b96c27ed1d708e1ab8f4ec40",
  "0000000000000000000000000000000000000000000000000000000000000000"
 ]
}
```
```json
200
{
 "found": {}
}
```

### Upload step 1: prepare

```http
POST /api/motion-studio/assets
Authorization: Bearer <job token>
Content-Type: application/json

{
 "action": "prepare",
 "filename": "logo_mark.svg",
 "kind": "image",
 "mime": "image/svg+xml",
 "bytes": 261,
 "sha256": "e2f1462e922e7024d402413fe75e2be72c18a6e8b96c27ed1d708e1ab8f4ec40",
 "meta": {
  "width": 600,
  "height": 200,
  "svgSafe": true
 }
}
```
```json
200
{
 "assetId": "ast_e2f1462e922e7024d402413fe75e2be7",
 "uploadId": "upl_1e4ed994173fad253820f6d3",
 "mode": "signed_put",
 "signedPut": {
  "url": "http://127.0.0.1:8787/_upload/upl_1e4ed994173fad253820f6d3?exp=1794931525&sig=<sig>",
  "expiresAt": "2026-11-17T16:05:25.000Z"
 }
}
```

### Upload step 2: PUT bytes to the signed URL (no bearer; the signature is the capability)

```http
PUT /_upload/upl_1e4ed994173fad253820f6d3?exp=1794931525&sig=<sig>

<261 raw bytes>
```
```json
200
{
 "ok": true
}
```

### Upload step 3: commit (server re-hashes; 422 integrity_mismatch on any difference)

```http
POST /api/motion-studio/assets
Authorization: Bearer <job token>
Content-Type: application/json

{
 "action": "commit",
 "uploadId": "upl_1e4ed994173fad253820f6d3"
}
```
```json
200
{
 "assetId": "ast_e2f1462e922e7024d402413fe75e2be7",
 "status": "ready",
 "bytes": 261,
 "sha256": "e2f1462e922e7024d402413fe75e2be72c18a6e8b96c27ed1d708e1ab8f4ec40"
}
```

### Prepare again with the same bytes: content-addressed dedupe

```http
POST /api/motion-studio/assets
Authorization: Bearer <job token>
Content-Type: application/json

{
 "action": "prepare",
 "filename": "copy.svg",
 "kind": "image",
 "mime": "image/svg+xml",
 "bytes": 261,
 "sha256": "e2f1462e922e7024d402413fe75e2be72c18a6e8b96c27ed1d708e1ab8f4ec40"
}
```
```json
200
{
 "assetId": "ast_e2f1462e922e7024d402413fe75e2be7",
 "exists": true,
 "status": "ready"
}
```

### Asset info + short-lived download URL

```http
GET /api/motion-studio/assets/ast_e2f1462e922e7024d402413fe75e2be7
Authorization: Bearer <job token>
```
```json
200
{
 "asset": {
  "assetId": "ast_e2f1462e922e7024d402413fe75e2be7",
  "sha256": "e2f1462e922e7024d402413fe75e2be72c18a6e8b96c27ed1d708e1ab8f4ec40",
  "bytes": 261,
  "mime": "image/svg+xml",
  "kind": "image",
  "filename": "logo_mark.svg",
  "meta": {
   "width": 600,
   "height": 200,
   "svgSafe": true
  },
  "projectId": "api_demo",
  "createdByJob": "msaj_<id>",
  "createdAt": "2026-11-17T15:35:25.748Z"
 },
 "download": {
  "url": "http://127.0.0.1:8787/_blob/ast_e2f1462e922e7024d402413fe75e2be7?exp=1794931525&sig=<sig>",
  "expiresAt": "2026-11-17T16:05:25.000Z"
 }
}
```

### List versions (head = 0 for a new project)

```http
GET /api/motion-studio/projects/api_demo/versions
Authorization: Bearer <job token>
```
```json
200
{
 "projectId": "api_demo",
 "head": 0,
 "versions": []
}
```

### Publish version 1 (write-once; body = full transovo.motion-project/1 document)

```http
POST /api/motion-studio/projects/api_demo/versions
Authorization: Bearer <job token>
Content-Type: application/json

{
 "baseVersion": 0,
 "document": {
  "schema": "transovo.motion-project/1",
  "projectId": "api_demo",
  "version": 1,
  "parentVersion": null,
  "title": "Keith Murray: 2-minute documentary",
  "createdAt": "2026-11-17T15:33:06.533Z",
  "createdBy": {
   "mode": "import",
   "jobId": "msaj_<id>",
   "workerId": "importer"
  },
  "changes": [
   {
    "type": "import",
    "note": "finished production imported; S01 + S05 parameterized (editable), other scenes reused as rendered clips"
   }
  ],
  "format": {
   "width": 1920,
   "height": 1080,
   "fps": 30,
   "durationSec": 125.3
  },
  "theme": {
   "schema": "transovo.motion-theme/1",
   "themeId": "thm_lexicon",
   "origin": {
    "designedBy": "grokbot",
    "concept": "The Lexicon",
    "designFile": "scenes/theme.json"
   },
   "colors": {
    "background": {
     "value": "#07170F",
     "label": "Background",
     "designName": "deep"
    },
    "primary": {
     "value": "#0E2A22",
     "label": "Primary (page / surface)",
     "designName": "pine"
    },
    "secondary": {
     "value": "#C8462C",
     "label": "Secondary (stamps, years)",
     "designName": "brick"
    },
    "accent": {
     "value": "#D4F03C",
     "label": "Accent (highlights, lamp)",
     "designName": "lime"
    },
    "text": {
     "value": "#EFE7D6",
     "label": "Text / paper",
     "designName": "bone"
    }
   },
   "fonts": {
    "display": {
     "faces": [
      "fnt_60e208dc276a1c35fc5b62e94f9fb959"
     ],
     "weight": 900,
     "label": "Big Shoulders Display 900"
    },
    "label": {
     "faces": [
      "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92"
     ],
     "weight": 700,
     "label": "Big Shoulders Text 700"
    },
    "body": {
     "faces": [
      "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
      "fnt_5f86915a744832ecf6e4a17ab04bea09",
      "fnt_7ec97244259db4008c4b1224c7914e53"
     ],
     "weight": 400,
     "label": "Spectral 400/600 + Italic"
    }
   },
   "brand": {
    "logo": null
   }
  },
  "overrides": {
   "schema": "transovo.edit-patch/1",
   "scenes": {}
  },
  "fontRecords": [
   {
    "schema": "transovo.font-record/1",
    "sha256": "60e208dc276a1c35fc5b62e94f9fb959c40c11783a9eb7548175c14b1fbeb720",
    "faceIndex": 0,
    "family": "Big Shoulders Display",
    "subfamily": "Thin",
    "fullName": "Big Shoulders Display Thin",
    "postscriptName": "BigShouldersDisplay-Thin",
    "version": "Version 2.002",
    "weightClass": 100,
    "widthClass": 5,
    "italic": false,
    "axes": [
     {
      "tag": "wght",
      "min": 100,
      "default": 100,
      "max": 900
     }
    ],
    "numGlyphs": 1074,
    "variable": true,
    "coverage": [
     [
      32,
      126
     ],
     [
      160,
      305
     ],
     [
      308,
      328
     ],
     "… 104 more"
    ],
    "codepoints": 718,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://scripts.sil.org/OFL",
    "licenseUrl": "https://scripts.sil.org/OFL",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Big Shoulders Display",
      "glyphsMissingInSample": 0,
      "inkedPx": 254,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 314,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 978,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
    "assetId": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
    "sample": "Aa0Zz"
   },
   {
    "schema": "transovo.font-record/1",
    "sha256": "fce6c5cf4edec9c9dfb3e7a0f60bef927c881eab72ca17d50fddf4b55f334ed5",
    "faceIndex": 0,
    "family": "Big Shoulders Text",
    "subfamily": "Thin",
    "fullName": "Big Shoulders Text Thin",
    "postscriptName": "BigShouldersText-Thin",
    "version": "Version 2.002",
    "weightClass": 100,
    "widthClass": 5,
    "italic": false,
    "axes": [
     {
      "tag": "wght",
      "min": 100,
      "default": 100,
      "max": 900
     }
    ],
    "numGlyphs": 1074,
    "variable": true,
    "coverage": [
     [
      32,
      126
     ],
     [
      160,
      305
     ],
     [
      308,
      328
     ],
     "… 104 more"
    ],
    "codepoints": 718,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://scripts.sil.org/OFL",
    "licenseUrl": "https://scripts.sil.org/OFL",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Big Shoulders Text",
      "glyphsMissingInSample": 0,
      "inkedPx": 570,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 671,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 1197,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
    "assetId": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
    "sample": "Aa0Zz"
   },
   {
    "schema": "transovo.font-record/1",
    "sha256": "c89021dc20720c8d0dcf40b0b2f6e00c13665fa8041717f581396f51b8c78f5d",
    "faceIndex": 0,
    "family": "Spectral",
    "subfamily": "Regular",
    "fullName": "Spectral Regular",
    "postscriptName": "Spectral-Regular",
    "version": "Version 2.005; ttfautohint (v1.8.4.7-5d5b)",
    "weightClass": 400,
    "widthClass": 5,
    "italic": false,
    "axes": [],
    "numGlyphs": 1480,
    "variable": false,
    "coverage": [
     [
      0,
      0
     ],
     [
      13,
      13
     ],
     [
      32,
      126
     ],
     "… 134 more"
    ],
    "codepoints": 878,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org",
    "licenseUrl": "https://openfontlicense.org",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Spectral",
      "glyphsMissingInSample": 0,
      "inkedPx": 1036,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 1168,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 1151,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
    "assetId": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
    "sample": "Aa0Zz"
   },
   "… 3 more"
  ],
  "scenes": [
   {
    "sceneId": "S01",
    "bundle": "bnd_46145680c1dc764bcedc046e95e29b9c",
    "editable": true,
    "themeAware": true,
    "role": "scene",
    "timeline": {
     "startSec": 6.25,
     "endSec": 12,
     "frames": 172
    },
    "clip": {
     "asset": "ast_c5e5885b36a561a72774338d20450e82",
     "renderKey": "rk_95dd65fbf2e76f14d382374e17c140e346a7f5ab",
     "frames": 173,
     "renderedInVersion": 1,
     "origin": "production"
    },
    "preview": {
     "poster": "ast_1b28eb3070d3c35c64bf6582e507445a"
    },
    "narrationRefs": [
     "L01"
    ]
   },
   {
    "sceneId": "S02",
    "bundle": "bnd_94f3ac1a2ad012b6b01161f6c20e2f9c",
    "editable": false,
    "themeAware": false,
    "role": "scene",
    "timeline": {
     "startSec": 12,
     "endSec": 22.35,
     "frames": 311
    },
    "clip": {
     "asset": "ast_02b360a310ca742eb95690e753e4c81d",
     "renderKey": "rk_cc5761ceb9d2b2030e624547a855fdd2b73d44f4",
     "frames": 311,
     "renderedInVersion": 1,
     "origin": "production"
    },
    "preview": {
     "poster": "ast_63a2cb84133032166fde4771505a109f"
    },
    "narrationRefs": []
   },
   {
    "sceneId": "S03",
    "bundle": "bnd_d2d286e683e51dd1ca675cba3f0abd59",
    "editable": false,
    "themeAware": false,
    "role": "scene",
    "timeline": {
     "startSec": 58.354,
     "endSec": 63.491,
     "frames": 154
    },
    "clip": {
     "asset": "ast_0d512005092958ba314683ad46ed0e79",
     "renderKey": "rk_6d8c21ba9de53db396996b312f1766792b2e129e",
     "frames": 154,
     "renderedInVersion": 1,
     "origin": "production"
    },
    "preview": {
     "poster": "ast_5387cb4a5090c7816341b84fd309b6b7"
    },
    "narrationRefs": []
   },
   "… 3 more"
  ],
  "sources": {
   "timeline": "ast_a4c789ec9bc1f22659412240b7025cbd",
   "shots": "ast_13394ac30399d691e12ca10a4df361cb",
   "cues": "ast_7814ec41fb7b8056a0a634d441ce25f0",
   "designTheme": "ast_945f84ff16ba80c8d8f88af90f1a2d0d",
   "faceCenters": "ast_7cac98eb84b64d858187561583f03a6a",
   "narration": {
    "scriptLines": "ast_3b1c66ed2307b21caf5fa94efb7bdc34",
    "words": "ast_b363d5cc9b73cfb7f51406aba84760d5",
    "wordsRaw": "ast_da148e3a8b75f6ca592bc1e9015f84b4",
    "ttsAlignment": "ast_a365506688ea99d93d765f5529e20ebf",
    "ttsRaw": "ast_85852382705db6e2395d42ef52116194",
    "buildAudio": "ast_65259b903dbbbb363cac970e5edb8db0",
    "voice": "ElevenLabs Roger (eleven_flash_v2_5)"
   },
   "mix": "ast_e19db84ed1a148c4dcc3d65ea387d676",
   "mixRaw": "ast_1e86032e2fb1eb8286898d7c861ebe38",
   "unfinishedRevision": {
    "note": "production started a Brian re-voice (20:26 ET) and re-rendered scenes/shots, but never rebuilt the mix or the master; kept as source only",
    "shots": "ast_46fc42e40f26a7ed2bf25f59eb71360a",
    "timeline": "ast_d361f93c3c9ca8ac72bb1f9f3015587c",
    "words": "ast_e2e2420484f87c69379adfb1dcc6bdc9",
    "voice": {
     "timeline.json": "ast_d361f93c3c9ca8ac72bb1f9f3015587c",
     "tts_alignment.json": "ast_4a280671c1273c274074ece000f59e0b",
     "tts_brian.py": "ast_3bbce873034282110703b713d4649c05",
     "tts_raw.mp3": "ast_43e911437304d53bfedd105d2fd89c7c",
     "words_raw.json": "ast_4da3695aad811746507ba23d516dd850",
     "words.json": "ast_e2e2420484f87c69379adfb1dcc6bdc9"
    }
   },
   "stems": {
    "dialog": "ast_bf4e4cdb33f40e175cfc0d57af43a09a",
    "footageAudio": "ast_142303a81aa619a28826ae092eec0e4f",
    "music": "ast_5c94d433b0f7351bc1d56e47f1f6af94",
    "narration": "ast_b22a18e34dbcb092b99d53bfdc8d7dae",
    "sfx": "ast_d4b4e8c4f478a594374e968dd9ea61e6"
   },
   "captions": {
    "interviewVtt": "ast_c5611074a37bb999589d35f0713ac884"
   },
   "transcripts": {
    "int_lines.txt": "ast_31109c3555588abcf939cb052df449ba",
    "tx_6SUDm0BvCGo.mp4.txt": "ast_9aa052934013e577d2d1d9f656e1fa90",
    "tx_int_1040.mp4.txt": "ast_9d986765b103a9328247419be6112ed9",
    "tx_PiUYEF7qNgc.mp4.txt": "ast_99707f8d0f3eaef8b2bab97edbf15f59",
    "tx_R2zet82146c.mp4.txt": "ast_0067c0827e3e43e2c195d632f6afbcf1",
    "tx_xGB2SsPJg34.mp4.txt": "ast_feb5561ae3a112ebaff3b67c0cb44c53"
   },
   "productionScripts": {
    "assemble": "ast_e973ec67065d17a8f2e58cf4db68e84d",
    "timeline": "ast_e9bd118aacda4560505d3b4e164398fa",
    "timelineBrian": "ast_7500825104ce74773f6d8143fce6f20d",
    "renderBrowser": "ast_6e119282e2ca3542ff44a8e88a537744",
    "whisper": "ast_15f773601904a15eeb705cd17b7c4951",
    "retime": "ast_1b3bcece3b74c1991234bb0d7d234d56",
    "sceneTools": {
     "build_shots.py": "ast_f674bec321660c0bee93ebf1149549db",
     "face_center.py": "ast_88d74a478ab40b49136c8ddb28f13333",
     "probe_comp.py": "ast_0606d7b0884c5b79b13697202e82cd11",
     "probe.mjs": "ast_1d892db2a4c891c6151c0325f6f44493"
    }
   },
   "sharedSceneLib": {
    "BigShouldersDisplay[wght].ttf": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
    "BigShouldersText[wght].ttf": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
    "common.css": "ast_de286dc1dce586ccfe03a7b76a34f6c7",
    "common.js": "ast_3da72b3e6597b5f041ff493e5be8e19a",
    "cues.json": "ast_dadf40b3334a9903721dab4bc6b0361d",
    "d3.min.js": "ast_912111098ea99503a6f4967361d2bbdc",
    "gsap.min.js": "ast_3d1bea374ab1b703cc5c4105358eec63",
    "Spectral-ExtraLight.ttf": "fnt_5d852db897fd7ad5ce640a6e88f1cd70",
    "Spectral-Italic.ttf": "fnt_7ec97244259db4008c4b1224c7914e53",
    "Spectral-Regular.ttf": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
    "Spectral-SemiBold.ttf": "fnt_5f86915a744832ecf6e4a17ab04bea09",
    "SplitText.min.js": "ast_7b299a6b26b36fd5ce1c0712f31d6d25",
    "three.core.js": "ast_613e370f76638fdef83926642bf256dc",
    "three.module.js": "ast_104f56145899722094556490d787aae0",
    "words.json": "ast_e2e2420484f87c69379adfb1dcc6bdc9"
   },
   "pageScene": {
    "BigShouldersDisplay[wght].ttf": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
    "BigShouldersText[wght].ttf": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
    "index.html": "ast_8edd590b07c0d78721a7db1db80d5b86",
    "page.png": "ast_a29861ba1b33f46413052f0a36f44b56",
    "Spectral-ExtraLight.ttf": "fnt_5d852db897fd7ad5ce640a6e88f1cd70",
    "Spectral-Italic.ttf": "fnt_7ec97244259db4008c4b1224c7914e53",
    "Spectral-Regular.ttf": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
    "Spectral-SemiBold.ttf": "fnt_5f86915a744832ecf6e4a17ab04bea09"
   },
   "photos": {
    "cover_elnino.jpg": "ast_0884589688baeab2bc5c9959f43ee7c7",
    "cover_tmbt.jpg": "ast_a1f29ba35ebe053663d12d50bbcb5264",
    "km_2023.png": "ast_fc58f5e97e9403f78e024f0c7df8fb83",
    "single_tmbt.jpg": "ast_8d75c9980d8957c1222785c52c8b64e3",
    "web_01.img": "ast_f85653c57dcb0a7d8e93ed7489d2332b",
    "web_02.img": "ast_cd31bbd4981365be959426648825c3b3",
    "web_03.img": "ast_fd32b9dae2385591c093ec3eb7aca950",
    "web_04.img": "ast_4e0602fd1ccdfff94c82789209625008",
    "web_06.img": "ast_70d2a88063e64b8d37e8a4240d84bef8",
    "web_07.img": "ast_8a239d117cd9863dd2c21e703e6a93be",
    "web_08.img": "ast_65917e18ee109a56ea68213c421b7523",
    "web_10.img": "ast_dce5236d36ecb8fd8a903872081f7fc5",
    "web_11.img": "ast_3de93400dabb116658365275eadf1b61",
    "web_12.img": "ast_394471bc2d0d56f02bced624ab12b670",
    "web_13.img": "ast_0a96e3644b32dd391367962ebc6ce0d5",
    "web_14.img": "ast_a7cc86300797317f76dbe5039e72274f",
    "web_15.img": "ast_fe1a64dd2134a2f11405038df8f01222",
    "web_17.img": "ast_19846ad9e2f676170565862b5c28098e",
    "web_18.img": "ast_5121c9c36929999186def348c7b71475",
    "web_19.img": "ast_f244ec17c47cd41734eaf596d4833219",
    "web_21.img": "ast_7074d9ed98309a83bc29ce83b7cf204a",
    "web_22.img": "ast_ba07e7c93448b24d7fc044734631a27e",
    "web_24.img": "ast_9362d7499cb88c46faf25a5b73d72dbc",
    "web_26.img": "ast_bfc11ca58b12ecd611fa95ab85497561",
    "web_27.img": "ast_43614758e886ce8129a6388355423512",
    "web_28.img": "ast_1ed5c030cb54cbe371cbee09b608ec14",
    "web_35.img": "ast_aada4bf1d3dedd62a9878cfa4606f484",
    "web_36.img": "ast_4b3edbfb2c3d89cbd2c58c5840aa8a64"
   },
   "cutouts": {
    "km_cut.png": "ast_6a8e823621085823081ce0cde4e92a8c",
    "km21_check.jpg": "ast_2248d7f876a38da11fa5e9cdb7aeda7b",
    "km21_cut.png": "ast_8336cf753ec7523f34c083499a233836",
    "km21.png": "ast_9595c69e653b86c4a4948f408c860ca9"
   },
   "footage": {
    "raw": {
     "6SUDm0BvCGo": "ast_cf5dd6f7f7982bb3c1f07bdbf80eab9a",
     "int_1040": "ast_d796aa730464713b440a86a159547383",
     "PiUYEF7qNgc": "ast_7559217aecceaa06a9d87b95c29328a2",
     "cJJy7w6Ypdc": "ast_2a71997214b768ea5777f083ae17d2ce",
     "R2zet82146c": "ast_70e4d2a70f669bad9c05ff890945a64a",
     "gxoCloGxH1g": "ast_ad4194c8688b9ee1acbf4e271f309f38",
     "…": "1 more keys"
    },
    "extracted": {
     "SH01": "ast_67e2315133c7ad4ad134bd780927e6e8",
     "SH04a": "ast_a564111313ebc748488d426900304f83",
     "SH04b": "ast_0ebee7d6d210e4294fb988b30194c9fb",
     "SH05": "ast_f448115f48ddf6356f1abf6efee35a52",
     "SH06a": "ast_fec01429b24b5c0af1297ab11cdb772f",
     "SH06b": "ast_04dfef10b57d4ed0e1d2d923d0dba94a",
     "…": "17 more keys"
    }
   },
   "qa": {
    "contact_sheet.jpg": "ast_f9dc62ed524689e9fdf8d6445a4b6ba8",
    "detail.jpg": "ast_29f6d3d1716c8cb9782d0082f5e284e6",
    "f_102.png": "ast_cc97e21cd97a061250095cadc413bada",
    "f_113.png": "ast_210992bf7f5506b051026f77d8569f4a",
    "f_123.5.png": "ast_6d6db9b4f5adb1c062b8eec089fea7b9",
    "f_20.png": "ast_d8bb7276788734ac1e185b15327895de",
    "f_31.5.png": "ast_5a718202d8005be6b8accee172f6ee91",
    "f_36.png": "ast_d699001f351469ed123bb112a2a7235d",
    "f_41.png": "ast_07205bcb8f19820c1f5043209b050e0d",
    "f_61.png": "ast_3b36f724bfd03e75f9fe0deb75a7e8f8",
    "f_79.png": "ast_f89932830332953a0ccf2ab2ef2cfb2a",
    "f_92.png": "ast_e623f58dc993c0d790cc94d4116a1fae",
    "f_98.png": "ast_705523f42398d1588fd6a57c921f844c",
    "q_107.png": "ast_49deea853e1dc5d90b41e9aba4fbf9b3"
   }
  },
  "runtimeLock": "ast_01eec89893bab22af42e3906002bc000",
  "validation": {
   "status": "ok",
   "issues": []
  },
  "master": {
   "recipe": "ast_353c03ffd6e9c44d8d60194091816c01",
   "asset": "ast_a6807ff5b615625e95f660ee419693f5",
   "renderKey": "mk_4e4a6c4e4259c6f17841750e815bea8bded3a413",
   "renderedInVersion": 1,
   "origin": "production",
   "encode": {
    "note": "production final (x264 2-pass 1150k)"
   }
  },
  "assetRefs": [
   "ast_0067c0827e3e43e2c195d632f6afbcf1",
   "ast_01eec89893bab22af42e3906002bc000",
   "ast_0264386738fe93fbbf4d1056ac5c5ed7",
   "… 154 more"
  ]
 }
}
```
```json
201
{
 "projectId": "api_demo",
 "version": 1,
 "head": 1
}
```

### Publish on a stale base → 409

```http
POST /api/motion-studio/projects/api_demo/versions
Authorization: Bearer <job token>
Content-Type: application/json

{
 "baseVersion": 0,
 "document": {
  "schema": "transovo.motion-project/1",
  "projectId": "api_demo",
  "version": 1,
  "parentVersion": null,
  "title": "Keith Murray: 2-minute documentary",
  "createdAt": "2026-11-17T15:33:06.533Z",
  "createdBy": {
   "mode": "import",
   "jobId": "msaj_<id>",
   "workerId": "importer"
  },
  "changes": [
   {
    "type": "import",
    "note": "finished production imported; S01 + S05 parameterized (editable), other scenes reused as rendered clips"
   }
  ],
  "format": {
   "width": 1920,
   "height": 1080,
   "fps": 30,
   "durationSec": 125.3
  },
  "theme": {
   "schema": "transovo.motion-theme/1",
   "themeId": "thm_lexicon",
   "origin": {
    "designedBy": "grokbot",
    "concept": "The Lexicon",
    "designFile": "scenes/theme.json"
   },
   "colors": {
    "background": {
     "value": "#07170F",
     "label": "Background",
     "designName": "deep"
    },
    "primary": {
     "value": "#0E2A22",
     "label": "Primary (page / surface)",
     "designName": "pine"
    },
    "secondary": {
     "value": "#C8462C",
     "label": "Secondary (stamps, years)",
     "designName": "brick"
    },
    "accent": {
     "value": "#D4F03C",
     "label": "Accent (highlights, lamp)",
     "designName": "lime"
    },
    "text": {
     "value": "#EFE7D6",
     "label": "Text / paper",
     "designName": "bone"
    }
   },
   "fonts": {
    "display": {
     "faces": [
      "fnt_60e208dc276a1c35fc5b62e94f9fb959"
     ],
     "weight": 900,
     "label": "Big Shoulders Display 900"
    },
    "label": {
     "faces": [
      "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92"
     ],
     "weight": 700,
     "label": "Big Shoulders Text 700"
    },
    "body": {
     "faces": [
      "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
      "fnt_5f86915a744832ecf6e4a17ab04bea09",
      "fnt_7ec97244259db4008c4b1224c7914e53"
     ],
     "weight": 400,
     "label": "Spectral 400/600 + Italic"
    }
   },
   "brand": {
    "logo": null
   }
  },
  "overrides": {
   "schema": "transovo.edit-patch/1",
   "scenes": {}
  },
  "fontRecords": [
   {
    "schema": "transovo.font-record/1",
    "sha256": "60e208dc276a1c35fc5b62e94f9fb959c40c11783a9eb7548175c14b1fbeb720",
    "faceIndex": 0,
    "family": "Big Shoulders Display",
    "subfamily": "Thin",
    "fullName": "Big Shoulders Display Thin",
    "postscriptName": "BigShouldersDisplay-Thin",
    "version": "Version 2.002",
    "weightClass": 100,
    "widthClass": 5,
    "italic": false,
    "axes": [
     {
      "tag": "wght",
      "min": 100,
      "default": 100,
      "max": 900
     }
    ],
    "numGlyphs": 1074,
    "variable": true,
    "coverage": [
     [
      32,
      126
     ],
     [
      160,
      305
     ],
     [
      308,
      328
     ],
     "… 104 more"
    ],
    "codepoints": 718,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://scripts.sil.org/OFL",
    "licenseUrl": "https://scripts.sil.org/OFL",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Big Shoulders Display",
      "glyphsMissingInSample": 0,
      "inkedPx": 254,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 314,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 978,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
    "assetId": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
    "sample": "Aa0Zz"
   },
   {
    "schema": "transovo.font-record/1",
    "sha256": "fce6c5cf4edec9c9dfb3e7a0f60bef927c881eab72ca17d50fddf4b55f334ed5",
    "faceIndex": 0,
    "family": "Big Shoulders Text",
    "subfamily": "Thin",
    "fullName": "Big Shoulders Text Thin",
    "postscriptName": "BigShouldersText-Thin",
    "version": "Version 2.002",
    "weightClass": 100,
    "widthClass": 5,
    "italic": false,
    "axes": [
     {
      "tag": "wght",
      "min": 100,
      "default": 100,
      "max": 900
     }
    ],
    "numGlyphs": 1074,
    "variable": true,
    "coverage": [
     [
      32,
      126
     ],
     [
      160,
      305
     ],
     [
      308,
      328
     ],
     "… 104 more"
    ],
    "codepoints": 718,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://scripts.sil.org/OFL",
    "licenseUrl": "https://scripts.sil.org/OFL",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Big Shoulders Text",
      "glyphsMissingInSample": 0,
      "inkedPx": 570,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 671,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 1197,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
    "assetId": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
    "sample": "Aa0Zz"
   },
   {
    "schema": "transovo.font-record/1",
    "sha256": "c89021dc20720c8d0dcf40b0b2f6e00c13665fa8041717f581396f51b8c78f5d",
    "faceIndex": 0,
    "family": "Spectral",
    "subfamily": "Regular",
    "fullName": "Spectral Regular",
    "postscriptName": "Spectral-Regular",
    "version": "Version 2.005; ttfautohint (v1.8.4.7-5d5b)",
    "weightClass": 400,
    "widthClass": 5,
    "italic": false,
    "axes": [],
    "numGlyphs": 1480,
    "variable": false,
    "coverage": [
     [
      0,
      0
     ],
     [
      13,
      13
     ],
     [
      32,
      126
     ],
     "… 134 more"
    ],
    "codepoints": 878,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org",
    "licenseUrl": "https://openfontlicense.org",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Spectral",
      "glyphsMissingInSample": 0,
      "inkedPx": 1036,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 1168,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 1151,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
    "assetId": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
    "sample": "Aa0Zz"
   },
   "… 3 more"
  ],
  "scenes": [
   {
    "sceneId": "S01",
    "bundle": "bnd_46145680c1dc764bcedc046e95e29b9c",
    "editable": true,
    "themeAware": true,
    "role": "scene",
    "timeline": {
     "startSec": 6.25,
     "endSec": 12,
     "frames": 172
    },
    "clip": {
     "asset": "ast_c5e5885b36a561a72774338d20450e82",
     "renderKey": "rk_95dd65fbf2e76f14d382374e17c140e346a7f5ab",
     "frames": 173,
     "renderedInVersion": 1,
     "origin": "production"
    },
    "preview": {
     "poster": "ast_1b28eb3070d3c35c64bf6582e507445a"
    },
    "narrationRefs": [
     "L01"
    ]
   },
   {
    "sceneId": "S02",
    "bundle": "bnd_94f3ac1a2ad012b6b01161f6c20e2f9c",
    "editable": false,
    "themeAware": false,
    "role": "scene",
    "timeline": {
     "startSec": 12,
     "endSec": 22.35,
     "frames": 311
    },
    "clip": {
     "asset": "ast_02b360a310ca742eb95690e753e4c81d",
     "renderKey": "rk_cc5761ceb9d2b2030e624547a855fdd2b73d44f4",
     "frames": 311,
     "renderedInVersion": 1,
     "origin": "production"
    },
    "preview": {
     "poster": "ast_63a2cb84133032166fde4771505a109f"
    },
    "narrationRefs": []
   },
   {
    "sceneId": "S03",
    "bundle": "bnd_d2d286e683e51dd1ca675cba3f0abd59",
    "editable": false,
    "themeAware": false,
    "role": "scene",
    "timeline": {
     "startSec": 58.354,
     "endSec": 63.491,
     "frames": 154
    },
    "clip": {
     "asset": "ast_0d512005092958ba314683ad46ed0e79",
     "renderKey": "rk_6d8c21ba9de53db396996b312f1766792b2e129e",
     "frames": 154,
     "renderedInVersion": 1,
     "origin": "production"
    },
    "preview": {
     "poster": "ast_5387cb4a5090c7816341b84fd309b6b7"
    },
    "narrationRefs": []
   },
   "… 3 more"
  ],
  "sources": {
   "timeline": "ast_a4c789ec9bc1f22659412240b7025cbd",
   "shots": "ast_13394ac30399d691e12ca10a4df361cb",
   "cues": "ast_7814ec41fb7b8056a0a634d441ce25f0",
   "designTheme": "ast_945f84ff16ba80c8d8f88af90f1a2d0d",
   "faceCenters": "ast_7cac98eb84b64d858187561583f03a6a",
   "narration": {
    "scriptLines": "ast_3b1c66ed2307b21caf5fa94efb7bdc34",
    "words": "ast_b363d5cc9b73cfb7f51406aba84760d5",
    "wordsRaw": "ast_da148e3a8b75f6ca592bc1e9015f84b4",
    "ttsAlignment": "ast_a365506688ea99d93d765f5529e20ebf",
    "ttsRaw": "ast_85852382705db6e2395d42ef52116194",
    "buildAudio": "ast_65259b903dbbbb363cac970e5edb8db0",
    "voice": "ElevenLabs Roger (eleven_flash_v2_5)"
   },
   "mix": "ast_e19db84ed1a148c4dcc3d65ea387d676",
   "mixRaw": "ast_1e86032e2fb1eb8286898d7c861ebe38",
   "unfinishedRevision": {
    "note": "production started a Brian re-voice (20:26 ET) and re-rendered scenes/shots, but never rebuilt the mix or the master; kept as source only",
    "shots": "ast_46fc42e40f26a7ed2bf25f59eb71360a",
    "timeline": "ast_d361f93c3c9ca8ac72bb1f9f3015587c",
    "words": "ast_e2e2420484f87c69379adfb1dcc6bdc9",
    "voice": {
     "timeline.json": "ast_d361f93c3c9ca8ac72bb1f9f3015587c",
     "tts_alignment.json": "ast_4a280671c1273c274074ece000f59e0b",
     "tts_brian.py": "ast_3bbce873034282110703b713d4649c05",
     "tts_raw.mp3": "ast_43e911437304d53bfedd105d2fd89c7c",
     "words_raw.json": "ast_4da3695aad811746507ba23d516dd850",
     "words.json": "ast_e2e2420484f87c69379adfb1dcc6bdc9"
    }
   },
   "stems": {
    "dialog": "ast_bf4e4cdb33f40e175cfc0d57af43a09a",
    "footageAudio": "ast_142303a81aa619a28826ae092eec0e4f",
    "music": "ast_5c94d433b0f7351bc1d56e47f1f6af94",
    "narration": "ast_b22a18e34dbcb092b99d53bfdc8d7dae",
    "sfx": "ast_d4b4e8c4f478a594374e968dd9ea61e6"
   },
   "captions": {
    "interviewVtt": "ast_c5611074a37bb999589d35f0713ac884"
   },
   "transcripts": {
    "int_lines.txt": "ast_31109c3555588abcf939cb052df449ba",
    "tx_6SUDm0BvCGo.mp4.txt": "ast_9aa052934013e577d2d1d9f656e1fa90",
    "tx_int_1040.mp4.txt": "ast_9d986765b103a9328247419be6112ed9",
    "tx_PiUYEF7qNgc.mp4.txt": "ast_99707f8d0f3eaef8b2bab97edbf15f59",
    "tx_R2zet82146c.mp4.txt": "ast_0067c0827e3e43e2c195d632f6afbcf1",
    "tx_xGB2SsPJg34.mp4.txt": "ast_feb5561ae3a112ebaff3b67c0cb44c53"
   },
   "productionScripts": {
    "assemble": "ast_e973ec67065d17a8f2e58cf4db68e84d",
    "timeline": "ast_e9bd118aacda4560505d3b4e164398fa",
    "timelineBrian": "ast_7500825104ce74773f6d8143fce6f20d",
    "renderBrowser": "ast_6e119282e2ca3542ff44a8e88a537744",
    "whisper": "ast_15f773601904a15eeb705cd17b7c4951",
    "retime": "ast_1b3bcece3b74c1991234bb0d7d234d56",
    "sceneTools": {
     "build_shots.py": "ast_f674bec321660c0bee93ebf1149549db",
     "face_center.py": "ast_88d74a478ab40b49136c8ddb28f13333",
     "probe_comp.py": "ast_0606d7b0884c5b79b13697202e82cd11",
     "probe.mjs": "ast_1d892db2a4c891c6151c0325f6f44493"
    }
   },
   "sharedSceneLib": {
    "BigShouldersDisplay[wght].ttf": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
    "BigShouldersText[wght].ttf": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
    "common.css": "ast_de286dc1dce586ccfe03a7b76a34f6c7",
    "common.js": "ast_3da72b3e6597b5f041ff493e5be8e19a",
    "cues.json": "ast_dadf40b3334a9903721dab4bc6b0361d",
    "d3.min.js": "ast_912111098ea99503a6f4967361d2bbdc",
    "gsap.min.js": "ast_3d1bea374ab1b703cc5c4105358eec63",
    "Spectral-ExtraLight.ttf": "fnt_5d852db897fd7ad5ce640a6e88f1cd70",
    "Spectral-Italic.ttf": "fnt_7ec97244259db4008c4b1224c7914e53",
    "Spectral-Regular.ttf": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
    "Spectral-SemiBold.ttf": "fnt_5f86915a744832ecf6e4a17ab04bea09",
    "SplitText.min.js": "ast_7b299a6b26b36fd5ce1c0712f31d6d25",
    "three.core.js": "ast_613e370f76638fdef83926642bf256dc",
    "three.module.js": "ast_104f56145899722094556490d787aae0",
    "words.json": "ast_e2e2420484f87c69379adfb1dcc6bdc9"
   },
   "pageScene": {
    "BigShouldersDisplay[wght].ttf": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
    "BigShouldersText[wght].ttf": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
    "index.html": "ast_8edd590b07c0d78721a7db1db80d5b86",
    "page.png": "ast_a29861ba1b33f46413052f0a36f44b56",
    "Spectral-ExtraLight.ttf": "fnt_5d852db897fd7ad5ce640a6e88f1cd70",
    "Spectral-Italic.ttf": "fnt_7ec97244259db4008c4b1224c7914e53",
    "Spectral-Regular.ttf": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
    "Spectral-SemiBold.ttf": "fnt_5f86915a744832ecf6e4a17ab04bea09"
   },
   "photos": {
    "cover_elnino.jpg": "ast_0884589688baeab2bc5c9959f43ee7c7",
    "cover_tmbt.jpg": "ast_a1f29ba35ebe053663d12d50bbcb5264",
    "km_2023.png": "ast_fc58f5e97e9403f78e024f0c7df8fb83",
    "single_tmbt.jpg": "ast_8d75c9980d8957c1222785c52c8b64e3",
    "web_01.img": "ast_f85653c57dcb0a7d8e93ed7489d2332b",
    "web_02.img": "ast_cd31bbd4981365be959426648825c3b3",
    "web_03.img": "ast_fd32b9dae2385591c093ec3eb7aca950",
    "web_04.img": "ast_4e0602fd1ccdfff94c82789209625008",
    "web_06.img": "ast_70d2a88063e64b8d37e8a4240d84bef8",
    "web_07.img": "ast_8a239d117cd9863dd2c21e703e6a93be",
    "web_08.img": "ast_65917e18ee109a56ea68213c421b7523",
    "web_10.img": "ast_dce5236d36ecb8fd8a903872081f7fc5",
    "web_11.img": "ast_3de93400dabb116658365275eadf1b61",
    "web_12.img": "ast_394471bc2d0d56f02bced624ab12b670",
    "web_13.img": "ast_0a96e3644b32dd391367962ebc6ce0d5",
    "web_14.img": "ast_a7cc86300797317f76dbe5039e72274f",
    "web_15.img": "ast_fe1a64dd2134a2f11405038df8f01222",
    "web_17.img": "ast_19846ad9e2f676170565862b5c28098e",
    "web_18.img": "ast_5121c9c36929999186def348c7b71475",
    "web_19.img": "ast_f244ec17c47cd41734eaf596d4833219",
    "web_21.img": "ast_7074d9ed98309a83bc29ce83b7cf204a",
    "web_22.img": "ast_ba07e7c93448b24d7fc044734631a27e",
    "web_24.img": "ast_9362d7499cb88c46faf25a5b73d72dbc",
    "web_26.img": "ast_bfc11ca58b12ecd611fa95ab85497561",
    "web_27.img": "ast_43614758e886ce8129a6388355423512",
    "web_28.img": "ast_1ed5c030cb54cbe371cbee09b608ec14",
    "web_35.img": "ast_aada4bf1d3dedd62a9878cfa4606f484",
    "web_36.img": "ast_4b3edbfb2c3d89cbd2c58c5840aa8a64"
   },
   "cutouts": {
    "km_cut.png": "ast_6a8e823621085823081ce0cde4e92a8c",
    "km21_check.jpg": "ast_2248d7f876a38da11fa5e9cdb7aeda7b",
    "km21_cut.png": "ast_8336cf753ec7523f34c083499a233836",
    "km21.png": "ast_9595c69e653b86c4a4948f408c860ca9"
   },
   "footage": {
    "raw": {
     "6SUDm0BvCGo": "ast_cf5dd6f7f7982bb3c1f07bdbf80eab9a",
     "int_1040": "ast_d796aa730464713b440a86a159547383",
     "PiUYEF7qNgc": "ast_7559217aecceaa06a9d87b95c29328a2",
     "cJJy7w6Ypdc": "ast_2a71997214b768ea5777f083ae17d2ce",
     "R2zet82146c": "ast_70e4d2a70f669bad9c05ff890945a64a",
     "gxoCloGxH1g": "ast_ad4194c8688b9ee1acbf4e271f309f38",
     "…": "1 more keys"
    },
    "extracted": {
     "SH01": "ast_67e2315133c7ad4ad134bd780927e6e8",
     "SH04a": "ast_a564111313ebc748488d426900304f83",
     "SH04b": "ast_0ebee7d6d210e4294fb988b30194c9fb",
     "SH05": "ast_f448115f48ddf6356f1abf6efee35a52",
     "SH06a": "ast_fec01429b24b5c0af1297ab11cdb772f",
     "SH06b": "ast_04dfef10b57d4ed0e1d2d923d0dba94a",
     "…": "17 more keys"
    }
   },
   "qa": {
    "contact_sheet.jpg": "ast_f9dc62ed524689e9fdf8d6445a4b6ba8",
    "detail.jpg": "ast_29f6d3d1716c8cb9782d0082f5e284e6",
    "f_102.png": "ast_cc97e21cd97a061250095cadc413bada",
    "f_113.png": "ast_210992bf7f5506b051026f77d8569f4a",
    "f_123.5.png": "ast_6d6db9b4f5adb1c062b8eec089fea7b9",
    "f_20.png": "ast_d8bb7276788734ac1e185b15327895de",
    "f_31.5.png": "ast_5a718202d8005be6b8accee172f6ee91",
    "f_36.png": "ast_d699001f351469ed123bb112a2a7235d",
    "f_41.png": "ast_07205bcb8f19820c1f5043209b050e0d",
    "f_61.png": "ast_3b36f724bfd03e75f9fe0deb75a7e8f8",
    "f_79.png": "ast_f89932830332953a0ccf2ab2ef2cfb2a",
    "f_92.png": "ast_e623f58dc993c0d790cc94d4116a1fae",
    "f_98.png": "ast_705523f42398d1588fd6a57c921f844c",
    "q_107.png": "ast_49deea853e1dc5d90b41e9aba4fbf9b3"
   }
  },
  "runtimeLock": "ast_01eec89893bab22af42e3906002bc000",
  "validation": {
   "status": "ok",
   "issues": []
  },
  "master": {
   "recipe": "ast_353c03ffd6e9c44d8d60194091816c01",
   "asset": "ast_a6807ff5b615625e95f660ee419693f5",
   "renderKey": "mk_4e4a6c4e4259c6f17841750e815bea8bded3a413",
   "renderedInVersion": 1,
   "origin": "production",
   "encode": {
    "note": "production final (x264 2-pass 1150k)"
   }
  },
  "assetRefs": [
   "ast_0067c0827e3e43e2c195d632f6afbcf1",
   "ast_01eec89893bab22af42e3906002bc000",
   "ast_0264386738fe93fbbf4d1056ac5c5ed7",
   "… 154 more"
  ]
 }
}
```
```json
409
{
 "error": "version_conflict",
 "head": 1
}
```

### Read a version

```http
GET /api/motion-studio/projects/api_demo/versions/1
Authorization: Bearer <job token>
```
```json
200
{
 "schema": "transovo.motion-project/1",
 "projectId": "api_demo",
 "version": 1,
 "parentVersion": null,
 "title": "Keith Murray: 2-minute documentary",
 "createdAt": "2026-11-17T15:33:06.533Z",
 "createdBy": {
  "mode": "import",
  "jobId": "msaj_<id>",
  "workerId": "importer"
 },
 "changes": [
  {
   "type": "import",
   "note": "finished production imported; S01 + S05 parameterized (editable), other scenes reused as rendered clips"
  }
 ],
 "format": {
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "durationSec": 125.3
 },
 "theme": {
  "schema": "transovo.motion-theme/1",
  "themeId": "thm_lexicon",
  "origin": {
   "designedBy": "grokbot",
   "concept": "The Lexicon",
   "designFile": "scenes/theme.json"
  },
  "colors": {
   "background": {
    "value": "#07170F",
    "label": "Background",
    "designName": "deep"
   },
   "primary": {
    "value": "#0E2A22",
    "label": "Primary (page / surface)",
    "designName": "pine"
   },
   "secondary": {
    "value": "#C8462C",
    "label": "Secondary (stamps, years)",
    "designName": "brick"
   },
   "accent": {
    "value": "#D4F03C",
    "label": "Accent (highlights, lamp)",
    "designName": "lime"
   },
   "text": {
    "value": "#EFE7D6",
    "label": "Text / paper",
    "designName": "bone"
   }
  },
  "fonts": {
   "display": {
    "faces": [
     "fnt_60e208dc276a1c35fc5b62e94f9fb959"
    ],
    "weight": 900,
    "label": "Big Shoulders Display 900"
   },
   "label": {
    "faces": [
     "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92"
    ],
    "weight": 700,
    "label": "Big Shoulders Text 700"
   },
   "body": {
    "faces": [
     "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
     "fnt_5f86915a744832ecf6e4a17ab04bea09",
     "fnt_7ec97244259db4008c4b1224c7914e53"
    ],
    "weight": 400,
    "label": "Spectral 400/600 + Italic"
   }
  },
  "brand": {
   "logo": null
  }
 },
 "overrides": {
  "schema": "transovo.edit-patch/1",
  "scenes": {}
 },
 "fontRecords": [
  {
   "schema": "transovo.font-record/1",
   "sha256": "60e208dc276a1c35fc5b62e94f9fb959c40c11783a9eb7548175c14b1fbeb720",
   "faceIndex": 0,
   "family": "Big Shoulders Display",
   "subfamily": "Thin",
   "fullName": "Big Shoulders Display Thin",
   "postscriptName": "BigShouldersDisplay-Thin",
   "version": "Version 2.002",
   "weightClass": 100,
   "widthClass": 5,
   "italic": false,
   "axes": [
    {
     "tag": "wght",
     "min": 100,
     "default": 100,
     "max": 900
    }
   ],
   "numGlyphs": 1074,
   "variable": true,
   "coverage": [
    [
     32,
     126
    ],
    [
     160,
     305
    ],
    [
     308,
     328
    ],
    "… 104 more"
   ],
   "codepoints": 718,
   "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://scripts.sil.org/OFL",
   "licenseUrl": "https://scripts.sil.org/OFL",
   "fsType": 0,
   "engines": {
    "skia-python": {
     "ok": true,
     "family": "Big Shoulders Display",
     "glyphsMissingInSample": 0,
     "inkedPx": 254,
     "engineVersion": "skia-python 144.1"
    },
    "pil": {
     "ok": true,
     "inkedPx": 314,
     "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
    },
    "browser": {
     "ok": true,
     "inkedPx": 978,
     "engineVersion": "Chrome/156.0.8078.47"
    },
    "canvaskit": {
     "ok": true,
     "engineVersion": "canvaskit-wasm 0.42.0"
    },
    "ffmpeg-drawtext": {
     "ok": true,
     "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
    }
   },
   "fontId": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
   "assetId": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
   "sample": "Aa0Zz"
  },
  {
   "schema": "transovo.font-record/1",
   "sha256": "fce6c5cf4edec9c9dfb3e7a0f60bef927c881eab72ca17d50fddf4b55f334ed5",
   "faceIndex": 0,
   "family": "Big Shoulders Text",
   "subfamily": "Thin",
   "fullName": "Big Shoulders Text Thin",
   "postscriptName": "BigShouldersText-Thin",
   "version": "Version 2.002",
   "weightClass": 100,
   "widthClass": 5,
   "italic": false,
   "axes": [
    {
     "tag": "wght",
     "min": 100,
     "default": 100,
     "max": 900
    }
   ],
   "numGlyphs": 1074,
   "variable": true,
   "coverage": [
    [
     32,
     126
    ],
    [
     160,
     305
    ],
    [
     308,
     328
    ],
    "… 104 more"
   ],
   "codepoints": 718,
   "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://scripts.sil.org/OFL",
   "licenseUrl": "https://scripts.sil.org/OFL",
   "fsType": 0,
   "engines": {
    "skia-python": {
     "ok": true,
     "family": "Big Shoulders Text",
     "glyphsMissingInSample": 0,
     "inkedPx": 570,
     "engineVersion": "skia-python 144.1"
    },
    "pil": {
     "ok": true,
     "inkedPx": 671,
     "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
    },
    "browser": {
     "ok": true,
     "inkedPx": 1197,
     "engineVersion": "Chrome/156.0.8078.47"
    },
    "canvaskit": {
     "ok": true,
     "engineVersion": "canvaskit-wasm 0.42.0"
    },
    "ffmpeg-drawtext": {
     "ok": true,
     "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
    }
   },
   "fontId": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
   "assetId": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
   "sample": "Aa0Zz"
  },
  {
   "schema": "transovo.font-record/1",
   "sha256": "c89021dc20720c8d0dcf40b0b2f6e00c13665fa8041717f581396f51b8c78f5d",
   "faceIndex": 0,
   "family": "Spectral",
   "subfamily": "Regular",
   "fullName": "Spectral Regular",
   "postscriptName": "Spectral-Regular",
   "version": "Version 2.005; ttfautohint (v1.8.4.7-5d5b)",
   "weightClass": 400,
   "widthClass": 5,
   "italic": false,
   "axes": [],
   "numGlyphs": 1480,
   "variable": false,
   "coverage": [
    [
     0,
     0
    ],
    [
     13,
     13
    ],
    [
     32,
     126
    ],
    "… 134 more"
   ],
   "codepoints": 878,
   "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org",
   "licenseUrl": "https://openfontlicense.org",
   "fsType": 0,
   "engines": {
    "skia-python": {
     "ok": true,
     "family": "Spectral",
     "glyphsMissingInSample": 0,
     "inkedPx": 1036,
     "engineVersion": "skia-python 144.1"
    },
    "pil": {
     "ok": true,
     "inkedPx": 1168,
     "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
    },
    "browser": {
     "ok": true,
     "inkedPx": 1151,
     "engineVersion": "Chrome/156.0.8078.47"
    },
    "canvaskit": {
     "ok": true,
     "engineVersion": "canvaskit-wasm 0.42.0"
    },
    "ffmpeg-drawtext": {
     "ok": true,
     "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
    }
   },
   "fontId": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
   "assetId": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
   "sample": "Aa0Zz"
  },
  "… 3 more"
 ],
 "scenes": [
  {
   "sceneId": "S01",
   "bundle": "bnd_46145680c1dc764bcedc046e95e29b9c",
   "editable": true,
   "themeAware": true,
   "role": "scene",
   "timeline": {
    "startSec": 6.25,
    "endSec": 12,
    "frames": 172
   },
   "clip": {
    "asset": "ast_c5e5885b36a561a72774338d20450e82",
    "renderKey": "rk_95dd65fbf2e76f14d382374e17c140e346a7f5ab",
    "frames": 173,
    "renderedInVersion": 1,
    "origin": "production"
   },
   "preview": {
    "poster": "ast_1b28eb3070d3c35c64bf6582e507445a"
   },
   "narrationRefs": [
    "L01"
   ]
  },
  {
   "sceneId": "S02",
   "bundle": "bnd_94f3ac1a2ad012b6b01161f6c20e2f9c",
   "editable": false,
   "themeAware": false,
   "role": "scene",
   "timeline": {
    "startSec": 12,
    "endSec": 22.35,
    "frames": 311
   },
   "clip": {
    "asset": "ast_02b360a310ca742eb95690e753e4c81d",
    "renderKey": "rk_cc5761ceb9d2b2030e624547a855fdd2b73d44f4",
    "frames": 311,
    "renderedInVersion": 1,
    "origin": "production"
   },
   "preview": {
    "poster": "ast_63a2cb84133032166fde4771505a109f"
   },
   "narrationRefs": []
  },
  {
   "sceneId": "S03",
   "bundle": "bnd_d2d286e683e51dd1ca675cba3f0abd59",
   "editable": false,
   "themeAware": false,
   "role": "scene",
   "timeline": {
    "startSec": 58.354,
    "endSec": 63.491,
    "frames": 154
   },
   "clip": {
    "asset": "ast_0d512005092958ba314683ad46ed0e79",
    "renderKey": "rk_6d8c21ba9de53db396996b312f1766792b2e129e",
    "frames": 154,
    "renderedInVersion": 1,
    "origin": "production"
   },
   "preview": {
    "poster": "ast_5387cb4a5090c7816341b84fd309b6b7"
   },
   "narrationRefs": []
  },
  "… 3 more"
 ],
 "sources": {
  "timeline": "ast_a4c789ec9bc1f22659412240b7025cbd",
  "shots": "ast_13394ac30399d691e12ca10a4df361cb",
  "cues": "ast_7814ec41fb7b8056a0a634d441ce25f0",
  "designTheme": "ast_945f84ff16ba80c8d8f88af90f1a2d0d",
  "faceCenters": "ast_7cac98eb84b64d858187561583f03a6a",
  "narration": {
   "scriptLines": "ast_3b1c66ed2307b21caf5fa94efb7bdc34",
   "words": "ast_b363d5cc9b73cfb7f51406aba84760d5",
   "wordsRaw": "ast_da148e3a8b75f6ca592bc1e9015f84b4",
   "ttsAlignment": "ast_a365506688ea99d93d765f5529e20ebf",
   "ttsRaw": "ast_85852382705db6e2395d42ef52116194",
   "buildAudio": "ast_65259b903dbbbb363cac970e5edb8db0",
   "voice": "ElevenLabs Roger (eleven_flash_v2_5)"
  },
  "mix": "ast_e19db84ed1a148c4dcc3d65ea387d676",
  "mixRaw": "ast_1e86032e2fb1eb8286898d7c861ebe38",
  "unfinishedRevision": {
   "note": "production started a Brian re-voice (20:26 ET) and re-rendered scenes/shots, but never rebuilt the mix or the master; kept as source only",
   "shots": "ast_46fc42e40f26a7ed2bf25f59eb71360a",
   "timeline": "ast_d361f93c3c9ca8ac72bb1f9f3015587c",
   "words": "ast_e2e2420484f87c69379adfb1dcc6bdc9",
   "voice": {
    "timeline.json": "ast_d361f93c3c9ca8ac72bb1f9f3015587c",
    "tts_alignment.json": "ast_4a280671c1273c274074ece000f59e0b",
    "tts_brian.py": "ast_3bbce873034282110703b713d4649c05",
    "tts_raw.mp3": "ast_43e911437304d53bfedd105d2fd89c7c",
    "words_raw.json": "ast_4da3695aad811746507ba23d516dd850",
    "words.json": "ast_e2e2420484f87c69379adfb1dcc6bdc9"
   }
  },
  "stems": {
   "dialog": "ast_bf4e4cdb33f40e175cfc0d57af43a09a",
   "footageAudio": "ast_142303a81aa619a28826ae092eec0e4f",
   "music": "ast_5c94d433b0f7351bc1d56e47f1f6af94",
   "narration": "ast_b22a18e34dbcb092b99d53bfdc8d7dae",
   "sfx": "ast_d4b4e8c4f478a594374e968dd9ea61e6"
  },
  "captions": {
   "interviewVtt": "ast_c5611074a37bb999589d35f0713ac884"
  },
  "transcripts": {
   "int_lines.txt": "ast_31109c3555588abcf939cb052df449ba",
   "tx_6SUDm0BvCGo.mp4.txt": "ast_9aa052934013e577d2d1d9f656e1fa90",
   "tx_int_1040.mp4.txt": "ast_9d986765b103a9328247419be6112ed9",
   "tx_PiUYEF7qNgc.mp4.txt": "ast_99707f8d0f3eaef8b2bab97edbf15f59",
   "tx_R2zet82146c.mp4.txt": "ast_0067c0827e3e43e2c195d632f6afbcf1",
   "tx_xGB2SsPJg34.mp4.txt": "ast_feb5561ae3a112ebaff3b67c0cb44c53"
  },
  "productionScripts": {
   "assemble": "ast_e973ec67065d17a8f2e58cf4db68e84d",
   "timeline": "ast_e9bd118aacda4560505d3b4e164398fa",
   "timelineBrian": "ast_7500825104ce74773f6d8143fce6f20d",
   "renderBrowser": "ast_6e119282e2ca3542ff44a8e88a537744",
   "whisper": "ast_15f773601904a15eeb705cd17b7c4951",
   "retime": "ast_1b3bcece3b74c1991234bb0d7d234d56",
   "sceneTools": {
    "build_shots.py": "ast_f674bec321660c0bee93ebf1149549db",
    "face_center.py": "ast_88d74a478ab40b49136c8ddb28f13333",
    "probe_comp.py": "ast_0606d7b0884c5b79b13697202e82cd11",
    "probe.mjs": "ast_1d892db2a4c891c6151c0325f6f44493"
   }
  },
  "sharedSceneLib": {
   "BigShouldersDisplay[wght].ttf": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
   "BigShouldersText[wght].ttf": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
   "common.css": "ast_de286dc1dce586ccfe03a7b76a34f6c7",
   "common.js": "ast_3da72b3e6597b5f041ff493e5be8e19a",
   "cues.json": "ast_dadf40b3334a9903721dab4bc6b0361d",
   "d3.min.js": "ast_912111098ea99503a6f4967361d2bbdc",
   "gsap.min.js": "ast_3d1bea374ab1b703cc5c4105358eec63",
   "Spectral-ExtraLight.ttf": "fnt_5d852db897fd7ad5ce640a6e88f1cd70",
   "Spectral-Italic.ttf": "fnt_7ec97244259db4008c4b1224c7914e53",
   "Spectral-Regular.ttf": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
   "Spectral-SemiBold.ttf": "fnt_5f86915a744832ecf6e4a17ab04bea09",
   "SplitText.min.js": "ast_7b299a6b26b36fd5ce1c0712f31d6d25",
   "three.core.js": "ast_613e370f76638fdef83926642bf256dc",
   "three.module.js": "ast_104f56145899722094556490d787aae0",
   "words.json": "ast_e2e2420484f87c69379adfb1dcc6bdc9"
  },
  "pageScene": {
   "BigShouldersDisplay[wght].ttf": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
   "BigShouldersText[wght].ttf": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
   "index.html": "ast_8edd590b07c0d78721a7db1db80d5b86",
   "page.png": "ast_a29861ba1b33f46413052f0a36f44b56",
   "Spectral-ExtraLight.ttf": "fnt_5d852db897fd7ad5ce640a6e88f1cd70",
   "Spectral-Italic.ttf": "fnt_7ec97244259db4008c4b1224c7914e53",
   "Spectral-Regular.ttf": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
   "Spectral-SemiBold.ttf": "fnt_5f86915a744832ecf6e4a17ab04bea09"
  },
  "photos": {
   "cover_elnino.jpg": "ast_0884589688baeab2bc5c9959f43ee7c7",
   "cover_tmbt.jpg": "ast_a1f29ba35ebe053663d12d50bbcb5264",
   "km_2023.png": "ast_fc58f5e97e9403f78e024f0c7df8fb83",
   "single_tmbt.jpg": "ast_8d75c9980d8957c1222785c52c8b64e3",
   "web_01.img": "ast_f85653c57dcb0a7d8e93ed7489d2332b",
   "web_02.img": "ast_cd31bbd4981365be959426648825c3b3",
   "web_03.img": "ast_fd32b9dae2385591c093ec3eb7aca950",
   "web_04.img": "ast_4e0602fd1ccdfff94c82789209625008",
   "web_06.img": "ast_70d2a88063e64b8d37e8a4240d84bef8",
   "web_07.img": "ast_8a239d117cd9863dd2c21e703e6a93be",
   "web_08.img": "ast_65917e18ee109a56ea68213c421b7523",
   "web_10.img": "ast_dce5236d36ecb8fd8a903872081f7fc5",
   "web_11.img": "ast_3de93400dabb116658365275eadf1b61",
   "web_12.img": "ast_394471bc2d0d56f02bced624ab12b670",
   "web_13.img": "ast_0a96e3644b32dd391367962ebc6ce0d5",
   "web_14.img": "ast_a7cc86300797317f76dbe5039e72274f",
   "web_15.img": "ast_fe1a64dd2134a2f11405038df8f01222",
   "web_17.img": "ast_19846ad9e2f676170565862b5c28098e",
   "web_18.img": "ast_5121c9c36929999186def348c7b71475",
   "web_19.img": "ast_f244ec17c47cd41734eaf596d4833219",
   "web_21.img": "ast_7074d9ed98309a83bc29ce83b7cf204a",
   "web_22.img": "ast_ba07e7c93448b24d7fc044734631a27e",
   "web_24.img": "ast_9362d7499cb88c46faf25a5b73d72dbc",
   "web_26.img": "ast_bfc11ca58b12ecd611fa95ab85497561",
   "web_27.img": "ast_43614758e886ce8129a6388355423512",
   "web_28.img": "ast_1ed5c030cb54cbe371cbee09b608ec14",
   "web_35.img": "ast_aada4bf1d3dedd62a9878cfa4606f484",
   "web_36.img": "ast_4b3edbfb2c3d89cbd2c58c5840aa8a64"
  },
  "cutouts": {
   "km_cut.png": "ast_6a8e823621085823081ce0cde4e92a8c",
   "km21_check.jpg": "ast_2248d7f876a38da11fa5e9cdb7aeda7b",
   "km21_cut.png": "ast_8336cf753ec7523f34c083499a233836",
   "km21.png": "ast_9595c69e653b86c4a4948f408c860ca9"
  },
  "footage": {
   "raw": {
    "6SUDm0BvCGo": "ast_cf5dd6f7f7982bb3c1f07bdbf80eab9a",
    "int_1040": "ast_d796aa730464713b440a86a159547383",
    "PiUYEF7qNgc": "ast_7559217aecceaa06a9d87b95c29328a2",
    "cJJy7w6Ypdc": "ast_2a71997214b768ea5777f083ae17d2ce",
    "R2zet82146c": "ast_70e4d2a70f669bad9c05ff890945a64a",
    "gxoCloGxH1g": "ast_ad4194c8688b9ee1acbf4e271f309f38",
    "xGB2SsPJg34": "ast_2ea0459f3b374ff49f36dbfced038cc3"
   },
   "extracted": {
    "SH01": "ast_67e2315133c7ad4ad134bd780927e6e8",
    "SH04a": "ast_a564111313ebc748488d426900304f83",
    "SH04b": "ast_0ebee7d6d210e4294fb988b30194c9fb",
    "SH05": "ast_f448115f48ddf6356f1abf6efee35a52",
    "SH06a": "ast_fec01429b24b5c0af1297ab11cdb772f",
    "SH06b": "ast_04dfef10b57d4ed0e1d2d923d0dba94a",
    "SH07": "ast_b5f188be919aea698c816ff9a39a9e6e",
    "SH08a": "ast_3158b90bc49d78210bfff84bc774b049",
    "SH08b": "ast_fb4260429201daea511caad23876363d",
    "SH10a": "ast_9dbd02d6a43c806fd81880a8814e7da4",
    "SH10b": "ast_20c24d3ecf61a4dab0ac5f6eb1f1355a",
    "SH11a": "ast_89736c4fe7472c22dddc31b10f582ef1",
    "SH11b": "ast_76dee47c053179e5d73d7551ee64671a",
    "SH12a": "ast_f69ac6d7bcc7eb82579e4234ba21e77f",
    "SH12b": "ast_ac806c8352f1ea54e86c0656d7f680d1",
    "SH13": "ast_ff5a334ab172a172eb7aa83bb5f3151a",
    "SH15": "ast_7cdbcff7a4749914de123e01a65e8232",
    "SH16a": "ast_950b01eed4c4e4da60dfd0ecfc259014",
    "SH16b": "ast_607318f0d194e2135c316b7b72a8687a",
    "SH17": "ast_764cc751e6678c61d901930afafca1a1",
    "SH18a": "ast_5505940514ac19f6aec62d8c168e324a",
    "SH18b": "ast_0264386738fe93fbbf4d1056ac5c5ed7",
    "SH19": "ast_893e24106bfa1b46a8c8c47bb955e556"
   }
  },
  "qa": {
   "contact_sheet.jpg": "ast_f9dc62ed524689e9fdf8d6445a4b6ba8",
   "detail.jpg": "ast_29f6d3d1716c8cb9782d0082f5e284e6",
   "f_102.png": "ast_cc97e21cd97a061250095cadc413bada",
   "f_113.png": "ast_210992bf7f5506b051026f77d8569f4a",
   "f_123.5.png": "ast_6d6db9b4f5adb1c062b8eec089fea7b9",
   "f_20.png": "ast_d8bb7276788734ac1e185b15327895de",
   "f_31.5.png": "ast_5a718202d8005be6b8accee172f6ee91",
   "f_36.png": "ast_d699001f351469ed123bb112a2a7235d",
   "f_41.png": "ast_07205bcb8f19820c1f5043209b050e0d",
   "f_61.png": "ast_3b36f724bfd03e75f9fe0deb75a7e8f8",
   "f_79.png": "ast_f89932830332953a0ccf2ab2ef2cfb2a",
   "f_92.png": "ast_e623f58dc993c0d790cc94d4116a1fae",
   "f_98.png": "ast_705523f42398d1588fd6a57c921f844c",
   "q_107.png": "ast_49deea853e1dc5d90b41e9aba4fbf9b3"
  }
 },
 "runtimeLock": "ast_01eec89893bab22af42e3906002bc000",
 "validation": {
  "status": "ok",
  "issues": []
 },
 "master": {
  "recipe": "ast_353c03ffd6e9c44d8d60194091816c01",
  "asset": "ast_a6807ff5b615625e95f660ee419693f5",
  "renderKey": "mk_4e4a6c4e4259c6f17841750e815bea8bded3a413",
  "renderedInVersion": 1,
  "origin": "production",
  "encode": {
   "note": "production final (x264 2-pass 1150k)"
  }
 },
 "assetRefs": [
  "ast_0067c0827e3e43e2c195d632f6afbcf1",
  "ast_01eec89893bab22af42e3906002bc000",
  "ast_0264386738fe93fbbf4d1056ac5c5ed7",
  "… 154 more"
 ]
}
```

### Editor: open a live preview session for one scene

```http
POST /api/motion-studio/projects/api_demo/versions/1/scenes/S01/session
Authorization: Bearer <job token>
Content-Type: application/json

{}
```
```json
200
{
 "sceneUrl": "http://127.0.0.1:8787/_scene/bnd_46145680c1dc764bcedc046e95e29b9c/<exp>/<sig>/index.html",
 "sceneOrigin": "http://127.0.0.1:8787",
 "expiresAt": "2026-11-17T16:35:25.000Z",
 "livePreview": "live",
 "host": {
  "theme": {
   "schema": "transovo.motion-theme/1",
   "themeId": "thm_lexicon",
   "origin": {
    "designedBy": "grokbot",
    "concept": "The Lexicon",
    "designFile": "scenes/theme.json"
   },
   "colors": {
    "background": {
     "value": "#07170F",
     "label": "Background",
     "designName": "deep"
    },
    "primary": {
     "value": "#0E2A22",
     "label": "Primary (page / surface)",
     "designName": "pine"
    },
    "secondary": {
     "value": "#C8462C",
     "label": "Secondary (stamps, years)",
     "designName": "brick"
    },
    "accent": {
     "value": "#D4F03C",
     "label": "Accent (highlights, lamp)",
     "designName": "lime"
    },
    "text": {
     "value": "#EFE7D6",
     "label": "Text / paper",
     "designName": "bone"
    }
   },
   "fonts": {
    "display": {
     "faces": [
      "fnt_60e208dc276a1c35fc5b62e94f9fb959"
     ],
     "weight": 900,
     "label": "Big Shoulders Display 900"
    },
    "label": {
     "faces": [
      "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92"
     ],
     "weight": 700,
     "label": "Big Shoulders Text 700"
    },
    "body": {
     "faces": [
      "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
      "fnt_5f86915a744832ecf6e4a17ab04bea09",
      "fnt_7ec97244259db4008c4b1224c7914e53"
     ],
     "weight": 400,
     "label": "Spectral 400/600 + Italic"
    }
   },
   "brand": {
    "logo": null
   }
  },
  "overrides": {
   "schema": "transovo.edit-patch/1",
   "scenes": {}
  },
  "assetUrls": {
   "ast_4e0602fd1ccdfff94c82789209625008": "http://127.0.0.1:8787/_blob/ast_4e0602fd1ccdfff94c82789209625008?exp=1794933325&sig=<sig>",
   "fnt_60e208dc276a1c35fc5b62e94f9fb959": "http://127.0.0.1:8787/_blob/fnt_60e208dc276a1c35fc5b62e94f9fb959?exp=1794933325&sig=<sig>",
   "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92": "http://127.0.0.1:8787/_blob/fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92?exp=1794933325&sig=<sig>",
   "fnt_c89021dc20720c8d0dcf40b0b2f6e00c": "http://127.0.0.1:8787/_blob/fnt_c89021dc20720c8d0dcf40b0b2f6e00c?exp=1794933325&sig=<sig>",
   "fnt_5f86915a744832ecf6e4a17ab04bea09": "http://127.0.0.1:8787/_blob/fnt_5f86915a744832ecf6e4a17ab04bea09?exp=1794933325&sig=<sig>",
   "fnt_7ec97244259db4008c4b1224c7914e53": "http://127.0.0.1:8787/_blob/fnt_7ec97244259db4008c4b1224c7914e53?exp=1794933325&sig=<sig>"
  },
  "assets": {
   "ast_4e0602fd1ccdfff94c82789209625008": {
    "mime": "image/jpeg",
    "bytes": 26232,
    "width": 480,
    "height": 360,
    "meta": {
     "width": 480,
     "height": 360
    }
   },
   "fnt_60e208dc276a1c35fc5b62e94f9fb959": {
    "mime": "font/ttf",
    "bytes": 219532,
    "meta": {}
   },
   "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92": {
    "mime": "font/ttf",
    "bytes": 218416,
    "meta": {}
   },
   "fnt_c89021dc20720c8d0dcf40b0b2f6e00c": {
    "mime": "font/ttf",
    "bytes": 261088,
    "meta": {}
   },
   "fnt_5f86915a744832ecf6e4a17ab04bea09": {
    "mime": "font/ttf",
    "bytes": 273068,
    "meta": {}
   },
   "fnt_7ec97244259db4008c4b1224c7914e53": {
    "mime": "font/ttf",
    "bytes": 270468,
    "meta": {}
   }
  },
  "fonts": {
   "fnt_60e208dc276a1c35fc5b62e94f9fb959": {
    "schema": "transovo.font-record/1",
    "sha256": "60e208dc276a1c35fc5b62e94f9fb959c40c11783a9eb7548175c14b1fbeb720",
    "faceIndex": 0,
    "family": "Big Shoulders Display",
    "subfamily": "Thin",
    "fullName": "Big Shoulders Display Thin",
    "postscriptName": "BigShouldersDisplay-Thin",
    "version": "Version 2.002",
    "weightClass": 100,
    "widthClass": 5,
    "italic": false,
    "axes": [
     {
      "tag": "wght",
      "min": 100,
      "default": 100,
      "max": 900
     }
    ],
    "numGlyphs": 1074,
    "variable": true,
    "coverage": [
     [
      32,
      126
     ],
     [
      160,
      305
     ],
     [
      308,
      328
     ],
     "… 104 more"
    ],
    "codepoints": 718,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://scripts.sil.org/OFL",
    "licenseUrl": "https://scripts.sil.org/OFL",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Big Shoulders Display",
      "glyphsMissingInSample": 0,
      "inkedPx": 254,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 314,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 978,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
    "assetId": "fnt_60e208dc276a1c35fc5b62e94f9fb959",
    "sample": "Aa0Zz"
   },
   "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92": {
    "schema": "transovo.font-record/1",
    "sha256": "fce6c5cf4edec9c9dfb3e7a0f60bef927c881eab72ca17d50fddf4b55f334ed5",
    "faceIndex": 0,
    "family": "Big Shoulders Text",
    "subfamily": "Thin",
    "fullName": "Big Shoulders Text Thin",
    "postscriptName": "BigShouldersText-Thin",
    "version": "Version 2.002",
    "weightClass": 100,
    "widthClass": 5,
    "italic": false,
    "axes": [
     {
      "tag": "wght",
      "min": 100,
      "default": 100,
      "max": 900
     }
    ],
    "numGlyphs": 1074,
    "variable": true,
    "coverage": [
     [
      32,
      126
     ],
     [
      160,
      305
     ],
     [
      308,
      328
     ],
     "… 104 more"
    ],
    "codepoints": 718,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://scripts.sil.org/OFL",
    "licenseUrl": "https://scripts.sil.org/OFL",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Big Shoulders Text",
      "glyphsMissingInSample": 0,
      "inkedPx": 570,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 671,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 1197,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
    "assetId": "fnt_fce6c5cf4edec9c9dfb3e7a0f60bef92",
    "sample": "Aa0Zz"
   },
   "fnt_c89021dc20720c8d0dcf40b0b2f6e00c": {
    "schema": "transovo.font-record/1",
    "sha256": "c89021dc20720c8d0dcf40b0b2f6e00c13665fa8041717f581396f51b8c78f5d",
    "faceIndex": 0,
    "family": "Spectral",
    "subfamily": "Regular",
    "fullName": "Spectral Regular",
    "postscriptName": "Spectral-Regular",
    "version": "Version 2.005; ttfautohint (v1.8.4.7-5d5b)",
    "weightClass": 400,
    "widthClass": 5,
    "italic": false,
    "axes": [],
    "numGlyphs": 1480,
    "variable": false,
    "coverage": [
     [
      0,
      0
     ],
     [
      13,
      13
     ],
     [
      32,
      126
     ],
     "… 134 more"
    ],
    "codepoints": 878,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org",
    "licenseUrl": "https://openfontlicense.org",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Spectral",
      "glyphsMissingInSample": 0,
      "inkedPx": 1036,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 1168,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 1151,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
    "assetId": "fnt_c89021dc20720c8d0dcf40b0b2f6e00c",
    "sample": "Aa0Zz"
   },
   "fnt_5f86915a744832ecf6e4a17ab04bea09": {
    "schema": "transovo.font-record/1",
    "sha256": "5f86915a744832ecf6e4a17ab04bea091b9fa992ef5164ff65ae34c1da2fe94b",
    "faceIndex": 0,
    "family": "Spectral",
    "subfamily": "SemiBold",
    "fullName": "Spectral SemiBold",
    "postscriptName": "Spectral-SemiBold",
    "version": "Version 2.005; ttfautohint (v1.8.4.7-5d5b)",
    "weightClass": 600,
    "widthClass": 5,
    "italic": false,
    "axes": [],
    "numGlyphs": 1480,
    "variable": false,
    "coverage": [
     [
      0,
      0
     ],
     [
      13,
      13
     ],
     [
      32,
      126
     ],
     "… 134 more"
    ],
    "codepoints": 878,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org",
    "licenseUrl": "https://openfontlicense.org",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Spectral",
      "glyphsMissingInSample": 0,
      "inkedPx": 1335,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 1448,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 1415,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_5f86915a744832ecf6e4a17ab04bea09",
    "assetId": "fnt_5f86915a744832ecf6e4a17ab04bea09",
    "sample": "Aa0Zz"
   },
   "fnt_7ec97244259db4008c4b1224c7914e53": {
    "schema": "transovo.font-record/1",
    "sha256": "7ec97244259db4008c4b1224c7914e5371c797c0044af9d85c2d761ba0e5f787",
    "faceIndex": 0,
    "family": "Spectral",
    "subfamily": "Italic",
    "fullName": "Spectral Italic",
    "postscriptName": "Spectral-Italic",
    "version": "Version 2.005; ttfautohint (v1.8.4.7-5d5b)",
    "weightClass": 400,
    "widthClass": 5,
    "italic": true,
    "axes": [],
    "numGlyphs": 1480,
    "variable": false,
    "coverage": [
     [
      0,
      0
     ],
     [
      13,
      13
     ],
     [
      32,
      126
     ],
     "… 134 more"
    ],
    "codepoints": 878,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org",
    "licenseUrl": "https://openfontlicense.org",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Spectral",
      "glyphsMissingInSample": 0,
      "inkedPx": 961,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 1045,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 1051,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_7ec97244259db4008c4b1224c7914e53",
    "assetId": "fnt_7ec97244259db4008c4b1224c7914e53",
    "sample": "Aa0Zz"
   },
   "fnt_5d852db897fd7ad5ce640a6e88f1cd70": {
    "schema": "transovo.font-record/1",
    "sha256": "5d852db897fd7ad5ce640a6e88f1cd70eac75777c541d02d86749af8d4797ff1",
    "faceIndex": 0,
    "family": "Spectral",
    "subfamily": "ExtraLight",
    "fullName": "Spectral ExtraLight",
    "postscriptName": "Spectral-ExtraLight",
    "version": "Version 2.005; ttfautohint (v1.8.4.7-5d5b)",
    "weightClass": 200,
    "widthClass": 5,
    "italic": false,
    "axes": [],
    "numGlyphs": 1480,
    "variable": false,
    "coverage": [
     [
      0,
      0
     ],
     [
      13,
      13
     ],
     [
      32,
      126
     ],
     "… 134 more"
    ],
    "codepoints": 878,
    "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org",
    "licenseUrl": "https://openfontlicense.org",
    "fsType": 0,
    "engines": {
     "skia-python": {
      "ok": true,
      "family": "Spectral",
      "glyphsMissingInSample": 0,
      "inkedPx": 676,
      "engineVersion": "skia-python 144.1"
     },
     "pil": {
      "ok": true,
      "inkedPx": 790,
      "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
     },
     "browser": {
      "ok": true,
      "inkedPx": 779,
      "engineVersion": "Chrome/156.0.8078.47"
     },
     "canvaskit": {
      "ok": true,
      "engineVersion": "canvaskit-wasm 0.42.0"
     },
     "ffmpeg-drawtext": {
      "ok": true,
      "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
     }
    },
    "fontId": "fnt_5d852db897fd7ad5ce640a6e88f1cd70",
    "assetId": "fnt_5d852db897fd7ad5ce640a6e88f1cd70",
    "sample": "Aa0Zz"
   }
  },
  "mode": "live"
 },
 "fallback": {
  "poster": "ast_1b28eb3070d3c35c64bf6582e507445a"
 }
}
```

### Editor: records + signed URLs for a font / logo the user just picked

```http
POST /api/motion-studio/projects/api_demo/preview-assets
Authorization: Bearer <job token>
Content-Type: application/json

{
 "ids": [
  "fnt_97aae409210d255fb3b92f18c8af2ed1",
  "ast_e2f1462e922e7024d402413fe75e2be7"
 ]
}
```
```json
200
{
 "assetUrls": {
  "fnt_97aae409210d255fb3b92f18c8af2ed1": "http://127.0.0.1:8787/_blob/fnt_97aae409210d255fb3b92f18c8af2ed1?exp=1794933325&sig=<sig>",
  "ast_e2f1462e922e7024d402413fe75e2be7": "http://127.0.0.1:8787/_blob/ast_e2f1462e922e7024d402413fe75e2be7?exp=1794933325&sig=<sig>"
 },
 "assets": {
  "fnt_97aae409210d255fb3b92f18c8af2ed1": {
   "mime": "font/ttf",
   "bytes": 161588,
   "meta": {}
  },
  "ast_e2f1462e922e7024d402413fe75e2be7": {
   "mime": "image/svg+xml",
   "bytes": 261,
   "width": 600,
   "height": 200,
   "meta": {
    "width": 600,
    "height": 200,
    "svgSafe": true
   }
  }
 },
 "fonts": {
  "fnt_97aae409210d255fb3b92f18c8af2ed1": {
   "schema": "transovo.font-record/1",
   "sha256": "97aae409210d255fb3b92f18c8af2ed14941e10a1ee134a35bb91f52086de1d0",
   "faceIndex": 0,
   "family": "Anton",
   "subfamily": "Regular",
   "fullName": "Anton Regular",
   "postscriptName": "Anton-Regular",
   "version": "Version 2.116; ttfautohint (v1.8.3)",
   "weightClass": 400,
   "widthClass": 5,
   "italic": false,
   "axes": [],
   "numGlyphs": 1326,
   "variable": false,
   "coverage": [
    [
     0,
     0
    ],
    [
     13,
     13
    ],
    [
     32,
     126
    ],
    "… 123 more"
   ],
   "codepoints": 978,
   "license": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://scripts.sil.org/OFL",
   "licenseUrl": "https://scripts.sil.org/OFL",
   "fsType": 0,
   "engines": {
    "skia-python": {
     "ok": true,
     "family": "Anton",
     "glyphsMissingInSample": 0,
     "inkedPx": 2795,
     "engineVersion": "skia-python 144.1"
    },
    "pil": {
     "ok": true,
     "inkedPx": 2930,
     "engineVersion": "Pillow 13.0.0 / FreeType 2.14.3"
    },
    "browser": {
     "ok": true,
     "inkedPx": 2904,
     "engineVersion": "Chrome/156.0.8078.47"
    },
    "canvaskit": {
     "ok": true,
     "engineVersion": "canvaskit-wasm 0.42.0"
    },
    "ffmpeg-drawtext": {
     "ok": true,
     "method": "inferred: FreeType load via PIL (ffmpeg drawtext uses FreeType); real drawtext probe runs for project fonts"
    }
   },
   "fontId": "fnt_97aae409210d255fb3b92f18c8af2ed1",
   "assetId": "fnt_97aae409210d255fb3b92f18c8af2ed1",
   "sample": "Aa0Zz"
  }
 },
 "missing": []
}
```

### Engine font catalog (browser)

```http
GET /api/motion-studio/fonts/catalog/browser
Authorization: Bearer <job token>
```
```json
200
{
 "schema": "transovo.font-catalog/1",
 "engine": "browser",
 "generatedAt": "2026-11-17T15:32:54.186Z",
 "generatedBy": "publish_fonts",
 "count": 1559,
 "fonts": [
  {
   "fontId": "fnt_faa5f3656a78b2e2d450d27fe8382c77",
   "assetId": "fnt_faa5f3656a78b2e2d450d27fe8382c77",
   "faceIndex": 0,
   "family": "Noto Sans CJK JP",
   "subfamily": "Bold",
   "fullName": "Noto Sans CJK JP Bold",
   "postscriptName": "NotoSansCJKjp-Bold",
   "version": "Version 2.004;hotconv 1.0.118;makeotfexe 2.5.65603",
   "weightClass": 700,
   "italic": false,
   "axes": [],
   "codepoints": 44810,
   "sha256": "faa5f3656a78b2e2d450d27fe8382c778bc2b6bb5ea29c986664a6a435056ceb",
   "engineVersion": "Chrome/156.0.8078.47"
  },
  {
   "fontId": "fnt_b76b0433203017ca80401b2ee0dd6935",
   "assetId": "fnt_b76b0433203017ca80401b2ee0dd6935",
   "faceIndex": 0,
   "family": "Noto Sans CJK JP",
   "subfamily": "Regular",
   "fullName": "Noto Sans CJK JP",
   "postscriptName": "NotoSansCJKjp-Regular",
   "version": "Version 2.004;hotconv 1.0.118;makeotfexe 2.5.65603",
   "weightClass": 400,
   "italic": false,
   "axes": [],
   "codepoints": 44810,
   "sha256": "b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a",
   "engineVersion": "Chrome/156.0.8078.47"
  },
  {
   "fontId": "fnt_1505ee3b9c0890fae6302ee0e9c6fd74",
   "assetId": "fnt_1505ee3b9c0890fae6302ee0e9c6fd74",
   "faceIndex": 0,
   "family": "Noto Serif CJK JP",
   "subfamily": "Bold",
   "fullName": "Noto Serif CJK JP Bold",
   "postscriptName": "NotoSerifCJKjp-Bold",
   "version": "Version 2.003;hotconv 1.1.1;makeotfexe 2.6.0",
   "weightClass": 700,
   "italic": false,
   "axes": [],
   "codepoints": 44777,
   "sha256": "1505ee3b9c0890fae6302ee0e9c6fd74d690f4a55a6ace1d9944f3f6352d622d",
   "engineVersion": "Chrome/156.0.8078.47"
  },
  "… 1556 more"
 ],
 "receivedAt": "2026-11-17T15:32:54.192Z"
}
```

### Progress

```http
POST /api/motion-studio/agent/jobs/msaj_<id>/progress
Authorization: Bearer <job token>
Content-Type: application/json

{
 "phase": "render",
 "progress": 40,
 "message": "rendering S01"
}
```
```json
200
{
 "job": {
  "id": "msaj_<id>",
  "projectId": "api_demo",
  "workspaceId": "ws_sim",
  "mode": "deterministic_render",
  "action": "deterministic_render",
  "status": "running",
  "phase": "render",
  "progress": 40,
  "createdAt": "2026-11-17T15:35:25.731Z",
  "input": {
   "schema": "transovo.motion-job/1",
   "mode": "deterministic_render",
   "projectId": "api_demo",
   "baseVersion": 1,
   "edits": {
    "schema": "transovo.edit-patch/1",
    "scenes": {
     "S01": {
      "elements": {
       "location": {
        "text": "Central Islip, New York"
       }
      }
     }
    }
   }
  },
  "assignedWorker": "wrk_grokbot_A",
  "artifacts": [],
  "events": 0,
  "message": "rendering S01",
  "updatedAt": "2026-11-17T15:35:25.858Z"
 }
}
```

### Event: dependencies

```http
POST /api/motion-studio/agent/jobs/msaj_<id>/events
Authorization: Bearer <job token>
Content-Type: application/json

{
 "at": "2026-11-17T15:35:25.860Z",
 "type": "stage",
 "stage": "dependencies",
 "data": {
  "scenes": [
   {
    "sceneId": "S01",
    "rerender": true,
    "reason": "resolved props changed: elements.location.text"
   },
   {
    "sceneId": "S02",
    "rerender": false,
    "reason": "unchanged: identical render key, clip reused"
   }
  ],
  "master": {
   "reassemble": true,
   "reason": "segments changed: S01"
  }
 }
}
```
```json
202
{
 "ok": true
}
```

### Event: artifact

```http
POST /api/motion-studio/agent/jobs/msaj_<id>/events
Authorization: Bearer <job token>
Content-Type: application/json

{
 "at": "2026-11-17T15:35:25.861Z",
 "type": "artifact",
 "artifact": {
  "assetId": "ast_e2f1462e922e7024d402413fe75e2be7",
  "role": "scene_clip",
  "sceneId": "S01",
  "sha256": "e2f1462e922e7024d402413fe75e2be72c18a6e8b96c27ed1d708e1ab8f4ec40"
 }
}
```
```json
202
{
 "ok": true
}
```

### Checkpoint (monotonic revision; resume skips done scenes)

```http
PUT /api/motion-studio/agent/jobs/msaj_<id>/checkpoint
Authorization: Bearer <job token>
Content-Type: application/json

{
 "revision": 1,
 "checkpoint": {
  "stage": "scenes",
  "done": {
   "S01": {
    "renderKey": "rk_…",
    "clip": {
     "asset": "ast_…"
    }
   }
  }
 }
}
```
```json
200
{
 "ok": true,
 "revision": 1
}
```

### Stale checkpoint → 409

```http
PUT /api/motion-studio/agent/jobs/msaj_<id>/checkpoint
Authorization: Bearer <job token>
Content-Type: application/json

{
 "revision": 1,
 "checkpoint": {}
}
```
```json
409
{
 "error": "stale_checkpoint",
 "revision": 1
}
```

### Read checkpoint (on resume)

```http
GET /api/motion-studio/agent/jobs/msaj_<id>/checkpoint
Authorization: Bearer <job token>
```
```json
200
{
 "revision": 1,
 "checkpoint": {
  "stage": "scenes",
  "done": {
   "S01": {
    "renderKey": "rk_…",
    "clip": {
     "asset": "ast_…"
    }
   }
  }
 }
}
```

### Worker registration

```http
PUT /api/motion-studio/workers/wrk_demo
Authorization: Bearer <job token>
Content-Type: application/json

{
 "schema": "transovo.worker/1",
 "workerId": "wrk_demo",
 "machineId": "mch_…",
 "planId": "plan_grok_shared_01",
 "modes": [
  "deterministic_render"
 ],
 "wakeup": {
  "type": "webhook_routine",
  "routineId": "rtn_…"
 },
 "capabilities": {
  "schema": "transovo.capabilities/1",
  "engines": {
   "browser": {
    "ok": true
   }
  }
 },
 "softwareVersion": "ms-producer 1.0.0"
}
```
```json
200
{
 "ok": true,
 "workerId": "wrk_demo"
}
```

### Usage report

```http
POST /api/motion-studio/workers/wrk_demo/usage
Authorization: Bearer <job token>
Content-Type: application/json

{
 "schema": "transovo.usage/1",
 "workerId": "wrk_demo",
 "machineId": "mch_…",
 "planId": "plan_grok_shared_01",
 "jobId": "msaj_<id>",
 "mode": "deterministic_render",
 "before": {
  "at": "…"
 },
 "after": {
  "at": "…"
 },
 "renderDurationMs": 61234,
 "wallMs": 74000,
 "aiCalls": 0,
 "status": "completed",
 "failures": []
}
```
```json
202
{
 "ok": true
}
```

### Complete

```http
POST /api/motion-studio/agent/jobs/msaj_<id>/complete
Authorization: Bearer <job token>
Content-Type: application/json

{
 "status": "completed",
 "projectVersion": 2,
 "rerendered": [
  "S01"
 ],
 "masterReassembled": true
}
```
```json
200
{
 "job": {
  "id": "msaj_<id>",
  "projectId": "api_demo",
  "workspaceId": "ws_sim",
  "mode": "deterministic_render",
  "action": "deterministic_render",
  "status": "completed",
  "phase": "render",
  "progress": 40,
  "createdAt": "2026-11-17T15:35:25.731Z",
  "input": {
   "schema": "transovo.motion-job/1",
   "mode": "deterministic_render",
   "projectId": "api_demo",
   "baseVersion": 1,
   "edits": {
    "schema": "transovo.edit-patch/1",
    "scenes": {
     "S01": {
      "elements": {
       "location": {
        "text": "Central Islip, New York"
       }
      }
     }
    }
   }
  },
  "assignedWorker": "wrk_grokbot_A",
  "artifacts": [
   {
    "assetId": "ast_e2f1462e922e7024d402413fe75e2be7",
    "role": "scene_clip",
    "sceneId": "S01",
    "sha256": "e2f1462e922e7024d402413fe75e2be72c18a6e8b96c27ed1d708e1ab8f4ec40"
   }
  ],
  "events": 2,
  "message": "rendering S01",
  "updatedAt": "2026-11-17T15:35:25.858Z",
  "completedAt": "2026-11-17T15:35:25.869Z",
  "result": {
   "status": "completed",
   "projectVersion": 2,
   "rerendered": [
    "S01"
   ],
   "masterReassembled": true
  }
 }
}
```

### Any write after completion → 409

```http
POST /api/motion-studio/agent/jobs/msaj_<id>/progress
Authorization: Bearer <job token>
Content-Type: application/json

{
 "phase": "x",
 "progress": 1
}
```
```json
409
{
 "error": "job_finished"
}
```

### Token of another project → 403

```http
GET /api/motion-studio/projects/km_doc_2min/versions/1
Authorization: Bearer <job token>
```
```json
403
{
 "error": "wrong_project"
}
```
