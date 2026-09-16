"""Turns a plain-English rule into a draft policy using Claude.

The LLM only ever drafts. Its output goes through the same Pydantic validation
as a hand-written policy, and nothing is saved until an admin approves it.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Sequence

import anthropic
from pydantic import BaseModel, ValidationError

from mini_ise.rules import LOCATIONS, RESOURCES, ROLES, Attribute, Effect, Op, Policy, PolicyBase

log = logging.getLogger("mini_ise.llm")

MODEL = os.environ.get("LLM_MODEL", "claude-opus-5")


class LLMUnavailable(Exception):
    """The drafting model could not be reached or the call was rejected."""


class DraftResult(BaseModel):
    feasible: bool
    explanation: str
    # What the system understood the admin to mean, shown on every draft so misreadings are caught.
    interpretation: str = ""
    # Rules the admin could type instead; only filled when the request can't become a policy.
    suggestions: list[str] = []
    policy: PolicyBase | None = None


MAX_SUGGESTIONS = 3
MAX_SUGGESTION_LENGTH = 120

# Used when the model gives no usable alternatives, e.g. its draft failed validation.
FALLBACK_SUGGESTIONS = [
    "Allow employees on managed devices to reach every resource",
    "Contractors cannot reach finance after 6pm",
    "Quarantine unpatched devices connecting remotely",
]


_CONDITION_SCHEMA = {
    "type": "object",
    "properties": {
        "attribute": {"type": "string", "enum": [a.value for a in Attribute]},
        "op": {"type": "string", "enum": [o.value for o in Op]},
        "value": {
            "anyOf": [
                {"type": "string"},
                {"type": "integer"},
                {"type": "boolean"},
                {"type": "array", "items": {"type": "string"}},
            ]
        },
    },
    "required": ["attribute", "op", "value"],
    "additionalProperties": False,
}

_POLICY_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "description": {"type": "string"},
        "priority": {"type": "integer"},
        "effect": {"type": "string", "enum": [e.value for e in Effect]},
        "reason": {"type": "string"},
        "conditions": {"type": "array", "items": _CONDITION_SCHEMA},
    },
    "required": ["name", "description", "priority", "effect", "reason", "conditions"],
    "additionalProperties": False,
}

DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "feasible": {"type": "boolean"},
        "explanation": {"type": "string"},
        "interpretation": {"type": "string"},
        "suggestions": {"type": "array", "items": {"type": "string"}},
        "policy": {"anyOf": [_POLICY_SCHEMA, {"type": "null"}]},
    },
    "required": ["feasible", "explanation", "interpretation", "suggestions", "policy"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = f"""You convert an administrator's plain-English network access rule into one structured policy for Mini ISE, a zero-trust access control service.

How evaluation works: a policy matches an access request when ALL of its conditions are true. Enabled policies are checked in ascending priority order and the first match decides. If nothing matches, access is denied.

Attributes and the operators each one accepts:
- role (eq, neq, in, not_in): {", ".join(ROLES)}
- resource (eq, neq, in, not_in): {", ".join(RESOURCES)}
- location (eq, neq, in, not_in): {", ".join(LOCATIONS)}
- device_managed, device_encrypted, device_patched (eq, neq): true or false
- hour (eq, neq, gte, lt): integer 0 to 23 on a 24-hour clock

Use eq and neq with a single string, and in and not_in with a list of strings.

Every policy needs between 1 and 10 conditions. A rule that would apply to every request, such as "allow everything" or "block everything", cannot be a policy: set feasible to false and explain that a policy with no conditions would override every other policy and the default deny that zero trust depends on.

Pick a priority that places the new policy correctly among the existing ones: a restriction (deny or quarantine) must have a lower number than any allow policy it should override. Priorities must be between 1 and 1000.

The reason is shown to the user who was affected, so keep it short and plain.

If the rule cannot be expressed as a single policy with these attributes (for example it names a specific person, needs an attribute that does not exist, or needs more than one policy), set feasible to false, set policy to null, and say in explanation what is missing. Otherwise set feasible to true and describe in one sentence what the policy does.

Always set interpretation to one plain sentence starting with "You want" that restates what the administrator asked for in everyday words, even when the rule is not feasible.

