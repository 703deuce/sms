"""#1210 BE-1 director registry (ST-ENG-005/006). Exactly one entry in v1: `documentary`.

The pipeline drives a director only through this interface; documentary-specific code lives under
directors/documentary/*. Shared modules (core/*, pipeline/*) must not import a director package
directly (enforced by tests/test_motion_studio_boundary.py).
"""
from __future__ import annotations

import importlib
from dataclasses import dataclass, field
from typing import Callable

ENGINE_CAPABILITIES = frozenset({
    "world.canvas", "camera.path", "camera.spotlight", "look.finish", "timing.word_clock", "script.lines",
    "type.hero_slam", "data.rolling_number", "label.callout", "emphasis.mark", "connector", "field.spread",
    "surface.photo_frame", "bg.gradient", "bg.grid", "bg.particles", "bg.noise", "panel", "chart.line", "chart.bars",
    "overlay.lower_third", "overlay.chapter_card", "handoff.enter", "handoff.playback", "handoff.exit",
    "handoff.continuity", "handoff.hardcut", "sfx.auto_cues", "audio.mix", "music.generated", "music.upload",
    "music.elevenlabs", "render.parallel_chunks", "sandbox.scene_code", "narration.tts_with_word_times",
})


class CapabilityError(ValueError):
    pass


@dataclass
class Director:
    name: str
    inputs: tuple[str, ...]
    outputs: tuple[str, ...]
    capabilities_used: frozenset[str]
    module: str
    hooks: dict[str, Callable] = field(default_factory=dict)

    def load(self):
        return importlib.import_module(self.module)

    def check(self, used: set[str]) -> None:
        bad = set(used) - set(self.capabilities_used)
        if bad:
            raise CapabilityError(f"director {self.name} used undeclared capabilities: {sorted(bad)}")
        unknown = set(self.capabilities_used) - ENGINE_CAPABILITIES
        if unknown:
            raise CapabilityError(f"engine does not provide: {sorted(unknown)}")


DIRECTOR_REGISTRY: dict[str, Director] = {
    "documentary": Director(
        name="documentary",
        inputs=("brief", "workflow", "settings", "uploads_catalog", "script"),
        outputs=("story", "plan", "style_spec", "scenes", "handoffs", "music_anchors"),
        capabilities_used=ENGINE_CAPABILITIES,
        module="clips_worker.motion_studio.directors.documentary.agent",
    )
}


def get_director(name: str = "documentary") -> Director:
    if name not in DIRECTOR_REGISTRY:
        raise KeyError(f"unknown director {name!r}")
    return DIRECTOR_REGISTRY[name]
