"""Device simulator: sends a steady stream of realistic access requests.

Stands in for real laptops and phones so the console has live traffic during
a demo. Run with: uv run mini-ise-simulator --rps 20
"""

from __future__ import annotations

import argparse
import asyncio
import os
import random
import time
from collections import Counter

import httpx

FIRST_NAMES = ["priya", "marcus", "lena", "omar", "jun", "sofia", "dev", "amara", "tom", "yuki"]

# (weight, role, chance device is managed, chance encrypted, chance patched)
PERSONAS = [
    (55, "employee", 0.95, 0.93, 0.85),
    (20, "contractor", 0.50, 0.80, 0.75),
    (15, "guest", 0.05, 0.60, 0.60),
    (10, "admin", 1.00, 0.98, 0.95),
]
RESOURCE_WEIGHTS = {"email": 30, "wiki": 25, "engineering": 25, "finance": 12, "hr": 8}


def random_request(rng: random.Random, hour: int) -> dict[str, object]:
    _, role, managed, encrypted, patched = rng.choices(PERSONAS, weights=[p[0] for p in PERSONAS])[0]
    user = rng.choice(FIRST_NAMES)
    return {
        "user": f"{user}.{role}",
        "device_id": f"{user[:3]}-{rng.randint(100, 999)}",
        "role": role,
        "resource": rng.choices(list(RESOURCE_WEIGHTS), weights=list(RESOURCE_WEIGHTS.values()))[0],
        "location": "office" if rng.random() < 0.6 else "remote",
        "device_managed": rng.random() < managed,
        "device_encrypted": rng.random() < encrypted,
        "device_patched": rng.random() < patched,
        "hour": hour,
    }


async def run(url: str, rps: float, seconds_per_hour: float, max_in_flight: int) -> None:
    rng = random.Random()
    counts: Counter[str] = Counter()
    pods: Counter[str] = Counter()
    in_flight = asyncio.Semaphore(max_in_flight)
    loop = asyncio.get_running_loop()
    started = loop.time()

    def simulated_hour() -> int:
        # A fast clock starting at 08:00 lets after-hours policies show up in a short demo.
        return (8 + int((loop.time() - started) / seconds_per_hour)) % 24

    async def send(client: httpx.AsyncClient) -> None:
        try:
            response = await client.post(f"{url}/v1/decide", json=random_request(rng, simulated_hour()))
            response.raise_for_status()
            body = response.json()
            counts[body["effect"]] += 1
            pods[body["served_by"]] += 1
        except httpx.HTTPError:
            counts["error"] += 1
        finally:
            in_flight.release()

    async def report() -> None:
        while True:
            await asyncio.sleep(5)
            print(
                f"[{time.strftime('%H:%M:%S')}] sim-hour={simulated_hour():02d}:00 {dict(counts)} pods={dict(pods)}",
                flush=True,
            )
            counts.clear()
            pods.clear()

    reporter = asyncio.create_task(report())
    tasks: set[asyncio.Task[None]] = set()
    interval = 1 / rps
    next_send = loop.time()
    print(f"Sending {rps} requests/s to {url} (Ctrl+C to stop)")
    # No keep-alive: a Kubernetes Service balances per connection, so reused connections
    # would stay pinned to the old pods and newly scaled pods would get no traffic.
    async with httpx.AsyncClient(timeout=5, limits=httpx.Limits(max_keepalive_connections=0)) as client:
        try:
            while True:
                if in_flight.locked():
                    counts["skipped"] += 1
                else:
                    await in_flight.acquire()
                    task = asyncio.create_task(send(client))
                    tasks.add(task)
                    task.add_done_callback(tasks.discard)
                next_send += interval
                await asyncio.sleep(max(0.0, next_send - loop.time()))
        finally:
            reporter.cancel()


def main() -> None:
    parser = argparse.ArgumentParser(description="Send simulated device access requests.")
    parser.add_argument("--url", default=os.environ.get("DECISION_URL", "http://localhost:8000"))
    parser.add_argument("--rps", type=float, default=float(os.environ.get("RPS", "10")))
    parser.add_argument(
        "--seconds-per-hour",
        type=float,
        default=float(os.environ.get("SECONDS_PER_HOUR", "30")),
        help="Real seconds per simulated hour of the day",
    )
    parser.add_argument("--max-in-flight", type=int, default=200)
    args = parser.parse_args()
    try:
        asyncio.run(run(args.url, args.rps, args.seconds_per_hour, args.max_in_flight))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
