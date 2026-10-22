from transovo_voice.voice_v3.intake_collection import resolve_intake_collection_kind
from transovo_voice.voice_v3.intake_persist import node_intake_values_from_state
from transovo_voice.voice_v3.intake_task import build_intake_instructions


def test_resolve_collection_kind_explicit_metadata():
    meta = {"key": "phone", "type": "phone", "collectionKind": "livekit_get_phone"}
    assert resolve_intake_collection_kind(meta) == "livekit_get_phone"


def test_resolve_custom_field_is_function_tool():
    meta = {"key": "favorite_dinosaur", "type": "text"}
    assert resolve_intake_collection_kind(meta) == "livekit_function_tool"


def test_node_intake_values_from_flat_strings():
    state = {"values": {"name": "Anthony", "email": "a@b.co"}}
    assert node_intake_values_from_state(state) == {"name": "Anthony", "email": "a@b.co"}


def test_node_intake_values_from_captured_rows():
    state = {"values": {"phone": {"value": "+15551234567"}}}
    assert node_intake_values_from_state(state)["phone"] == "+15551234567"


def test_build_intake_instructions_lists_existing():
    fields = [
        {"key": "name", "label": "Name", "type": "text", "description": "Full name"},
        {"key": "phone", "label": "Phone", "type": "phone", "description": "Callback"},
    ]
    text = build_intake_instructions(fields, {"name": "Anthony"}, {"phone"})
    assert "already saved: \"Anthony\"" in text
    assert "phone" in text


def test_instructions_mention_record_intake_values():
    fields = [{"key": "name", "label": "Name", "type": "text", "description": ""}]
    text = build_intake_instructions(fields, {}, set())
    assert "record_intake_values" in text
