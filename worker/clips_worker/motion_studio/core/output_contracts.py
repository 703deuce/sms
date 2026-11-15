"""Single source of truth for Motion Studio model-stage output contracts.

Each stage lists JSON Schema (for structured model output) and the semantic
rules its validator enforces. Prompts are generated from the same rules so a
model is asked for exactly what validate_* checks. A CI test fails if a rule
is missing from that stage's prompt or schema.

OpenAI strict json_schema (verified in clips_worker/picker/llm.py for
gpt-6-luna) requires every property listed in `required` and
`additionalProperties: false` on every object.
"""
from __future__ import annotations

import json
import re
from typing import Any, Iterable


class StageContractError(ValueError):
    """A model stage failed its contract after validation (and any repair)."""

    def __init__(self, stage: str, errors: list[str], *, repaired: bool = False, output: Any = None):
        self.stage = stage
        self.errors = [str(e) for e in errors]
        self.repaired = repaired
        self.output = output
        head = "; ".join(self.errors[:8]) or "no details"
        suffix = " after targeted repair" if repaired else ""
        super().__init__(f"{stage} failed its output contract{suffix}: {head}")


def _obj(props: dict[str, Any], required: list[str] | None = None) -> dict[str, Any]:
    """Strict object schema: every property is required, no extras."""
    return {
        "type": "object",
        "properties": props,
        "required": list(props.keys()) if required is None else required,
        "additionalProperties": False,
    }


# --------------------------------------------------------------------------- rules
# `tokens` must appear in format_contract() and/or the JSON schema so the CI
# test can prove the validator rule is represented in the prompt/schema.
# `message` is the validator's stable error string (or a distinctive prefix).

Rule = dict[str, Any]


DIRECTOR_RULES: list[Rule] = [
    {
        "id": "palette_hex",
        "message": "style.palette needs bg/ink/accent/accent2/muted hex colours",
        "contract": (
            "style.palette MUST include exactly the keys bg, ink, accent, accent2, muted, "
            "each a #RRGGBB hex colour (six hex digits with a leading #). Invent this film's "
            "colours and record why in style.reason. Do not reuse a stock or example palette."
        ),
        "tokens": ["bg", "ink", "accent", "accent2", "muted", "#RRGGBB", "style.palette"],
    },
    {
        "id": "line_coverage",
        "message": "scenes must cover every line id exactly once, in order",
        "contract": "scenes must cover every line id exactly once, in order. The Director decides how many lines each scene covers and records why in that scene's reason — a single word or line may be its own scene; a longer passage may stay together when it is one beat. Do not use a fixed group size.",
        "tokens": ["exactly once", "in order", "line id"],
    },
    {
        "id": "music_decision",
        "message": "plan is missing a music mood and reason",
        "contract": (
            "music MUST be an object {mood, brief, reason} decided for THIS film. "
            "mood is the score's emotional colour; brief describes instrumentation and shape; "
            "reason records why this score belongs to this story. Do not reuse a stock rise-and-resolve pattern."
        ),
        "tokens": ["music", "mood", "brief", "reason"],
    },
    {
        "id": "style_fonts",
        "message": "style.fonts needs display, label, and body roles",
        "contract": (
            "style.fonts MUST choose display, label, and body from the engine font roles "
            "(cond, label, labelm, mono, serif, hand, anton). Invent the pairing for this film "
            "and mention it in style.reason. Do not default to a canned cond/serif stack."
        ),
        "tokens": ["style.fonts", "display", "label", "body"],
    },
    {
        "id": "every_upload",
        "message": "is not assigned to any scene",
        "contract": (
            "Every ready upload must appear at least once. Assign each still a unique official scene via "
            "assetId set to the exact catalog asset id (never a filename). Uploaded videos are handoff "
            "scenes (kind 'handoff') whose handoff.assetId is the exact video asset id from the uploads list."
        ),
        "tokens": ["Every ready upload", "exact catalog asset id", "handoff.assetId"],
    },
    {
        "id": "reuse_reason",
        "message": "is assigned to more than one scene without a reuseReason",
        "contract": (
            "If the same still is assigned to more than one scene, every assignment after the first MUST "
            "include a narrative reuseReason. Do not repeat a still without reuseReason."
        ),
        "tokens": ["reuseReason", "more than one scene"],
    },
    {
        "id": "handoff_video",
        "message": "handoff references a missing video asset",
        "contract": (
            "A kind 'handoff' or 'hardcut' scene MUST set handoff.assetId to a video asset id from the "
            "uploads.videos list (the exact assetId, not a filename or a still id). Default inS to 0 and "
            "outS to the clip duration so the planned stretch plays in full, with audioMode 'clip'."
        ),
        "tokens": ["handoff.assetId", "video asset id", "audioMode"],
    },
    {
        "id": "scene_reason",
        "message": "has no reason",
        "contract": "Each scene must include a reason explaining why it is in the film.",
        "tokens": ["reason"],
    },
    {
        "id": "world_brief",
        "message": "plan is missing a world brief",
        "contract": "world must include a story-driven brief (and a reason). Do not pick a stock world type from a menu.",
        "tokens": ["world", "brief"],
    },
]

