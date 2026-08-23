"""Tests for SIP forwarded-from extraction."""

from __future__ import annotations

from transovo_voice.session.sip_forwarded_from import extract_forwarded_from_sip_attributes

SYNTHETIC_FORWARDED = "+19990001001"


def test_extract_forwarded_from_diversion_header():
    attrs = {
        "sip.h.Diversion": f"<sip:{SYNTHETIC_FORWARDED.lstrip('+')}@carrier.example>;reason=unconditional",
    }
    forwarded, raw = extract_forwarded_from_sip_attributes(attrs)
    assert forwarded == SYNTHETIC_FORWARDED
    assert raw is not None


def test_extract_forwarded_from_history_info():
    attrs = {
        "sip.history-info": f"tel:{SYNTHETIC_FORWARDED};index=1",
    }
    forwarded, _raw = extract_forwarded_from_sip_attributes(attrs)
    assert forwarded == SYNTHETIC_FORWARDED
