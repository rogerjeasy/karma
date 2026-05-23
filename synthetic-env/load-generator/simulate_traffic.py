"""
Async traffic simulator for svc-payments-v2.

Mimics the k6 load-generator script:
  - ~50 RPS to /charge
  - 3% of requests use a repeated Idempotency-Key (exercises error-semantics contract)
  - 1 RPS to svc-reporting /dashboard/charges-summary
  - Runs for DURATION seconds (default 300)

Usage:
  python simulate_traffic.py [duration_seconds]
"""
from __future__ import annotations

import asyncio
import json
import random
import sys
import time
import uuid

import aiohttp

PAYMENTS_URL = "https://karma-svc-payments-v2-ucvx5uwt5q-uc.a.run.app"
REPORTING_URL = "https://karma-svc-reporting-ucvx5uwt5q-uc.a.run.app"

REPEATED_KEYS = ["idem-key-alpha-001", "idem-key-alpha-002", "idem-key-alpha-003"]
TARGET_RPS = 50
DURATION = int(sys.argv[1]) if len(sys.argv) > 1 else 300

counters = {"ok": 0, "dup": 0, "err": 0, "reporting": 0}


async def charge(session: aiohttp.ClientSession) -> None:
    use_repeat = random.random() < 0.03
    idem_key = random.choice(REPEATED_KEYS) if use_repeat else f"idem-{uuid.uuid4()}"
    payload = {"amount": round(random.uniform(1, 500), 2), "currency": "USD"}
    try:
        async with session.post(
            f"{PAYMENTS_URL}/charge",
            json=payload,
            headers={"Idempotency-Key": idem_key},
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status == 200:
                counters["ok"] += 1
            elif resp.status == 409:
                counters["dup"] += 1
            else:
                counters["err"] += 1
    except Exception:
        counters["err"] += 1


async def poll_reporting(session: aiohttp.ClientSession) -> None:
    try:
        async with session.get(
            f"{REPORTING_URL}/dashboard/charges-summary",
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status == 200:
                counters["reporting"] += 1
    except Exception:
        pass


async def payments_loop(session: aiohttp.ClientSession, stop: asyncio.Event) -> None:
    interval = 1.0 / TARGET_RPS
    while not stop.is_set():
        asyncio.create_task(charge(session))
        await asyncio.sleep(interval)


async def reporting_loop(session: aiohttp.ClientSession, stop: asyncio.Event) -> None:
    while not stop.is_set():
        asyncio.create_task(poll_reporting(session))
        await asyncio.sleep(1.0)


async def stats_loop(stop: asyncio.Event) -> None:
    start = time.monotonic()
    while not stop.is_set():
        await asyncio.sleep(10)
        elapsed = time.monotonic() - start
        total = counters["ok"] + counters["dup"] + counters["err"]
        rps = total / elapsed if elapsed else 0
        print(
            f"[{elapsed:5.0f}s] ok={counters['ok']:>5}  dup={counters['dup']:>4}  "
            f"err={counters['err']:>3}  reporting={counters['reporting']:>4}  "
            f"rps={rps:.1f}",
            flush=True,
        )


async def main() -> None:
    print(f"Starting traffic simulation: {TARGET_RPS} RPS for {DURATION}s")
    print(f"  Payments  -> {PAYMENTS_URL}/charge")
    print(f"  Reporting -> {REPORTING_URL}/dashboard/charges-summary")
    print()

    stop = asyncio.Event()
    connector = aiohttp.TCPConnector(limit=100)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [
            asyncio.create_task(payments_loop(session, stop)),
            asyncio.create_task(reporting_loop(session, stop)),
            asyncio.create_task(stats_loop(stop)),
        ]
        await asyncio.sleep(DURATION)
        stop.set()
        await asyncio.gather(*tasks, return_exceptions=True)

    total = counters["ok"] + counters["dup"] + counters["err"]
    print(f"\nDone. {total} requests sent: {counters['ok']} ok, {counters['dup']} duplicates, {counters['err']} errors")


if __name__ == "__main__":
    asyncio.run(main())
