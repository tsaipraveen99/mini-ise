import asyncio
import json

import pytest

from mini_ise.llm import (
    DRAFT_SCHEMA,
    FALLBACK_SUGGESTIONS,
    SYSTEM_PROMPT,
    LLMUnavailable,
    draft_policy,
    parse_draft,
)
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
    assert result.explanation.startswith("The AI draft can't be used: condition 1: role eq needs one of")


def test_allow_everything_draft_gets_a_readable_explanation() -> None:
    # What Claude produced for "allow all requests" before the prompt said conditions are required.
    allow_all = {**VALID_POLICY, "effect": "allow", "conditions": []}
    result = parse_draft(json.dumps({"feasible": True, "explanation": "ok", "policy": allow_all}))
    assert not result.feasible
    assert "at least one condition" in result.explanation
    assert "List should have" not in result.explanation


def test_several_problems_are_all_reported() -> None:
    bad = {**VALID_POLICY, "priority": 0, "conditions": []}
    result = parse_draft(json.dumps({"feasible": True, "explanation": "ok", "policy": bad}))
    assert "priority must be between 1 and 1000" in result.explanation
    assert "at least one condition" in result.explanation


def test_infeasible_draft_carries_interpretation_and_model_suggestions() -> None:
    result = parse_draft(
        json.dumps(
            {
                "feasible": False,
                "explanation": "It would override every other policy.",
                "interpretation": "You want every device to reach every resource.",
                "suggestions": ["Allow employees to reach email", "Allow guests to use the wiki"],
                "policy": None,
            }
        )
    )
    assert result.interpretation == "You want every device to reach every resource."
    assert result.suggestions == ["Allow employees to reach email", "Allow guests to use the wiki"]


def test_infeasible_draft_without_suggestions_gets_fallbacks() -> None:
    result = parse_draft(json.dumps({"feasible": False, "explanation": "no", "suggestions": [], "policy": None}))
    assert result.suggestions == FALLBACK_SUGGESTIONS


def test_invalid_draft_still_explains_meaning_and_offers_rules_to_try() -> None:
    allow_all = {**VALID_POLICY, "conditions": []}
    result = parse_draft(
        json.dumps(
            {
                "feasible": True,
                "explanation": "ok",
                "interpretation": "You want everyone allowed.",
                "suggestions": [],
                "policy": allow_all,
            }
        )
    )
    assert not result.feasible
    assert result.interpretation == "You want everyone allowed."
    assert result.suggestions == FALLBACK_SUGGESTIONS


def test_feasible_draft_has_no_suggestions() -> None:
    result = parse_draft(
        json.dumps(
            {
                "feasible": True,
                "explanation": "ok",
                "interpretation": "You want contractors off finance after 6pm.",
                "suggestions": ["something else"],
                "policy": VALID_POLICY,
            }
        )
    )
    assert result.feasible
    assert result.suggestions == []
    assert result.interpretation.startswith("You want")


def test_suggestions_are_cleaned_and_capped() -> None:
    noisy = ["  Allow guests to use the wiki  ", "", 42, "Allow guests to use the wiki", "x" * 200, "a", "b", "c"]
    result = parse_draft(json.dumps({"feasible": False, "explanation": "no", "suggestions": noisy, "policy": None}))
    assert result.suggestions == ["Allow guests to use the wiki", "a", "b"]


def test_prompt_tells_the_model_catch_all_rules_are_infeasible() -> None:
    assert "between 1 and 10 conditions" in SYSTEM_PROMPT
    assert "allow everything" in SYSTEM_PROMPT


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
