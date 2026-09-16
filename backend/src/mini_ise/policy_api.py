"""Policy API: admin-facing CRUD, AI drafting, and read access to the decision log.

Not on the decision hot path. The decision service reads policies from
Postgres directly, so this service can be down without affecting access.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from pydantic import BaseModel, Field

from mini_ise.db import POLICY_COLUMNS, init_schema, insert_policy, make_pool, seed_if_empty
from mini_ise.llm import DraftResult, LLMUnavailable, draft_policy
from mini_ise.rules import Policy, PolicyBase


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    pool = make_pool()
    # Fail startup if the database never shows up; Kubernetes restarts the pod.
    await pool.open(wait=True, timeout=30)
    await init_schema(pool)
    await seed_if_empty(pool)
    app.state.pool = pool
    yield
    await pool.close()


app = FastAPI(title="Mini ISE policy API", lifespan=lifespan)


def get_pool(request: Request) -> AsyncConnectionPool:
    return request.app.state.pool


Pool = Annotated[AsyncConnectionPool, Depends(get_pool)]


class PolicyCreate(PolicyBase):
    source: str = Field(default="manual", pattern="^(manual|ai)$")


class PolicyUpdate(BaseModel):
    enabled: bool


class DraftRequest(BaseModel):
    text: str = Field(min_length=5, max_length=500)


class DecisionRow(BaseModel):
    id: int
    decided_at: datetime
    user_name: str
    role: str
    device_id: str
    resource: str
    location: str
    hour: int
    effect: str
    reason: str
    policy_id: int | None
    served_by: str
    latency_ms: float


class Stats(BaseModel):
    window_seconds: int
    by_effect: dict[str, int]
    by_pod: dict[str, int]


async def load_policies(pool: AsyncConnectionPool) -> list[Policy]:
    async with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(f"SELECT {POLICY_COLUMNS} FROM policies ORDER BY priority, id")
        return [Policy.model_validate(row) for row in await cur.fetchall()]


@app.get("/v1/policies")
async def list_policies(pool: Pool) -> list[Policy]:
    return await load_policies(pool)


@app.post("/v1/policies", status_code=status.HTTP_201_CREATED)
async def create_policy(body: PolicyCreate, pool: Pool) -> Policy:
    async with pool.connection() as conn:
        return await insert_policy(conn, body, source=body.source)


@app.patch("/v1/policies/{policy_id}")
async def update_policy(policy_id: int, body: PolicyUpdate, pool: Pool) -> Policy:
    async with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            f"UPDATE policies SET enabled = %s WHERE id = %s RETURNING {POLICY_COLUMNS}",
            (body.enabled, policy_id),
        )
        row = await cur.fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Policy not found")
    return Policy.model_validate(row)


@app.delete("/v1/policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(policy_id: int, pool: Pool) -> None:
    async with pool.connection() as conn:
        cur = await conn.execute("DELETE FROM policies WHERE id = %s", (policy_id,))
        if cur.rowcount == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Policy not found")


@app.post("/v1/policies/draft")
async def draft(body: DraftRequest, pool: Pool) -> DraftResult:
    try:
        return await draft_policy(body.text, await load_policies(pool))
    except LLMUnavailable as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc


@app.get("/v1/decisions")
async def recent_decisions(pool: Pool, limit: Annotated[int, Query(ge=1, le=200)] = 50) -> list[DecisionRow]:
    async with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            SELECT id, decided_at, user_name, role, device_id, resource, location, hour,
                   effect, reason, policy_id, served_by, latency_ms
            FROM decisions ORDER BY decided_at DESC LIMIT %s
            """,
            (limit,),
        )
        return [DecisionRow.model_validate(row) for row in await cur.fetchall()]


@app.get("/v1/stats")
async def stats(pool: Pool, window: Annotated[int, Query(ge=5, le=3600)] = 60) -> Stats:
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT effect, count(*) FROM decisions"
            " WHERE decided_at > now() - make_interval(secs => %s) GROUP BY effect",
            (window,),
        )
        by_effect = {effect: count for effect, count in await cur.fetchall()}
        cur = await conn.execute(
            "SELECT served_by, count(*) FROM decisions"
            " WHERE decided_at > now() - make_interval(secs => %s) GROUP BY served_by",
            (window,),
        )
        by_pod = {pod: count for pod, count in await cur.fetchall()}
    return Stats(window_seconds=window, by_effect=by_effect, by_pod=by_pod)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
