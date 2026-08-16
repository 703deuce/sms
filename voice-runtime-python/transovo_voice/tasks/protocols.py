from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, TypeVar, runtime_checkable

from livekit.agents import llm

T = TypeVar("T")


@runtime_checkable
class IntakeTask(Protocol[T]):
    async def run(self, chat_ctx: llm.ChatContext | None = None) -> T: ...


@dataclass
class NameIntakeResult:
    field_id: str
    full_name: str
    first_name: str | None = None
    last_name: str | None = None


@dataclass
class PhoneIntakeResult:
    field_id: str
    phone_number: str


@dataclass
class EmailIntakeResult:
    field_id: str
    email: str


@dataclass
class AddressIntakeResult:
    field_id: str
    address: str


@dataclass
class DynamicFieldResult:
    field_id: str
    value: str
    confidence: float = 1.0


@dataclass
class BookingIntakeResult:
    fields: dict[str, str]
    complete: bool


def is_phone_field(field: dict[str, Any]) -> bool:
    return field.get("type") == "phone"


def is_email_field(field: dict[str, Any]) -> bool:
    return field.get("type") == "email"


def is_address_field(field: dict[str, Any]) -> bool:
    return field.get("type") == "address"


def looks_like_name_field(field: dict[str, Any]) -> bool:
    fid = str(field.get("id", "")).lower()
    label = str(field.get("label", "")).lower()
    return fid == "name" or fid.endswith("_name") or "name" in label
