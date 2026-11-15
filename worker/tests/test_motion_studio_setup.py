"""RE-1: setup smoke + licence manifest (runs in the worker image build = on the render box)."""
from clips_worker.motion_studio import check_setup
from clips_worker.motion_studio.core.fonts import FONT_LICENCES, OFL_ROLES, resolved_manifest


def test_setup_smoke_passes():
    res = check_setup.run(render=True)
    assert res["pass"], [c for c in res["checks"] if not c["pass"]]


def test_licence_manifest_every_role_resolves_to_a_licensed_family():
    for role in OFL_ROLES.values():
        for fam, _w in role:
            assert fam in FONT_LICENCES
    man = resolved_manifest()
    assert all(m["licence"] for m in man), man
