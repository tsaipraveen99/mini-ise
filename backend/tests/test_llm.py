import asyncio
import json

import pytest

from mini_ise.llm import DRAFT_SCHEMA, LLMUnavailable, draft_policy, parse_draft
from mini_ise.rules import Effect

VALID_POLICY = {
    "name": "Contractors off finance after hours",
    "description": "Blocks contractors from finance from 18:00",
    "priority": 15,
    "effect": "deny",
    "reason": "Finance is closed to contractors after 6pm",
    "conditions": [
        {"attribute": "role", "op": "eq", "value": "contractor"},
        {"attribute": "resource", "op": "eq", "value": "finance"},
        {"attribute": "hour", "op": "gte", "value": 18},
    ],
}


def test_valid_draft_is_offered_for_approval() -> None:
    result = parse_draft(json.dumps({"feasible": True, "explanation": "ok", "policy": VALID_POLICY}))
    assert result.feasible
    assert result.policy is not None
    assert result.policy.effect is Effect.DENY
    assert len(result.policy.conditions) == 3


def test_infeasible_draft_keeps_model_explanation() -> None:
    result = parse_draft(json.dumps({"feasible": False, "explanation": "No attribute for user names", "policy": None}))
    assert not result.feasible
    assert result.policy is None
    assert result.explanation == "No attribute for user names"


def test_draft_with_invented_values_fails_validation() -> None:
    bad = {**VALID_POLICY, "conditions": [{"attribute": "role", "op": "eq", "value": "ceo"}]}
    result = parse_draft(json.dumps({"feasible": True, "explanation": "ok", "policy": bad}))
    assert not result.feasible
    assert result.policy is None
    assert result.explanation.startswith("The AI draft failed validation")


def test_draft_claiming_feasible_without_policy_is_not_offered() -> None:
    result = parse_draft(json.dumps({"feasible": True, "explanation": "ok", "policy": None}))
    assert not result.feasible


def test_missing_credentials_is_a_clear_unavailable_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    with pytest.raises(LLMUnavailable, match="ANTHROPIC_API_KEY"):
        asyncio.run(draft_policy("contractors cannot reach finance", []))


def test_schema_objects_are_closed() -> None:
    # Structured outputs require additionalProperties: false on every object.
    policy_schema = DRAFT_SCHEMA["properties"]["policy"]["anyOf"][0]
    condition_schema = policy_schema["properties"]["conditions"]["items"]
    for schema in (DRAFT_SCHEMA, policy_schema, condition_schema):
        assert schema["additionalProperties"] is False
        assert set(schema["required"]) == set(schema["properties"])