When feasible is false, set suggestions to 2 or 3 rules the administrator could type instead. Keep them as close as possible to what they asked for, make sure each one can be expressed as a single policy with the attributes above, and write each as a short plain-English instruction of at most 12 words, like "Contractors cannot reach finance after 6pm". When feasible is true, set suggestions to an empty list."""


def _describe_policies(policies: Sequence[Policy]) -> str:
    lines = [
        f"- priority {p.priority}: {p.name} -> {p.effect.value}" + ("" if p.enabled else " (disabled)")
        for p in sorted(policies, key=lambda p: (p.priority, p.id))
    ]
    return "\n".join(lines) or "(none)"


_FRIENDLY_ERRORS = {
    ("conditions", "too_short"): (
        "a policy needs at least one condition. A policy that matches every request would override "
        "all other policies and the default deny"
    ),
    ("conditions", "too_long"): "a policy can have at most 10 conditions",
    ("priority", "greater_than_equal"): "priority must be between 1 and 1000",
    ("priority", "less_than_equal"): "priority must be between 1 and 1000",
}


def explain_validation_error(exc: ValidationError) -> str:
    """Turn Pydantic errors into sentences an admin can act on."""
    problems: list[str] = []
    for err in exc.errors():
        loc = err["loc"]
        friendly = _FRIENDLY_ERRORS.get((str(loc[0]), err["type"])) if len(loc) == 1 else None
        if friendly:
            problems.append(friendly)
            continue
        message = err["msg"].removeprefix("Value error, ")
        if len(loc) >= 2 and loc[0] == "conditions" and isinstance(loc[1], int):
            problems.append(f"condition {loc[1] + 1}: {message}")
        elif loc:
            problems.append(f"{'.'.join(str(part) for part in loc)}: {message}")
        else:
            problems.append(message)
    return "; ".join(dict.fromkeys(problems))


def _clean_suggestions(raw: object) -> list[str]:
    if not isinstance(raw, list):
        return []
    cleaned = [s.strip() for s in raw if isinstance(s, str) and s.strip()]
    return [s for s in dict.fromkeys(cleaned) if len(s) <= MAX_SUGGESTION_LENGTH][:MAX_SUGGESTIONS]


def parse_draft(raw_json: str) -> DraftResult:
    """Validate the model's JSON. A draft that fails validation is never offered for approval."""
    data = json.loads(raw_json)
    interpretation = data.get("interpretation") if isinstance(data.get("interpretation"), str) else ""

    if not data.get("feasible") or data.get("policy") is None:
        return DraftResult(
            feasible=False,
            explanation=data.get("explanation") or "The rule could not be drafted.",
            interpretation=interpretation,
            suggestions=_clean_suggestions(data.get("suggestions")) or FALLBACK_SUGGESTIONS,
        )
    try:
        policy = PolicyBase.model_validate(data["policy"])
    except ValidationError as exc:
        return DraftResult(
            feasible=False,
            explanation=f"The AI draft can't be used: {explain_validation_error(exc)}.",
            interpretation=interpretation,
            suggestions=FALLBACK_SUGGESTIONS,
        )
    return DraftResult(
        feasible=True, explanation=data.get("explanation", ""), interpretation=interpretation, policy=policy
    )


async def draft_policy(text: str, existing: Sequence[Policy]) -> DraftResult:
    # The SDK raises a bare TypeError when it finds no credentials; check first for a clear error.
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        raise LLMUnavailable("ANTHROPIC_API_KEY is not set, so AI drafting is off")
    try:
        client = anthropic.AsyncAnthropic(timeout=60, max_retries=1)
        response = await client.beta.messages.create(
            model=MODEL,
            max_tokens=8000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": DRAFT_SCHEMA}},
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Existing policies:\n{_describe_policies(existing)}\n\nRule to draft:\n{text}",
                }
            ],
        )
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as exc:
        raise LLMUnavailable("Anthropic API key is missing or invalid") from exc
    except anthropic.RateLimitError as exc:
        raise LLMUnavailable("Anthropic rate limit reached, try again shortly") from exc
    except anthropic.APIStatusError as exc:
        log.error("draft failed: status=%s request_id=%s", exc.status_code, exc.request_id)
        raise LLMUnavailable(f"Anthropic API error ({exc.status_code})") from exc
    except anthropic.APIConnectionError as exc:
        raise LLMUnavailable("Could not reach the Anthropic API") from exc
    except anthropic.AnthropicError as exc:
        raise LLMUnavailable(str(exc)) from exc

    if response.stop_reason == "refusal":
        return DraftResult(feasible=False, explanation="The model declined to draft this rule.")
    if response.stop_reason == "max_tokens":
        raise LLMUnavailable("The draft was cut off before it finished")

    text_block = next((b for b in response.content if b.type == "text"), None)
    if text_block is None:
        raise LLMUnavailable("The model returned no draft")
    return parse_draft(text_block.text)
