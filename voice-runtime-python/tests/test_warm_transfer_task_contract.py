"""Installed livekit-agents 1.8.2 WarmTransferTask contract (no PSTN)."""
import inspect

from livekit.agents.beta.workflows import WarmTransferTask


def test_warm_transfer_task_constructor_and_tools():
    sig = inspect.signature(WarmTransferTask.__init__)
    params = list(sig.parameters)
    assert "hold_audio" in params
    assert "ringing_timeout" in params
    assert "instructions" in params
    assert "sip_call_to" in params
    task_cls = WarmTransferTask
    assert callable(getattr(task_cls, "connect_to_caller", None)) or hasattr(
        WarmTransferTask, "connect_to_caller"
    )
    assert hasattr(WarmTransferTask, "decline_transfer")
    assert hasattr(WarmTransferTask, "voicemail_detected")
