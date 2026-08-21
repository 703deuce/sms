from __future__ import annotations

import datetime
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal
from zoneinfo import ZoneInfo

from livekit.agents import Agent, JobContext, ToolError, function_tool
from livekit.agents.voice.events import RunContext

from transovo_voice.observability.call_metrics import CallObservability
from transovo_voice.session.telephony_audio import build_telephony_room_options
from transovo_voice.templates.session_factory import build_realtime_session, start_realtime_session
from transovo_voice.templates.template_context import (
    build_template_instructions,
    deliver_template_greeting,
)
from transovo_voice.userdata import SessionUserData


@dataclass
class AvailableSlot:
    unique_hash: str
    start_time: datetime.datetime


@dataclass
class FakeCalendar:
    timezone: str
    _now: Callable[[], datetime.datetime]
    scheduled: list[AvailableSlot] = field(default_factory=list)

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    def now(self) -> datetime.datetime:
        return self._now()

    async def initialize(self) -> None:
        return None

    async def list_available_slots(
        self,
        *,
        start_time: datetime.datetime,
        end_time: datetime.datetime,
    ) -> list[AvailableSlot]:
        slots: list[AvailableSlot] = []
        cursor = start_time.replace(minute=0, second=0, microsecond=0)
        while cursor < end_time:
            if cursor > start_time and cursor.hour in {9, 10, 11, 13, 14, 15, 16}:
                slots.append(
                    AvailableSlot(
                        unique_hash=f"slot-{int(cursor.timestamp())}",
                        start_time=cursor,
                    ),
                )
            cursor += datetime.timedelta(hours=1)
        return slots[:12]

    async def schedule_appointment(
        self,
        *,
        start_time: datetime.datetime,
        attendee_email: str,
    ) -> None:
        for booked in self.scheduled:
            if booked.start_time == start_time:
                raise ToolError("This slot isn't available anymore")
        self.scheduled.append(
            AvailableSlot(unique_hash=f"booked-{int(start_time.timestamp())}", start_time=start_time),
        )


@dataclass
class FrontDeskUserdata:
    cal: FakeCalendar
    slot_unavailable_count: int = 0


_FALLBACK_ROLE = (
    "You are a front desk voice assistant. Help callers book an appointment. "
    "Call get_current_time before interpreting relative dates. "
    "Use list_available_slots then schedule_appointment after the caller picks a time."
)
_TEMPLATE_ROLE = (
    "You are in front desk booking lab mode. Help callers book appointments using "
    "list_available_slots and schedule_appointment. Follow any booking rules in the "
    "business configuration above."
)


class FrontDeskBookingAgent(Agent):
    """Front desk booking — wizard config + FakeCalendar scheduling tools."""

    def __init__(
        self,
        *,
        ud: SessionUserData,
        timezone: str,
        now: Callable[[], datetime.datetime],
        observability: CallObservability | None = None,
    ) -> None:
        self.tz = ZoneInfo(timezone)
        self._now = now
        self._ud = ud
        self._observability = observability
        self._slots_map: dict[str, AvailableSlot] = {}
        super().__init__(
            instructions=build_template_instructions(
                ud,
                template_mode="livekit_frontdesk_booking",
                template_role=_TEMPLATE_ROLE,
                fallback_instructions=_FALLBACK_ROLE,
            ),
        )

    async def on_enter(self) -> None:
        if self._observability is not None:
            await self._observability.mark_startup_phase("on_enter_begin")
            await self._observability.mark_worker_ready()
        await deliver_template_greeting(
            self.session,
            self._ud,
            fallback="Welcome the caller and invite them to book an appointment.",
            observability=self._observability,
        )

    @function_tool
    async def get_current_time(self) -> str:
        return f"The current date and time is {self._now():%A, %B %d, %Y at %H:%M %Z}."

    @function_tool
    async def list_available_slots(
        self,
        ctx: RunContext[FrontDeskUserdata],
        range: Literal["+2week", "+1month", "+3month", "default"],
    ) -> str:
        current = self._now()
        range_days = 14 if range in {"+2week", "default"} else 30 if range == "+1month" else 90
        slots = await ctx.userdata.cal.list_available_slots(
            start_time=current,
            end_time=current + datetime.timedelta(days=range_days),
        )
        lines: list[str] = []
        for slot in slots:
            local = slot.start_time.astimezone(self.tz)
            lines.append(
                f"{slot.unique_hash} – {local.strftime('%A, %B %d, %Y')} at {local:%H:%M} {local.tzname()}",
            )
            self._slots_map[slot.unique_hash] = slot
        return "\n".join(lines) or "No slots available at the moment."

    @function_tool
    async def schedule_appointment(
        self,
        ctx: RunContext[FrontDeskUserdata],
        slot_id: str,
        attendee_email: str = "caller@example.com",
    ) -> str:
        slot = self._slots_map.get(slot_id)
        if not slot:
            raise ToolError(f"Slot {slot_id} was not found")
        try:
            await ctx.userdata.cal.schedule_appointment(
                start_time=slot.start_time,
                attendee_email=attendee_email,
            )
        except ToolError:
            ctx.userdata.slot_unavailable_count += 1
            raise ToolError("This slot isn't available anymore") from None
        local = slot.start_time.astimezone(self.tz)
        return f"The appointment was successfully scheduled for {local.strftime('%A, %B %d, %Y at %H:%M %Z')}."


async def run_frontdesk_booking_template(
    ctx: JobContext,
    ud: SessionUserData,
    *,
    observability: CallObservability | None = None,
) -> None:
    tz = ud.timezone or "America/New_York"
    cal = FakeCalendar(timezone=tz, _now=lambda: datetime.datetime.now(ZoneInfo(tz)))
    await cal.initialize()
    fd_userdata = FrontDeskUserdata(cal=cal)
    session = build_realtime_session(ud, userdata=fd_userdata)
    if observability is not None:
        observability.attach_session(session)
    await start_realtime_session(
        session,
        agent=FrontDeskBookingAgent(
            ud=ud,
            timezone=tz,
            now=cal.now,
            observability=observability,
        ),
        room=ctx.room,
        room_options=build_telephony_room_options(delete_room_on_close=True),
        observability=observability,
    )