PRODUCTION_RULES: list[Rule] = [
    {
        "id": "no_python",
        "message": "must not emit",
        "contract": (
            "The Production Designer writes NO Python, no build_scene, no rendering instructions, and no "
            "database or storage mutations. Return identity, worlds and blueprint fields only."
        ),
        "tokens": ["NO Python", "build_scene", "blueprint"],
    },
    {
        "id": "every_upload",
        "message": "is not assigned to any scene",
        "contract": (
            "Every ready upload in the inventory should appear at least once. assetPlacements.assetId and "
            "handoff.assetId must be exact catalog asset ids. Repeats require a narrative reuseReason."
        ),
        "tokens": ["Every ready upload", "reuseReason", "assetId"],
    },
    {
        "id": "identity",
        "message": "identity package is missing typography, concept, or cameraPersonality",
        "contract": (
            "identity MUST include typography (this film's display/label/body pairing or a typography brief), "
            "concept, throughLine, and cameraPersonality — each invented for this film, each with intent "
            "the viewer can see. Do not fall back to a canned cond/serif stack or a stock camera sentence."
        ),
        "tokens": ["typography", "concept", "throughLine", "cameraPersonality"],
    },
    {
        "id": "world_brief",
        "message": "no story-driven environment brief",
        "contract": "Each world needs id, name, brief and reason — a story-driven environment invented for this film, not a stock type menu.",
        "tokens": ["brief", "reason", "world"],
    },
    {
        "id": "camera_route",
        "message": "cameraRoute is missing",
        "contract": (
            "cameraRoute and cameraRouteReason are required. Describe how the camera moves through THIS film's "
            "environments and why. Do not reuse a stock route such as 'follow the sequence of environments'."
        ),
        "tokens": ["cameraRoute", "cameraRouteReason"],
    },
    {
        "id": "audio_direction",
        "message": "audioDirection is missing",
        "contract": (
            "audioDirection and audioDirectionReason are required. Decide how narration, footage sound, and "
            "score share the soundtrack for this film, and why."
        ),
        "tokens": ["audioDirection", "audioDirectionReason"],
    },
    {
        "id": "palette_keep",
        "message": "style.palette needs bg/ink/accent/accent2/muted hex colours",
        "contract": "Keep the plan's style.palette keys bg, ink, accent, accent2, muted as #RRGGBB hex colours unless a change is clearly justified.",
        "tokens": ["bg", "ink", "accent", "accent2", "muted", "#RRGGBB"],
    },
    {
        "id": "evidence_and_tools",
        "message": "visual objective is not supported by the assigned asset's evidence or by registered tools",
        "contract": (
            "Every visual objective MUST be supported by the assigned asset's evidence "
            "(what the analysis records the image or video actually shows — including on-screen text) "
            "AND by registered tools or a declared custom-object extension. "
            "Do not require a still to display wording, objects, or a state the analysis does not record. "
            "PhotoFrame and similar media treatments apply to the whole image; typography sits on top. "
            "There is no per-element or per-letter fade of pixels inside an upload unless a registered tool "
            "or a declared customObject says so. On each sceneBinding, record evidenceBasis and toolBasis. Anything beyond the assets actually in hand must be labeled illustrative, built from registered tools, and given a provenance."
        ),
        "tokens": ["evidence", "registered tools", "custom-object", "evidenceBasis", "toolBasis", "whole image"],
    },
]

