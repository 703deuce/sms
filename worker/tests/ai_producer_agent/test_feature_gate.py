from clips_worker.ai_producer_agent.feature_gate import AI_PRODUCER_AGENT_JOB_TYPES, ai_producer_agent_enabled
from clips_worker.job_types import JOB_TYPES


def test_job_type_registered():
    assert "AI_PRODUCER_AGENT_ANALYZE" in JOB_TYPES


def test_feature_gate_off_by_default(monkeypatch):
    monkeypatch.delenv("AI_PRODUCER_AGENT_ENABLED", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_AI_PRODUCER_AGENT", raising=False)
    assert ai_producer_agent_enabled() is False


def test_job_types_set():
    assert "AI_PRODUCER_AGENT_ANALYZE" in AI_PRODUCER_AGENT_JOB_TYPES
