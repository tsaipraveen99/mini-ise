"""Decision service: answers "can this device reach this resource?"

Designed as the hot path. A request touches no network: policies are held in
memory and refreshed in the background, and decision log rows are buffered and
written to Postgres in batches. If the database goes away, the service keeps
deciding with the last policies it loaded.
"""

from __future__ import annotations

import asyncio
import logging
import os
import socket
import time
from collections import deque
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime

from fastapi import FastAPI, Response, status
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool
from pydantic import ValidationError

from mini_ise.db import POLICY_COLUMNS, make_pool
from mini_ise.rules import AccessRequest, Decision, Effect, Policy, evaluate

log = logging.getLogger("mini_ise.decision")

POD_NAME = os.environ.get("POD_NAME") or socket.gethostname()
POLICY_REFRESH_SECONDS = float(os.environ.get("POLICY_REFRESH_SECONDS", "3"))
LOG_FLUSH_SECONDS = 1.0
# Bounds memory if the database is down for a long time.
LOG_BUFFER_MAX = 10_000

INSERT_DECISION = """
INSERT INTO decisions (decided_at, user_name, role, device_id, resource, location, hour,
                       effect, reason, policy_id, served_by, latency_ms, request)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

NOT_LOADED = Decision(effect=Effect.DENY, reason="Policies not loaded yet (failing closed)")


@dataclass
class State:
    policies: list[Policy] = field(default_factory=list)
    loaded_at: float | None = None
    pending: deque[tuple[object, ...]] = field(default_factory=lambda: deque(maxlen=LOG_BUFFER_MAX))


state = State()


class DecisionResponse(Decision):
    served_by: str
    latency_ms: float


async def refresh_policies(pool: AsyncConnectionPool) -> None:
    async with pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(f"SELECT {POLICY_COLUMNS} FROM policies WHERE enabled")
        rows = await cur.fetchall()

    policies = []
    for row in rows:
        try:
            policies.append(Policy.model_validate(row))
        except ValidationError as exc:
            log.warning("skipping invalid policy %s: %s", row.get("id"), exc)
    state.policies = policies
    state.loaded_at = time.time()


async def flush_decisions(pool: AsyncConnectionPool) -> None:
    if not state.pending:
        return
    batch = [state.pending.popleft() for _ in range(len(state.pending))]
    try:
        async with pool.connection() as conn, conn.cursor() as cur:
            await cur.executemany(INSERT_DECISION, batch)
    except Exception:
        # Put the rows back so the next flush retries them.
        state.pending.extendleft(reversed(batch))
        raise


async def run_every(seconds: float, job: Callable[[], Awaitable[None]], name: str) -> None:
    while True:
        try:
            await job()
        except Exception as exc:
            log.warning("%s failed: %s", name, exc)
        await asyncio.sleep(seconds)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    pool = make_pool()
    # Don't block startup on the database; /readyz reports when policies arrive.
    await pool.open(wait=False)
    tasks = [
        asyncio.create_task(run_every(POLICY_REFRESH_SECONDS, lambda: refresh_policies(pool), "policy refresh")),
        asyncio.create_task(run_every(LOG_FLUSH_SECONDS, lambda: flush_decisions(pool), "decision log flush")),
    ]
    yield
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    try:
        await flush_decisions(pool)
    except Exception as exc:
        log.warning("final flush failed, %d decisions not logged: %s", len(state.pending), exc)
    await pool.close()


app = FastAPI(title="Mini ISE decision service", lifespan=lifespan)


@app.post("/v1/decide")
async def decide(request: AccessRequest) -> DecisionResponse:
    started = time.perf_counter()
    decision = NOT_LOADED if state.loaded_at is None else evaluate(state.policies, request)
    latency_ms = (time.perf_counter() - started) * 1000

    state.pending.append(
        (
            datetime.now(UTC),
            request.user,
            request.role,
            request.device_id,
            request.resource,
            request.location,
            request.hour,
            decision.effect.value,
            decision.reason,
            decision.policy_id,
            POD_NAME,
            latency_ms,
            Jsonb(request.model_dump()),
        )
    )
    return DecisionResponse(**decision.model_dump(), served_by=POD_NAME, latency_ms=round(latency_ms, 3))


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
async def readyz(response: Response) -> dict[str, object]:
    if state.loaded_at is None:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"ready": False, "reason": "policies not loaded"}
    return {"ready": True, "policies": len(state.policies), "loaded_at": state.loaded_at}
