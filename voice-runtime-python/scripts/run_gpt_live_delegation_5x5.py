#!/usr/bin/env python3
"""
GPT-Live / Astra delegation tool-routing cert: 5 scenarios × 5 runs (real OpenAI).

Requires OPENAI_API_KEY, TRANSOVO_BACKEND_URL, TRANSOVO_INTERNAL_API_KEY, WORKSPACE_ID.
Run inside transovo-voice container (production has keys).
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from typing import Any

import httpx
from openai import OpenAI

RUNS_PER_SCENARIO = 5
MODEL = (os.getenv("VOICE_V3_ASTRA_MODEL") or "gpt-6-astra").strip()

SCENARIOS: dict[str, dict[str, str]] = {
    "booking_link": {
        "history": (
            "Amy read the required SMS disclosure for the booking link. "
            "Caller agreed to receive the text. Caller: Can you text me the booking link to this number?"
        ),
        "expect": "send_booking_link",
    },
    "booking_transfer_booking": {
        "history": (
            "Caller was booking an appointment and gave their name. "
            "Caller: Actually forget scheduling — transfer me to the front desk right now."
        ),
        "expect": "transfer_call",
    },
    "question_then_booking": {
        "history": (
            "Caller: What time do you close on Fridays? "
            "Caller: Thanks. I'd like to book an appointment for next Tuesday afternoon."
        ),
        "expect": "set_scheduling_preference",
    },
    "callback": {
        "history": "Caller: Can you have someone from the office call me back tomorrow morning?",
        "expect": "request_callback",
    },
    "message": {
        "history": (
            "Caller: I need to leave a message for the team — I already emailed the forms, "
            "please let them know."
        ),
        "expect": "take_message",
    },
}


def _require_env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        print(f"FAIL: missing env {name}", file=sys.stderr)
        sys.exit(1)
    return value


def _internal_headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}


def _resolve_session(
    base_url: str, api_key: str, workspace_id: str, agent_id: str
) -> dict[str, Any]:
    # Browser-test room prefix allows workspaceId (see resolve-livekit-session assertInboundSipBootstrapTrust).
    room_prefix = (
        os.getenv("LIVEKIT_BROWSER_TEST_ROOM_PREFIX") or "transovo-browser-test-"
    ).strip()
    room = f"{room_prefix}cert-5x5-{uuid.uuid4().hex[:12]}"
    payload = {
        "action": "resolve_voice_v3_livekit_session",
        "payload": {
            "roomName": room,
            "sipParticipantIdentity": f"browser-cert-{uuid.uuid4().hex[:8]}",
            "callerE164": "+15555550100",
            "workspaceId": workspace_id,
            "agentId": agent_id,
            "useDraft": False,
        },
    }
    url = f"{base_url.rstrip('/')}/api/internal/voice-runtime"
    with httpx.Client(timeout=120.0) as client:
        res = client.post(url, headers=_internal_headers(api_key), json=payload)
    if res.status_code != 200:
        print(f"FAIL: resolve session HTTP {res.status_code}: {res.text[:500]}", file=sys.stderr)
        sys.exit(1)
    body = res.json()
    if not body.get("ok", True) and body.get("error"):
        print(f"FAIL: resolve session: {body}", file=sys.stderr)
        sys.exit(1)
    return body


def _openai_tools(tool_schemas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tools: list[dict[str, Any]] = []
    for schema in tool_schemas:
        name = schema.get("name") or schema.get("function", {}).get("name")
        if not name:
            continue
        tools.append(
            {
                "type": "function",
                "name": str(name),
                "description": schema.get("description") or schema.get("function", {}).get("description"),
                "parameters": schema.get("parameters") or schema.get("function", {}).get("parameters") or {},
                "strict": schema.get("strict", True),
            }
        )
    return tools


def _pick_tool(client: OpenAI, instructions: str, tools: list[dict[str, Any]], history: str) -> str | None:
    response = client.responses.create(
        model=MODEL,
        instructions=instructions,
        input=[{"role": "user", "content": history}],
        tools=tools,
        tool_choice="auto",
        parallel_tool_calls=False,
    )
    for item in response.output:
        if item.type == "function_call":
            return item.name
    return None


def main() -> None:
    openai_key = _require_env("OPENAI_API_KEY")
    internal_key = _require_env("TRANSOVO_INTERNAL_API_KEY")
    base_url = _require_env("TRANSOVO_BACKEND_URL")
    workspace_id = _require_env("WORKSPACE_ID")
    agent_id = (
        os.getenv("VOICE_V3_CERT_AGENT_ID")
        or os.getenv("VOICE_AGENT_ID")
        or ""
    ).strip()
    if not agent_id:
        print(
            "FAIL: set VOICE_V3_CERT_AGENT_ID (published receptionist agent id)",
            file=sys.stderr,
        )
        sys.exit(1)

    session = _resolve_session(base_url, internal_key, workspace_id, agent_id)
    instructions = str(session.get("astraInstructions") or "")
    tool_schemas = session.get("toolSchemas") or []
    if not instructions or not tool_schemas:
        print("FAIL: session missing astraInstructions or toolSchemas", file=sys.stderr)
        sys.exit(1)

    tools = _openai_tools(tool_schemas)
    tool_names = {t["name"] for t in tools}
    print(
        json.dumps(
            {
                "event": "gpt_live_delegation_5x5_start",
                "model": MODEL,
                "tool_count": len(tools),
                "tool_names": sorted(tool_names),
            }
        )
    )

    client = OpenAI(api_key=openai_key)
    summary: dict[str, dict[str, int | float]] = {}

    for scenario_key, spec in SCENARIOS.items():
        expect = spec["expect"]
        if expect not in tool_names:
            print(
                json.dumps(
                    {
                        "scenario": scenario_key,
                        "status": "SKIP",
                        "reason": f"expected tool {expect} not in published catalog",
                    }
                )
            )
            summary[scenario_key] = {"pass": 0, "total": RUNS_PER_SCENARIO, "rate": 0.0}
            continue

        passes = 0
        for run in range(1, RUNS_PER_SCENARIO + 1):
            picked = _pick_tool(client, instructions, tools, spec["history"])
            ok = picked == expect
            if ok:
                passes += 1
            print(
                json.dumps(
                    {
                        "scenario": scenario_key,
                        "run": run,
                        "picked": picked,
                        "expected": expect,
                        "ok": ok,
                    }
                )
            )
        rate = passes / RUNS_PER_SCENARIO
        summary[scenario_key] = {"pass": passes, "total": RUNS_PER_SCENARIO, "rate": rate}

    print(json.dumps({"event": "gpt_live_delegation_5x5_summary", "scenarios": summary}))
    failed = [k for k, v in summary.items() if v["pass"] < v["total"]]
    if failed:
        print(f"FAIL: scenarios below 5/5: {', '.join(failed)}", file=sys.stderr)
        sys.exit(1)
    print("GPT_LIVE_DELEGATION_5X5_PASS")


if __name__ == "__main__":
    main()
