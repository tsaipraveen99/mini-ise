"""The browser engine on the landing page runs these same cases, so both engines must agree."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from mini_ise.db import SEED_POLICIES
from mini_ise.llm import DRAFT_SCHEMA, SYSTEM_PROMPT, _describe_policies
from mini_ise.rules import AccessRequest, Policy, PolicyBase, evaluate

FIXTURES = Path(__file__).parents[2] / "fixtures"
SHARED = json.loads((FIXTURES / "policy-cases.json").read_text())
VALIDATION_CASES = json.loads((FIXTURES / "policy-validation-cases.json").read_text())


def test_public_drafting_uses_the_same_prompt_as_the_console() -> None:
    # site/api/_lib/prompt.ts is checked against the same file by the site tests.
    assert (FIXTURES / "draft-system-prompt.txt").read_text() == SYSTEM_PROMPT


def test_public_drafting_uses_the_same_output_schema() -> None:
    assert json.loads((FIXTURES / "draft-schema.json").read_text()) == DRAFT_SCHEMA


def test_public_drafting_describes_the_seed_policies_the_same_way() -> None:
    seed = [Policy(id=i + 1, **p.model_dump()) for i, p in enumerate(SEED_POLICIES)]
    assert (FIXTURES / "draft-existing-policies.txt").read_text() == _describe_policies(seed)


@pytest.mark.parametrize("case", VALIDATION_CASES, ids=lambda c: c["name"])
def test_validation_case(case: dict[str, object]) -> None:
    try:
        PolicyBase.model_validate(case["policy"])
        valid = True
    except ValidationError:
        valid = False
    assert valid == case["valid"]


def test_shared_policies_match_the_seed_policies() -> None:
    shared = [{k: v for k, v in p.items() if k != "id"} for p in SHARED["policies"]]
    assert shared == [p.model_dump(mode="json") for p in SEED_POLICIES]


@pytest.mark.parametrize("case", SHARED["cases"], ids=lambda c: c["name"])
def test_shared_case(case: dict[str, object]) -> None:
    policies = [Policy(**p) for p in SHARED["policies"]]
    decision = evaluate(policies, AccessRequest.model_validate(case["request"]))
    assert {"effect": decision.effect.value, "policy_id": decision.policy_id} == case["expected"]
