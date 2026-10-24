from __future__ import annotations

import os


def telnyx_sip_transfer_domain() -> str:
    return os.environ.get("VOICE_V3_TELNYX_SIP_TRANSFER_DOMAIN", "sip.telnyx.com").strip()


def normalize_transfer_to(destination: str) -> str:
    """Normalize dial target for outbound SIP (E.164 string, no REFER URI)."""
    dest = destination.strip()
    if dest.startswith("tel:"):
        return dest[4:]
    if dest.startswith("sip:"):
        return dest
    if dest.startswith("+") or (dest and dest[0].isdigit()):
        e164 = dest if dest.startswith("+") else f"+{dest.lstrip('+')}"
        return e164
    return dest


def destination_participant_identity(transfer_request_id: str, destination_id: str) -> str:
    safe_dest = "".join(c if c.isalnum() or c in "-_" else "-" for c in destination_id)[:48]
    safe_tr = "".join(c if c.isalnum() or c in "-_" else "-" for c in transfer_request_id)[:48]
    return f"v3-transfer-dest-{safe_tr}-{safe_dest}"
