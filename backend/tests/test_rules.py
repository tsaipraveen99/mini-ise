import pytest
from pydantic import ValidationError

from mini_ise.db import SEED_POLICIES
from mini_ise.rules import AccessRequest, Condition, Effect, Policy, evaluate


def make_request(**overrides: object) -> AccessRequest:
    fields: dict[str, object] = {
        "user": "priya.employee",
        "device_id": "pri-100",
        "role": "employee",
        "resource": "email",
        "location": "office",
        "device_managed": True,
        "device_encrypted": True,
        "device_patched": True,
        "hour": 10,
    }
    fields.update(overrides)
    return AccessRequest.model_validate(fields)


def role_policy(policy_id: int, priority: int, effect: Effect, **extra: object) -> Policy:
    return Policy(
        id=policy_id,
        name=f"policy {policy_id}",
        priority=priority,
        effect=effect,
        reason=effect.value,
        conditions=[Condition(attribute="role", op="eq", value="employee")],
        **extra,
    )


@pytest.fixture
def seed_policies() -> list[Policy]:
    return [Policy(id=i + 1, **p.model_dump()) for i, p in enumerate(SEED_POLICIES)]


@pytest.mark.parametrize(
    ("overrides", "effect", "reason"),
    [
        ({}, Effect.ALLOW, "Employee access"),
        ({"device_encrypted": False}, Effect.QUARANTINE, "Device disk is not encrypted"),
        ({"device_patched": False, "resource": "finance"}, Effect.DENY, "Device is missing security patches"),
        ({"device_patched": False, "resource": "email"}, Effect.ALLOW, "Employee access"),
        ({"role": "guest", "resource": "wiki"}, Effect.ALLOW, "Guest access to the wiki"),
        ({"role": "guest", "resource": "engineering"}, Effect.DENY, "Guests may only access the wiki"),
        ({"role": "contractor", "resource": "hr"}, Effect.DENY, "Contractors cannot access finance or HR"),
        ({"role": "contractor", "device_managed": True}, Effect.ALLOW, "Contractor on a company-managed device"),
        ({"role": "contractor", "device_managed": False}, Effect.DENY, "No policy matched (default deny)"),
    ],
)
def test_seed_policies(seed_policies: list[Policy], overrides: dict[str, object], effect: Effect, reason: str) -> None:
    decision = evaluate(seed_policies, make_request(**overrides))
    assert (decision.effect, decision.reason) == (effect, reason)


def test_no_policies_means_default_deny() -> None:
    decision = evaluate([], make_request())
    assert decision.effect is Effect.DENY
    assert decision.policy_id is None


def test_lowest_priority_number_wins_regardless_of_list_order() -> None:
    allow = role_policy(1, priority=50, effect=Effect.ALLOW)
    deny = role_policy(2, priority=5, effect=Effect.DENY)
    assert evaluate([allow, deny], make_request()).policy_id == 2


def test_equal_priority_breaks_tie_by_id() -> None:
    later = role_policy(9, priority=10, effect=Effect.DENY)
    earlier = role_policy(3, priority=10, effect=Effect.ALLOW)
    assert evaluate([later, earlier], make_request()).policy_id == 3


def test_disabled_policy_is_skipped() -> None:
    deny = role_policy(1, priority=1, effect=Effect.DENY, enabled=False)
    assert evaluate([deny], make_request()).policy_id is None


def test_same_input_always_gives_same_decision(seed_policies: list[Policy]) -> None:
    request = make_request(role="contractor", resource="finance")
    first = evaluate(seed_policies, request)
    assert all(evaluate(seed_policies, request) == first for _ in range(100))


def test_after_hours_condition() -> None:
    after_six = Policy(
        id=1,
        name="after hours",
        priority=1,
        effect=Effect.DENY,
        reason="after hours",
        conditions=[
            Condition(attribute="role", op="eq", value="contractor"),
            Condition(attribute="hour", op="gte", value=18),
        ],
    )
    assert evaluate([after_six], make_request(role="contractor", hour=19)).effect is Effect.DENY
    assert evaluate([after_six], make_request(role="contractor", hour=17)).policy_id is None


@pytest.mark.parametrize(
    "condition",
    [
        {"attribute": "role", "op": "eq", "value": "ceo"},
        {"attribute": "role", "op": "gte", "value": "employee"},
        {"attribute": "resource", "op": "in", "value": []},
        {"attribute": "resource", "op": "in", "value": "finance"},
        {"attribute": "hour", "op": "gte", "value": 24},
        {"attribute": "hour", "op": "eq", "value": True},
        {"attribute": "device_managed", "op": "eq", "value": "yes"},
        {"attribute": "device_managed", "op": "lt", "value": True},
        {"attribute": "salary", "op": "eq", "value": 1},
    ],
)
def test_invalid_conditions_are_rejected(condition: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        Condition.model_validate(condition)