PRODUCTION_RULES.append({
    "id": "composition_fidelity",
    "message": "compositionPlan or requiredEffects is missing",
    "contract": (
        "Each sceneBinding MUST provide compositionPlan describing the specific physical layout, layers, "
        "objects, connections, reveals and visual relationships; cameraIntent must explicitly be hold, "
        "travel or none; requiredEffects must name the actual scene tools that MUST render. "
        "An intentional minimalist composition may have no optional effects, but it must be justified. "
        "compositionElements lists each required visible component with an id matching the eventual "
        "objectId/groupId/environmentId supplied to the Motion Engineer, plus layer, geometry, links, "
        "assetId, motion and timing. cameraShots provides actual named camera targets for any journey. "
        "If you require a component, group, connection, transition, animation or camera journey, list it "
        "in requiredEffects. This is an implementation contract, not a style menu."
    ),
    "tokens": ["compositionPlan", "cameraIntent", "requiredEffects"],
})

DIRECTOR_RULES.append({
    "id": "evidence_match",
    "message": "which the assigned asset's analysis does not record",
    "contract": (
        "Every visual objective or scene description that depends on an asset MUST match that asset's analysis "
        "(what the image or video actually shows, including on-screen text). Do not invent details the analysis "
        "does not record. Anything beyond the assets actually in hand must be explicitly illustrative, built "
        "from registered engine tools, and labeled with provenance."
    ),
    "tokens": ["analysis", "in hand", "illustrative", "provenance", "on-screen"],
})

STORY_RULES: list[Rule] = [
    {
        "id": "title",
        "message": "story is missing a title",
        "contract": "Return a title string for the documentary.",
        "tokens": ["title"],
    },
    {
        "id": "lines",
        "message": "story must include narration lines",
        "contract": "Return lines as objects with chapter (number), text, spoken, and optional hero, typed, quote.",
        "tokens": ["lines", "chapter", "text", "spoken"],
    },
    {
        "id": "chapters",
        "message": "story must include chapters",
        "contract": "Return chapters as [{n, title}] covering every line's chapter.",
        "tokens": ["chapters", "title"],
    },
    {
        "id": "from_assets_in_hand",
        "message": "is in hand but is not cited by any story line",
        "contract": (
            "Build the story ONLY from assets actually in hand (the catalog of ready uploads and any media "
            "that was actually acquired). Never claim a visual from an asset that was requested but is not "
            "in the catalog. Every line or beat that claims a visual must set visualAssetId to the asset "
            "that shows it. Video clips in hand must anchor the sequences they support and be cited. "
            "Every asset in hand should earn at least one line. Beats that go beyond the assets in hand "
            "must be labeled illustrative, built from registered engine tools or typography, and given a "
            "provenance. Wishes for media that is not in hand go on missingAssets and must not be narrated "
            "as if the footage exists."
        ),
        "tokens": ["in hand", "visualAssetId", "missingAssets", "illustrative", "provenance", "clips"],
    },
]

ENGINEER_RULES: list[Rule] = [
    {
        "id": "tools_or_code_or_limitation",
        "message": "motion engineer must return tools, a scene spec, code, or a limitation",
        "contract": (
            "Return JSON as one of: {\"tools\":[{\"tool\":\"name\",\"arguments\":\"<JSON object as a string>\"}],"
            "\"dependencies\":[]}, or {\"spec\":\"<JSON object as a string or null>\"}, or "
            "{\"code\":\"<python>\",\"tier\":3,\"reason\":\"...\"} only when a registered "
            "tool cannot implement the approved design, or {\"limitation\":{\"reason\":\"...\",\"missingTools\":[],"
            "\"missingAssets\":[],\"unblock\":\"...\"}} if the design cannot be built. Do not silently rewrite the design. "
            "Tool arguments and spec must be JSON text strings because strict structured output cannot carry open objects."
        ),
        "tokens": ["tools", "limitation", "build_scene", "dependencies"],
    },
    {
        "id": "motion_core",
        "message": "custom code must import motion_core and define build_scene",
        "contract": "Custom Python must `from motion_core import *` and define build_scene(ctx), using exact motion_core signatures from the API contract.",
        "tokens": ["from motion_core import", "build_scene"],
    },
    {
        "id": "no_silent_fallback",
        "message": "framework fallback",
        "contract": "Never substitute a framework or deterministic scene if the approved design cannot be built; return a structured limitation instead.",
        "tokens": ["limitation", "Do not silently"],
    },
    {
        "id": "relative_timing",
        "message": "endFrame is outside the scene duration",
        "contract": (
            "Express timing relative to THIS scene: startS/endS (seconds from the scene start), "
            "startFrac/endFrac (a fraction 0..1 of the scene), or a line/word anchor. "
            "Do not convert times to frames and do not invent a frame count. "
            "durationS, fps and durationFrames in the brief are the exact length after layout/TTS timing; "
            "the engine converts relative times to frames from that duration. "
            "A hold or move that lasts the whole scene uses startS=0 and endS='end' or endFrac=1."
        ),
        "tokens": ["startS", "endS", "startFrac", "endFrac", "durationS", "durationFrames", "do not convert"],
    },
]

