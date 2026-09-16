"""Postgres connection pool, schema and seed policies shared by both services."""

from __future__ import annotations

import os

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from mini_ise.rules import Policy, PolicyBase

DEFAULT_DATABASE_URL = "postgresql://mini_ise:mini_ise@localhost:5433/mini_ise"

SCHEMA = """
CREATE TABLE IF NOT EXISTS policies (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority    INTEGER NOT NULL,
    effect      TEXT NOT NULL,
    reason      TEXT NOT NULL,
    conditions  JSONB NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    source      TEXT NOT NULL DEFAULT 'manual',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decisions (
    id          BIGSERIAL PRIMARY KEY,
    decided_at  TIMESTAMPTZ NOT NULL,
    user_name   TEXT NOT NULL,
    role        TEXT NOT NULL,
    device_id   TEXT NOT NULL,
    resource    TEXT NOT NULL,
    location    TEXT NOT NULL,
    hour        INTEGER NOT NULL,
    effect      TEXT NOT NULL,
    reason      TEXT NOT NULL,
    policy_id   INTEGER,
    served_by   TEXT NOT NULL,
    latency_ms  REAL NOT NULL,
    request     JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS decisions_decided_at_idx ON decisions (decided_at DESC);
"""

POLICY_COLUMNS = "id, name, description, priority, effect, reason, conditions, enabled, source"


def _condition(attribute: str, op: str, value: object) -> dict[str, object]:
    return {"attribute": attribute, "op": op, "value": value}


SEED_POLICIES: list[PolicyBase] = [
    PolicyBase.model_validate(p)
    for p in [
        {
            "name": "Quarantine unencrypted devices",
            "priority": 10,
            "effect": "quarantine",
            "reason": "Device disk is not encrypted",
            "conditions": [_condition("device_encrypted", "eq", False)],
        },
        {
            "name": "Unpatched devices stay out of sensitive systems",
            "priority": 20,
            "effect": "deny",
            "reason": "Device is missing security patches",
            "conditions": [
                _condition("device_patched", "eq", False),
                _condition("resource", "in", ["finance", "hr"]),
            ],
        },
        {
            "name": "Guests may use the wiki",
            "priority": 30,
            "effect": "allow",
            "reason": "Guest access to the wiki",
            "conditions": [_condition("role", "eq", "guest"), _condition("resource", "eq", "wiki")],
        },
        {
            "name": "Guests blocked elsewhere",
            "priority": 35,
            "effect": "deny",
            "reason": "Guests may only access the wiki",
            "conditions": [_condition("role", "eq", "guest")],
        },
        {
            "name": "Contractors blocked from finance and HR",
            "priority": 40,
            "effect": "deny",
            "reason": "Contractors cannot access finance or HR",
            "conditions": [
                _condition("role", "eq", "contractor"),
                _condition("resource", "in", ["finance", "hr"]),
            ],
        },
        {
            "name": "Contractors on managed devices",
            "priority": 50,
            "effect": "allow",
            "reason": "Contractor on a company-managed device",
            "conditions": [
                _condition("role", "eq", "contractor"),
                _condition("device_managed", "eq", True),
            ],
        },
        {
            "name": "Employees and admins",
            "priority": 60,
            "effect": "allow",
            "reason": "Employee access",
            "conditions": [_condition("role", "in", ["employee", "admin"])],
        },
    ]
]


def database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


def make_pool() -> AsyncConnectionPool:
    # open=False: each service decides whether startup waits for the database.
    return AsyncConnectionPool(database_url(), min_size=1, max_size=5, open=False, timeout=5)


async def init_schema(pool: AsyncConnectionPool) -> None:
    async with pool.connection() as conn:
        await conn.execute(SCHEMA)


async def seed_if_empty(pool: AsyncConnectionPool) -> None:
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT count(*) FROM policies")
        row = await cur.fetchone()
        if row and row[0] > 0:
            return
        for policy in SEED_POLICIES:
            await insert_policy(conn, policy, source="seed")


async def insert_policy(conn: AsyncConnection, policy: PolicyBase, source: str) -> Policy:
    cur = conn.cursor(row_factory=dict_row)
    await cur.execute(
        f"""
        INSERT INTO policies (name, description, priority, effect, reason, conditions, source)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING {POLICY_COLUMNS}
        """,
        (
            policy.name,
            policy.description,
            policy.priority,
            policy.effect.value,
            policy.reason,
            Jsonb([c.model_dump(mode="json") for c in policy.conditions]),
            source,
        ),
    )
    return Policy.model_validate(await cur.fetchone())
