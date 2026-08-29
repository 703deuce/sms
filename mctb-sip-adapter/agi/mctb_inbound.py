#!/usr/bin/env python3
"""
Dead-AGI handler: Telnyx FQDN → press-1 consent → existing Transovo backend.

Keeps all business logic in transovo-web. This script only:
  Progress (via dialplan) → Answer → play prompt → gather digit → HTTP consent → hangup.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
import traceback
from pathlib import Path
from typing import Any

from asterisk.agi import AGI

from transovo_client import mirror_trace, voice_runtime_call

AUDIO_DIR = Path("/var/spool/asterisk/mctb-audio")
CAPTURE_PATH = "asterisk_sip_mctb"
DTMF_TIMEOUT_MS = 12000


def e164ish(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return ""
    if digits.startswith("1") and len(digits) == 11:
        return f"+{digits}"
    if len(digits) == 10:
        return f"+1{digits}"
    return f"+{digits}" if value.strip().startswith("+") else digits


def read_pjsip_header(agi: AGI, name: str) -> str:
    try:
        value = agi.get_variable(f"PJSIP_HEADER(read,{name})")
        return str(value or "").strip()
    except Exception:
        return ""


def collect_sip_attributes(agi: AGI) -> dict[str, str]:
    attrs: dict[str, str] = {}
    for header in (
        "Diversion",
        "History-Info",
        "P-Asserted-Identity",
        "Remote-Party-ID",
        "From",
        "To",
    ):
        value = read_pjsip_header(agi, header)
        if value:
            attrs[f"sip.h.{header.lower()}"] = value[:500]
    return attrs


def download_playable_audio(url: str, call_id: str, label: str) -> Path | None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    suffix = ".wav"
    lowered = url.lower().split("?", 1)[0]
    if lowered.endswith(".mp3"):
        suffix = ".mp3"
    target = AUDIO_DIR / f"{call_id}-{label}{suffix}"
    try:
        subprocess.run(
            ["curl", "-fsSL", url, "-o", str(target)],
            check=True,
            timeout=30,
        )
    except Exception:
        return None

    if suffix == ".mp3":
        wav_target = target.with_suffix(".wav")
        try:
            subprocess.run(
                ["sox", str(target), "-r", "8000", "-c", "1", str(wav_target)],
                check=True,
                timeout=30,
            )
            return wav_target
        except Exception:
            return None
    return target


def playback_file(agi: AGI, path: Path) -> None:
    stem = str(path.with_suffix(""))
    agi.stream_file(stem)


def gather_digit(agi: AGI, prompt_stem: str, timeout_ms: int = DTMF_TIMEOUT_MS) -> str:
    result = agi.get_data(prompt_stem, timeout_ms, 1)
  # returns digit or timeout (-1)
    if not result or result == "-1":
        return ""
    return str(result).strip()


def main() -> int:
    agi = AGI()
    caller = e164ish(agi.env.get("agi_callerid", ""))
    transovo_number = e164ish(agi.env.get("agi_dnid", "") or agi.env.get("agi_extension", ""))
    provider_call_id = str(agi.env.get("agi_uniqueid", "")).strip()
    sip_attributes = collect_sip_attributes(agi)
    diversion = sip_attributes.get("sip.h.diversion", "")

    mirror_trace(
        "asterisk_inbound_started",
        {
            "providerCallId": provider_call_id,
            "callerE164": caller,
            "transovoNumberE164": transovo_number,
            "diversionHeader": diversion or None,
        },
    )

    try:
        session = voice_runtime_call(
            "resolve_mctb_sip_session",
            {
                "callerE164": caller,
                "transovoNumberE164": transovo_number,
                "diversionHeader": diversion or None,
                "sipAttributes": sip_attributes,
            },
        )
    except Exception as err:
        mirror_trace(
            "asterisk_session_resolve_failed",
            {"providerCallId": provider_call_id, "error": str(err)},
        )
        agi.verbose(f"mctb session resolve failed: {err}")
        return 1

    if not session.get("ok"):
        mirror_trace(
            "asterisk_session_resolve_rejected",
            {"providerCallId": provider_call_id, "error": session.get("error")},
        )
        return 1

    handling_mode = str(session.get("handlingMode") or "mctb")
    consent_mode = str(session.get("consentMode") or "press_1")
    workspace_id = str(session.get("workspaceId") or "")

    mirror_trace(
        "asterisk_session_resolved",
        {
            "providerCallId": provider_call_id,
            "workspaceId": workspace_id,
            "consentMode": consent_mode,
            "handlingMode": handling_mode,
            "forwardedFromE164": session.get("forwardedFromE164"),
        },
    )

    if handling_mode != "mctb" or session.get("failClosed"):
        agi.verbose("mctb voicemail/fail-closed path not implemented in v1 adapter spike")
        agi.answer()
        vm_url = str(session.get("voicemailPlayUrl") or "").strip()
        if vm_url:
            vm_file = download_playable_audio(vm_url, provider_call_id, "voicemail")
            if vm_file:
                playback_file(agi, vm_file)
        return 0

    if consent_mode != "press_1":
        agi.answer()
        try:
            voice_runtime_call(
                "capture_mctb_sip_inbound",
                {
                    "providerCallId": provider_call_id,
                    "callerE164": caller,
                    "transovoNumberE164": transovo_number,
                    "forwardedFromE164": session.get("forwardedFromE164"),
                    "diversionHeader": session.get("diversionHeader") or diversion,
                    "sipAttributes": sip_attributes,
                    "capturePath": CAPTURE_PATH,
                },
            )
        except Exception as err:
            mirror_trace(
                "asterisk_existing_consent_capture_failed",
                {"providerCallId": provider_call_id, "error": str(err)},
            )
        return 0

    play_url = str(session.get("playUrl") or "").strip()
    if not play_url:
        mirror_trace(
            "asterisk_missing_play_url",
            {"providerCallId": provider_call_id, "workspaceId": workspace_id},
        )
        return 1

    agi.answer()
    mirror_trace("asterisk_answered", {"providerCallId": provider_call_id})

    prompt_file = download_playable_audio(play_url, provider_call_id, "consent")
    if not prompt_file:
        mirror_trace(
            "asterisk_prompt_download_failed",
            {"providerCallId": provider_call_id, "playUrl": play_url},
        )
        return 1

    prompt_stem = str(prompt_file.with_suffix(""))
    digit = gather_digit(agi, prompt_stem)
    mirror_trace(
        "asterisk_dtmf_gathered",
        {"providerCallId": provider_call_id, "digit": digit or None},
    )

    if digit == str(session.get("consentDigit") or "1"):
        try:
            consent = voice_runtime_call(
                "record_mctb_sip_press_1_consent",
                {
                    "workspaceId": workspace_id,
                    "callerNumber": caller,
                    "businessNumber": session.get("businessE164") or transovo_number,
                    "transovoNumberE164": transovo_number,
                    "providerCallId": provider_call_id,
                    "forwardedFrom": session.get("forwardedFromE164"),
                    "audioAssetId": session.get("audioAssetId"),
                    "dtmfDigit": digit,
                    "capturePath": CAPTURE_PATH,
                },
            )
            mirror_trace(
                "asterisk_consent_recorded",
                {
                    "providerCallId": provider_call_id,
                    "consentRecorded": consent.get("consentRecorded"),
                    "smsScheduled": (consent.get("sms") or {}).get("scheduled"),
                },
            )
        except Exception as err:
            mirror_trace(
                "asterisk_consent_record_failed",
                {"providerCallId": provider_call_id, "error": str(err)},
            )
            return 1

        confirmation_url = str(session.get("confirmationPlayUrl") or "").strip()
        if confirmation_url:
            confirmation_file = download_playable_audio(
                confirmation_url,
                provider_call_id,
                "confirmation",
            )
            if confirmation_file:
                playback_file(agi, confirmation_file)

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        try:
            agi = AGI()
            agi.verbose(traceback.format_exc())
        except Exception:
            print(traceback.format_exc(), file=sys.stderr)
        raise