REVIEWER_RULES: list[Rule] = [
    {
        "id": "route_only",
        "message": "Visual Reviewer routes issues and does not repair them",
        "contract": "The Visual Reviewer evaluates renders against the approved blueprint and routes each issue to exactly one responsible role. It does not repair code or silently rewrite the design.",
        "tokens": ["routes", "responsible role", "does not repair"],
    },
    {
        "id": "degraded_visible",
        "message": "degraded",
        "contract": "Degraded or fallback scenes must be reported as issues with the exact degradeCause, never hidden.",
        "tokens": ["degraded", "degradeCause"],
    },
]


# --------------------------------------------------------------------------- schemas (strict)

_HEX = {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"}
_EMPHASIS = _obj({"lineId": {"type": ["string", "null"]}, "word": {"type": "string"}})
_HANDOFF = _obj({
    "assetId": {"type": ["string", "null"]},
    "inS": {"type": ["number", "null"]},
    "outS": {"type": ["number", "null"]},
    "surface": {"type": ["string", "null"]},
    "exitStyle": {"type": ["string", "null"]},
    "exitReason": {"type": ["string", "null"]},
    "audioMode": {"type": ["string", "null"]},
    "cutJustification": {"type": ["string", "null"]},
})
_ANCHOR = _obj({"lineId": {"type": ["string", "null"]}, "word": {"type": ["string", "null"]}})
_PALETTE = _obj({
    "bg": _HEX,
    "ink": _HEX,
    "accent": _HEX,
    "accent2": _HEX,
    "muted": _HEX,
})
_FONTS = _obj({
    "display": {"type": ["string", "null"]},
    "label": {"type": ["string", "null"]},
    "body": {"type": ["string", "null"]},
})
_DIRECTOR_SCENE = _obj({
    "kind": {"type": "string"},
    "visualType": {"type": "string"},
    "lineIds": {"type": "array", "items": {"type": "string"}},
    "description": {"type": "string"},
    "emphasis": {"type": "array", "items": _EMPHASIS},
    "reason": {"type": "string"},
    "transitionOut": {"type": "string"},
    "assetId": {"type": ["string", "null"]},
    "reuseReason": {"type": ["string", "null"]},
    "handoff": {"anyOf": [_HANDOFF, {"type": "null"}]},
    "illustrative": {"type": ["boolean", "null"]},
    "visualProvenance": {"type": ["string", "null"]},
})
_MINIMAL = _obj({
    "sceneIndex": {"type": ["integer", "number", "null"]},
    "reason": {"type": "string"},
})
_CUSTOM_OBJECT = _obj({
    "id": {"type": ["string", "null"]},
    "name": {"type": ["string", "null"]},
    "purpose": {"type": ["string", "null"]},
    "sceneIndex": {"type": ["integer", "number", "null"]},
    "constructionBrief": {"type": ["string", "null"]},
    "materials": {"type": ["string", "null"]},
    "animationPlan": {"type": ["string", "null"]},
})
_COMPOSITION_ELEMENT = _obj({
    "id": {"type": "string"},
    "kind": {"type": "string"},
    "purpose": {"type": "string"},
    "description": {"type": "string"},
    "layer": {"type": "string"},
    "position": {"anyOf": [_obj({"x": {"type": "number"}, "y": {"type": "number"}}), {"type": "null"}]},
    "size": {"anyOf": [_obj({"width": {"type": ["number", "null"]}, "height": {"type": ["number", "null"]}}), {"type": "null"}]},
    "assetId": {"type": ["string", "null"]},
    "groupId": {"type": ["string", "null"]},
    "connectTo": {"type": ["string", "null"]},
    "motion": {"type": ["string", "null"]},
    "timingAnchor": {"type": ["string", "null"]},
})
_SCENE_BINDING = _obj({
    "compositionPlan": {"type": "string"},
    "compositionElements": {"type": "array", "items": _COMPOSITION_ELEMENT},
    "cameraShots": {"type": "array", "items": _obj({
        "id": {"type": "string"}, "purpose": {"type": "string"},
        "fromTarget": {"type": ["string", "null"]}, "toTarget": {"type": ["string", "null"]},
        "movement": {"type": "string"}, "timingAnchor": {"type": ["string", "null"]},
    })},
    "transitionIntent": {"type": ["string", "null"]},
    "cameraIntent": {"type": "string", "enum": ["hold", "travel", "none"]},
    "requiredEffects": {"type": "array", "items": {"type": "string", "enum": [
        "media", "environment_geometry", "group", "property_animation", "camera_travel",
        "connector", "custom_component", "transition", "typography", "graphic",
    ]}},
    "sceneIndex": {"type": ["integer", "number", "null"]},
    "worldId": {"type": ["string", "null"]},
    "objective": {"type": ["string", "null"]},
    "heldStillOk": {"type": ["boolean", "null"]},
    "assetId": {"type": ["string", "null"]},
    "visualType": {"type": ["string", "null"]},
    "evidenceBasis": {"type": ["string", "null"]},
    "toolBasis": {"type": ["string", "null"]},
})
_MISSING_NEED = _obj({
    "sceneIndex": {"type": ["integer", "number", "null"]},
    "need": {"type": ["string", "null"]},
    "treatment": {"type": ["string", "null"]},
})
_STRING_OR_NUM_LIST = {"anyOf": [
    {"type": "array", "items": {"type": ["string", "integer", "number"]}},
    {"type": "null"},
]}

DIRECTOR_SCHEMA = _obj({
    "world": _obj({
        "brief": {"type": "string"},
        "reason": {"type": "string"},
        "name": {"type": ["string", "null"]},
    }),
    "style": _obj({
        "palette": _PALETTE,
        "mood": {"type": "string"},
        "grain": {"type": ["number", "null"]},
        "glow": {"type": ["number", "null"]},
        "vignette": {"type": ["number", "null"]},
        "reason": {"type": "string"},
        "fonts": {"anyOf": [_FONTS, {"type": "null"}]},
    }),
    "scenes": {"type": "array", "items": _DIRECTOR_SCENE},
    "musicAnchors": _obj({
        "pulse": {"anyOf": [_ANCHOR, {"type": "null"}]},
        "build": {"anyOf": [_ANCHOR, {"type": "null"}]},
        "peak": {"anyOf": [_ANCHOR, {"type": "null"}]},
        "crash": {"anyOf": [_ANCHOR, {"type": "null"}]},
        "resolve": {"anyOf": [_ANCHOR, {"type": "null"}]},
    }),
    "music": _obj({
        "mood": {"type": "string"},
        "brief": {"type": "string"},
        "reason": {"type": "string"},
    }),
    "deliberateMinimal": {"type": "array", "items": _MINIMAL},
})

PRODUCTION_SCHEMA = _obj({
    "identity": _obj({
        "concept": {"type": ["string", "null"]},
        "typography": {"anyOf": [{"type": "string"}, _FONTS, {"type": "null"}]},
        "materials": {"type": ["string", "null"]},
        "palette": {"anyOf": [_PALETTE, {"type": "null"}]},
        "cameraPersonality": {"type": ["string", "null"]},
        "transitionLanguage": {"type": ["string", "null"]},
        "motifs": {"anyOf": [
            {"type": "array", "items": {"type": "string"}},
            {"type": "string"},
            {"type": "null"},
        ]},
        "throughLine": {"type": ["string", "null"]},
    }),
    "worlds": {"type": "array", "items": _obj({
        "id": {"type": "string"},
        "name": {"type": "string"},
        "brief": {"type": "string"},
        "reason": {"type": "string"},
        "chapters": _STRING_OR_NUM_LIST,
        "clusters": _STRING_OR_NUM_LIST,
    })},
    "customObjects": {"type": "array", "items": _CUSTOM_OBJECT},
    "assetPlacements": {"type": "array", "items": _obj({
        "sceneIndex": {"type": ["integer", "number", "null"]},
        "assetId": {"type": "string"},
        "reason": {"type": ["string", "null"]},
        "reuseReason": {"type": ["string", "null"]},
    })},
    "sceneBindings": {"type": "array", "items": _SCENE_BINDING},
    "missingNeeds": {"type": "array", "items": _MISSING_NEED},
    "cameraRoute": {"type": "string"},
    "cameraRouteReason": {"type": "string"},
    "audioDirection": {"type": "string"},
    "audioDirectionReason": {"type": "string"},
})

STORY_SCHEMA = _obj({
    "title": {"type": "string"},
    "logline": {"type": ["string", "null"]},
    "tone": {"type": ["string", "null"]},
    "chapters": {"type": "array", "items": _obj({
        "n": {"type": ["integer", "number"]},
        "title": {"type": "string"},
    })},
    "lines": {"type": "array", "items": _obj({
        "chapter": {"type": ["integer", "number"]},
        "text": {"type": "string"},
        "spoken": {"type": ["string", "null"]},
        "hero": {"type": ["string", "null"]},
        "typed": {"type": ["string", "null"]},
        "quote": {"type": ["boolean", "null"]},
        "visualAssetId": {"type": ["string", "null"]},
        "illustrative": {"type": ["boolean", "null"]},
        "provenance": {"type": ["string", "null"]},
    })},
    "missingAssets": {"type": ["array", "null"], "items": _obj({
        "need": {"type": ["string", "null"]},
        "reason": {"type": ["string", "null"]},
        "assetId": {"type": ["string", "null"]},
    })},
})

ENGINEER_SCHEMA = _obj({
    "tools": {"type": ["array", "null"], "items": _obj({
        "tool": {"type": "string"},
        "arguments": {"type": "string"},
    })},
    "spec": {"type": ["string", "null"]},
    "code": {"type": ["string", "null"]},
    "tier": {"type": ["integer", "number", "null"]},
    "reason": {"type": ["string", "null"]},
    "dependencies": {"type": ["array", "null"], "items": {"type": "string"}},
    "limitation": {"anyOf": [_obj({
        "reason": {"type": "string"},
        "missingTools": {"type": "array", "items": {"type": "string"}},
        "missingAssets": {"type": "array", "items": {"type": "string"}},
        "unblock": {"type": "string"},
    }), {"type": "null"}]},
})

_ISSUE = _obj({
    "code": {"type": ["string", "null"]},
    "message": {"type": ["string", "null"]},
    "sceneIndex": {"type": ["integer", "number", "null"]},
    "degradeCause": {"type": ["string", "null"]},
})
REVIEWER_SCHEMA = _obj({
    "pass": {"type": "boolean"},
    "issues": {"type": "array", "items": _ISSUE},
    "correctionRequests": {"type": "array", "items": _ISSUE},
    "fromRole": {"type": "string"},
    "toRoles": {"type": "array", "items": {"type": "string"}},
})



_SCENE_REVISION = _obj({
    "sceneIndex": {"type": ["integer", "number"]},
    "description": {"type": "string"},
    "reason": {"type": ["string", "null"]},
    "objective": {"type": "string"},
    "evidenceBasis": {"type": "string"},
    "toolBasis": {"type": "string"},
    "heldStillOk": {"type": ["boolean", "null"]},
    "visualType": {"type": ["string", "null"]},
    "customObjects": {"type": "array", "items": _CUSTOM_OBJECT},
})

REVISION_RULES: list[Rule] = [
    {
        "id": "evidence_and_tools",
        "message": "visual objective is not supported by the assigned asset's evidence or by registered tools",
        "contract": (
            "Revise ONLY the limited scenes. Each revised objective MUST be supported by the assigned "
            "asset's evidence and by registered tools or a declared custom-object extension. "
            "Do not invent wording, objects, or a state the analysis does not record. "
            "Prefer a whole-image treatment or typography on top when a per-element pixel edit is not available. "
            "Keep official assetId assignments. Record evidenceBasis and toolBasis."
        ),
        "tokens": ["evidence", "registered tools", "custom-object", "evidenceBasis", "toolBasis", "limited scenes"],
    },
]

REVISION_SCHEMA = _obj({
    "sceneRevisions": {"type": "array", "items": _SCENE_REVISION},
})

STAGES: dict[str, dict[str, Any]] = {
    "director": {"schema": DIRECTOR_SCHEMA, "rules": DIRECTOR_RULES, "schema_name": "director_plan"},
    "production_designer": {"schema": PRODUCTION_SCHEMA, "rules": PRODUCTION_RULES, "schema_name": "production_design"},
    "production_revision": {"schema": REVISION_SCHEMA, "rules": REVISION_RULES, "schema_name": "production_revision"},
    "story": {"schema": STORY_SCHEMA, "rules": STORY_RULES, "schema_name": "story"},
    "motion_engineer": {"schema": ENGINEER_SCHEMA, "rules": ENGINEER_RULES, "schema_name": "motion_engineer"},
    "reviewer": {"schema": REVIEWER_SCHEMA, "rules": REVIEWER_RULES, "schema_name": "visual_reviewer"},
}


def format_contract(stage: str) -> str:
    """Human-readable output contract generated from the stage's schema + rules."""
    info = STAGES[stage]
    rules = "\n".join(f"- {r['contract']}" for r in info["rules"])
    schema = json.dumps(info["schema"], indent=2, sort_keys=True)
    return (
        f"OUTPUT CONTRACT for {stage} (same schema the validator enforces). "
        "Return a single JSON object that satisfies this contract.\n"
        f"Rules:\n{rules}\n"
        f"JSON Schema:\n{schema}"
    )


def schema_for(stage: str) -> dict[str, Any]:
    return STAGES[stage]["schema"]


def schema_name(stage: str) -> str:
    return STAGES[stage]["schema_name"]


def rules_for(stage: str) -> list[Rule]:
    return STAGES[stage]["rules"]


def assert_prompt_covers_rules(stage: str, prompt: str, schema: dict | None = None) -> list[str]:
    """Return missing-token problems; empty means the prompt/schema covers every rule."""
    hay = (prompt or "") + "\n" + json.dumps(schema if schema is not None else schema_for(stage))
    hay_l = hay.lower()
    missing: list[str] = []
    for rule in rules_for(stage):
        for tok in rule["tokens"]:
            if tok.lower() not in hay_l:
                missing.append(f"{stage} rule {rule['id']} is not represented in the prompt/schema (missing {tok!r})")
    return missing


def iter_strict_schema_problems(schema: dict | None, path: str = "$") -> list[str]:
    """Catch shapes OpenAI strict json_schema rejects (verified against gpt-6-luna, 15 Nov 2026).

    Every object must set additionalProperties to false and list properties.
    Every array must declare items. Bare objects (no properties) are invalid.
    """
    if not isinstance(schema, dict):
        return []
    problems: list[str] = []
    types = schema.get("type")
    tlist = types if isinstance(types, list) else [types] if types is not None else []
    if "properties" in schema or "object" in tlist:
        if schema.get("additionalProperties") is not False:
            problems.append(f"{path} object must set additionalProperties to false")
        if "properties" not in schema:
            problems.append(f"{path} object type must declare properties")
        for key, sub in (schema.get("properties") or {}).items():
            problems.extend(iter_strict_schema_problems(sub, f"{path}.{key}"))
    if "array" in tlist or (schema.get("items") is not None and "anyOf" not in schema and "type" in schema and "array" in tlist):
        if "items" not in schema:
            problems.append(f"{path} array must declare items")
    if "items" in schema:
        problems.extend(iter_strict_schema_problems(schema["items"], f"{path}[]"))
    for i, alt in enumerate(schema.get("anyOf") or schema.get("oneOf") or []):
        problems.extend(iter_strict_schema_problems(alt, f"{path}.anyOf[{i}]"))
    return problems


def assert_schemas_are_strict() -> list[str]:
    problems: list[str] = []
    for stage in STAGES:
        problems.extend(iter_strict_schema_problems(schema_for(stage), stage))
    return problems


# --------------------------------------------------------------------------- light coercions (format only, never invent content)

_HEX6 = re.compile(r"^#?[0-9a-fA-F]{6}$")
_HEX3 = re.compile(r"^#[0-9a-fA-F]{3}$")
_PALETTE_ALIASES = {
    "background": "bg", "bgcolor": "bg", "backgroundcolor": "bg",
    "foreground": "ink", "fg": "ink", "text": "ink", "copy": "ink",
    "primary": "accent", "highlight": "accent",
    "secondary": "accent2", "accent_2": "accent2", "accentsecondary": "accent2",
    "dim": "muted", "mute": "muted", "subtle": "muted",
}


def coerce_hex(value: Any) -> Any:
    """Normalize obvious hex spellings. Leave anything else for the validator."""
    s = str(value or "").strip()
    if _HEX3.fullmatch(s):
        return "#" + "".join(ch * 2 for ch in s[1:])
    if _HEX6.fullmatch(s):
        return s if s.startswith("#") else f"#{s}"
    return value


def normalize_palette(pal: dict | None) -> dict:
    """Coerce palette key aliases and hex spellings. Do not invent missing colours."""
    if not isinstance(pal, dict):
        return {}
    out = dict(pal)
    for raw, canon in _PALETTE_ALIASES.items():
        if canon not in out or not out.get(canon):
            for k in list(out):
                if str(k).lower().replace(" ", "").replace("-", "") == raw:
                    out[canon] = out[k]
                    break
    for k in ("bg", "ink", "accent", "accent2", "muted"):
        if k in out:
            out[k] = coerce_hex(out[k])
    return out


def resolve_asset_id(raw: Any, catalog: list[dict]) -> Any:
    """Map a filename (or exact id) to the catalog asset id. Do not guess among several."""
    if raw is None or raw == "":
        return raw
    key = str(raw)
    by_id = {str(a.get("id")): a for a in catalog}
    if key in by_id:
        return key
    matches = [a for a in catalog if str(a.get("filename") or "") == key]
    if len(matches) == 1:
        return matches[0]["id"]
    return raw


def normalize_director_plan(plan: dict, catalog: list[dict]) -> dict:
    """Format-level coercions so the model can satisfy the contract without a second guess."""
    if not isinstance(plan, dict):
        return plan
    style = dict(plan.get("style") or {})
    if "palette" in style or style:
        style["palette"] = normalize_palette(style.get("palette") if isinstance(style.get("palette"), dict) else style)
        plan["style"] = style
    for s in plan.get("scenes") or []:
        if not isinstance(s, dict):
            continue
        if s.get("assetId"):
            s["assetId"] = resolve_asset_id(s.get("assetId"), catalog)
        h = s.get("handoff")
        if s.get("kind") in ("handoff", "hardcut"):
            if not isinstance(h, dict):
                h = {}
                s["handoff"] = h
            if not h.get("assetId") and s.get("assetId"):
                aid = resolve_asset_id(s.get("assetId"), catalog)
                asset = next((a for a in catalog if a.get("id") == aid), None)
                if asset and asset.get("kind") == "video":
                    h["assetId"] = aid
            elif h.get("assetId"):
                h["assetId"] = resolve_asset_id(h.get("assetId"), catalog)
    return plan


def catalog_split(catalog: list[dict]) -> dict[str, list[dict]]:
    """Uploads payload for model calls: only assets actually in hand, with analysis evidence."""
    from clips_worker.motion_studio.core.designer_capabilities import asset_evidence, assets_in_hand
    stills, videos = [], []
    hand = assets_in_hand(catalog)
    for a in hand:
        ev = asset_evidence(a)
        rec = {
            "assetId": a.get("id"),
            "kind": a.get("kind"),
            "filename": a.get("filename"),
            "durationMs": a.get("durationMs"),
            "summary": ev.get("summary") or ev.get("description"),
            "evidence": ev,
        }
        if a.get("kind") == "video":
            rec["durationS"] = round((a.get("durationMs") or 0) / 1000.0, 3) if a.get("durationMs") else ev.get("durationS")
            videos.append(rec)
        else:
            stills.append(rec)
    return {"stills": stills, "videos": videos, "allAssetIds": [a.get("id") for a in hand]}


def validate_story(story: dict | None, catalog: list | None = None) -> list[str]:
    errs: list[str] = []
    if not isinstance(story, dict):
        return ["story must be an object"]
    if not str(story.get("title") or "").strip():
        errs.append("story is missing a title")
    lines = story.get("lines") or []
    if not lines:
        errs.append("story must include narration lines")
    else:
        for i, ln in enumerate(lines):
            if not str((ln or {}).get("text") or "").strip():
                errs.append(f"story line {i} is missing text")
            if (ln or {}).get("chapter") is None:
                errs.append(f"story line {i} is missing a chapter")
    if not story.get("chapters"):
        errs.append("story must include chapters")
    if catalog:
        from clips_worker.motion_studio.core.designer_capabilities import validate_story_assets
        errs.extend(validate_story_assets(story, catalog))
    return errs


def record_degradation(qa: dict | None, *, stage: str, errors: list[str], repaired: bool = False) -> dict:
    blob = dict(qa or {})
    items = list(blob.get("degradations") or [])
    items.append({"stage": stage, "errors": list(errors), "repaired": repaired, "degraded": True})
    blob["degradations"] = items
    blob["degraded"] = True
    return blob


def record_invalid_output(qa: dict | None, *, stage: str, errors: list[str], output: Any,
                          repaired: bool = False) -> dict:
    """Persist the full invalid model output on the project qa record."""
    blob = dict(qa or {})
    items = list(blob.get("invalidOutputs") or [])
    entry = {"stage": stage, "errors": list(errors), "repaired": repaired, "output": output}
    if items and items[-1].get("stage") == stage and items[-1].get("errors") == entry["errors"] and items[-1].get("repaired") == repaired:
        items[-1] = entry
    else:
        items.append(entry)
    blob["invalidOutputs"] = items
    return blob


