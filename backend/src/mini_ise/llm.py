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
    policy: PolicyBase | None = None


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
        "policy": {"anyOf": [_POLICY_SCHEMA, {"type": "null"}]},
    },
    "required": ["feasible", "explanation", "policy"],
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

Pick a priority that places the new policy correctly among the existing ones: a restriction (deny or quarantine) must have a lower number than any allow policy it should override. Priorities must be between 1 and 1000.

The reason is shown to the user who was affected, so keep it short and plain.

If the rule cannot be expressed as a single policy with these attributes (for example it names a specific person, needs an attribute that does not exist, or needs more than one policy), set feasible to false, set policy to null, and say in explanation what is missing. Otherwise set feasible to true and describe in one sentence what the policy does."""


def _describe_policies(policies: Sequence[Policy]) -> str:
    lines = [
        f"- priority {p.priority}: {p.name} -> {p.effect.value}" + ("" if p.enabled else " (disabled)")
        for p in sorted(policies, key=lambda p: (p.priority, p.id))
    ]
    return "\n".join(lines) or "(none)"


def parse_draft(raw_json: str) -> DraftResult:
    """Validate the model's JSON. A draft that fails validation is never offered for approval."""
    data = json.loads(raw_json)
    if not data.get("feasible") or data.get("policy") is None:
        return DraftResult(feasible=False, explanation=data.get("explanation") or "The rule could not be drafted.")
    try:
        policy = PolicyBase.model_validate(data["policy"])
    except ValidationError as exc:
        problems = "; ".join(err["msg"] for err in exc.errors())
        return DraftResult(feasible=False, explanation=f"The AI draft failed validation: {problems}")
    return DraftResult(feasible=True, explanation=data.get("explanation", ""), policy=policy)


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
