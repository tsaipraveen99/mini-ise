"""Access policy model and the deterministic evaluator.

Decisions never call an LLM or the network. The same request against the same
policy set always produces the same result, which is what makes a decision
reproducible for an audit.
"""

from __future__ import annotations

from collections.abc import Sequence
from enum import StrEnum
from typing import Literal, get_args

from pydantic import BaseModel, Field, model_validator

Role = Literal["employee", "contractor", "guest", "admin"]
Resource = Literal["email", "wiki", "engineering", "finance", "hr"]
Location = Literal["office", "remote"]

ROLES: tuple[str, ...] = get_args(Role)
RESOURCES: tuple[str, ...] = get_args(Resource)
LOCATIONS: tuple[str, ...] = get_args(Location)


class Effect(StrEnum):
    ALLOW = "allow"
    DENY = "deny"
    QUARANTINE = "quarantine"


class Attribute(StrEnum):
    ROLE = "role"
    RESOURCE = "resource"
    LOCATION = "location"
    DEVICE_MANAGED = "device_managed"
    DEVICE_ENCRYPTED = "device_encrypted"
    DEVICE_PATCHED = "device_patched"
    HOUR = "hour"


class Op(StrEnum):
    EQ = "eq"
    NEQ = "neq"
    IN = "in"
    NOT_IN = "not_in"
    GTE = "gte"
    LT = "lt"


_VOCABULARY: dict[Attribute, tuple[str, ...]] = {
    Attribute.ROLE: ROLES,
    Attribute.RESOURCE: RESOURCES,
    Attribute.LOCATION: LOCATIONS,
}


class AccessRequest(BaseModel):
    """One device asking to reach one resource."""

    user: str = Field(min_length=1, max_length=100)
    device_id: str = Field(min_length=1, max_length=100)
    role: Role
    resource: Resource
    location: Location
    device_managed: bool
    device_encrypted: bool
    device_patched: bool
    hour: int = Field(ge=0, le=23)


class Condition(BaseModel):
    attribute: Attribute
    op: Op
    value: bool | int | str | list[str]

    @model_validator(mode="after")
    def _value_fits_attribute(self) -> Condition:
        attribute, op, value = self.attribute, self.op, self.value

        if attribute in _VOCABULARY:
            allowed = _VOCABULARY[attribute]
            if op in (Op.EQ, Op.NEQ):
                if not isinstance(value, str) or value not in allowed:
                    raise ValueError(f"{attribute} {op} needs one of {allowed}")
            elif op in (Op.IN, Op.NOT_IN):
                if not isinstance(value, list) or not value or any(v not in allowed for v in value):
                    raise ValueError(f"{attribute} {op} needs a non-empty list from {allowed}")
            else:
                raise ValueError(f"operator {op} is not valid for {attribute}")
        elif attribute is Attribute.HOUR:
            if op in (Op.IN, Op.NOT_IN):
                raise ValueError(f"operator {op} is not valid for hour")
            if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 23:
                raise ValueError("hour needs an integer from 0 to 23")
        else:
            if op not in (Op.EQ, Op.NEQ):
                raise ValueError(f"operator {op} is not valid for {attribute}")
            if not isinstance(value, bool):
                raise ValueError(f"{attribute} needs true or false")
        return self

    def matches(self, request: AccessRequest) -> bool:
        actual = getattr(request, self.attribute.value)
        match self.op:
            case Op.EQ:
                return actual == self.value
            case Op.NEQ:
                return actual != self.value
            case Op.IN:
                return actual in self.value  # type: ignore[operator]
            case Op.NOT_IN:
                return actual not in self.value  # type: ignore[operator]
            case Op.GTE:
                return actual >= self.value  # type: ignore[operator]
            case Op.LT:
                return actual < self.value  # type: ignore[operator]


class PolicyBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    priority: int = Field(ge=1, le=1000)
    effect: Effect
    reason: str = Field(min_length=1, max_length=200)
    conditions: list[Condition] = Field(min_length=1, max_length=10)


class Policy(PolicyBase):
    id: int
    enabled: bool = True
    source: str = "manual"


class Decision(BaseModel):
    effect: Effect
    reason: str
    policy_id: int | None = None
    policy_name: str | None = None


DEFAULT_DENY = Decision(effect=Effect.DENY, reason="No policy matched (default deny)")


def evaluate(policies: Sequence[Policy], request: AccessRequest) -> Decision:
    """Return the effect of the first enabled policy whose conditions all match.

    Policies are checked by ascending priority, with id as the tie-breaker so
    ordering is stable. Nothing matching means deny: zero trust never grants
    access by default.
    """
    for policy in sorted(policies, key=lambda p: (p.priority, p.id)):
        if policy.enabled and all(c.matches(request) for c in policy.conditions):
            return Decision(
                effect=policy.effect,
                reason=policy.reason,
                policy_id=policy.id,
                policy_name=policy.name,
            )
    return DEFAULT_DENY
