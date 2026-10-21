from __future__ import annotations


def normalize_transfer_to(destination: str) -> str:
    dest = destination.strip()
    if dest.startswith("tel:") or dest.startswith("sip:"):
        return dest
    if dest.startswith("+") or (dest and dest[0].isdigit()):
        return f"tel:{dest}"
    return dest
