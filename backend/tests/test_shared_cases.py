"""The browser engine on the landing page runs these same cases, so both engines must agree."""

import json
from pathlib import Path

import pytest

from mini_ise.db import SEED_POLICIES
from mini_ise.rules import AccessRequest, Policy, evaluate

SHARED = json.loads((Path(__file__).parents[2] / "fixtures" / "policy-cases.json").read_text())


def test_shared_policies_match_the_seed_policies() -> None:
    shared = [{k: v for k, v in p.items() if k != "id"} for p in SHARED["policies"]]
    assert shared == [p.model_dump(mode="json") for p in SEED_POLICIES]


@pytest.mark.parametrize("case", SHARED["cases"], ids=lambda c: c["name"])
def test_shared_case(case: dict[str, object]) -> None:
    policies = [Policy(**p) for p in SHARED["policies"]]
    decision = evaluate(policies, AccessRequest.model_validate(case["request"]))
    assert {"effect": decision.effect.value, "policy_id": decision.policy_id} == case["expected"]
