"""Rich traffic generator for the svc-payments-v2 LEARNING burst.

Run this BEFORE triggering the Karma Learner. It drives v2 across its full
endpoint surface so the Learner discovers contracts in most of its eight
categories from real telemetry:

  ~80% POST /charge        (3% reuse a fixed Idempotency-Key → 409 path;
                            ~3% malformed → 400/422 error-semantics)
  ~10% GET  /charges       (list read path — its own latency band)
  ~ 6% GET  /charge/{id}   (status lookup — fast read band; uses a captured id)
  ~ 4% POST /refund        (ledger + audit side effects; uses a captured id)
  + ~1 RPS GET svc-reporting widgets (warm-cache fast path during learning)

While v2 is live its background loop warms recent_charges:summary every 30s
(the side_effect contract) — that is expected and correct DURING learning.
After learning + cutover, stop driving v2 so the cache goes cold and the v3
regression becomes visible (that steady state is what script.js / the k6 Cloud
Run job drives against v3 + reporting).

Usage:
  python simulate_traffic.py [duration_seconds]   # default 600
"""
from __future__ import annotations

import asyncio
import random
import sys
import time
import uuid
from collections import deque

import aiohttp

PAYMENTS_URL = "https://karma-svc-payments-v2-ucvx5uwt5q-uc.a.run.app"
REPORTING_URL = "https://karma-svc-reporting-ucvx5uwt5q-uc.a.run.app"

REPEATED_KEYS = ["idem-key-alpha-001", "idem-key-alpha-002", "idem-key-alpha-003"]
CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY"]
TARGET_RPS = 50
DURATION = int(sys.argv[1]) if len(sys.argv) > 1 else 600

_recent_txns: "deque[str]" = deque(maxlen=200)
counters = {"ok": 0, "dup": 0, "bad": 0, "declined": 0, "list": 0, "lookup": 0, "refund": 0, "err": 0, "reporting": 0}


async def _post_charge(session: aiohttp.ClientSession) -> None:
    roll = random.random()
    if roll < 0.015:
        payload = {"amount": -5, "currency": "USD"}          # → 400
    elif roll < 0.03:
        payload = {"amount": 12.5, "currency": "XYZ"}        # → 422
    else:
        payload = {"amount": round(random.uniform(1, 500), 2), "currency": random.choice(CURRENCIES)}

    use_repeat = random.random() < 0.03
    idem_key = random.choice(REPEATED_KEYS) if use_repeat else f"idem-{uuid.uuid4()}"
    try:
        async with session.post(
            f"{PAYMENTS_URL}/charge",
            json=payload,
            headers={"Idempotency-Key": idem_key},
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status == 200:
                counters["ok"] += 1
                try:
                    data = await resp.json()
                    if data.get("txn_id"):
                        _recent_txns.append(data["txn_id"])
                except Exception:
                    pass
            elif resp.status == 409:
                counters["dup"] += 1
            elif resp.status in (400, 422):
                counters["bad"] += 1
            elif resp.status == 402:
                counters["declined"] += 1
            else:
                counters["err"] += 1
    except Exception:
        counters["err"] += 1


async def _list_charges(session: aiohttp.ClientSession) -> None:
    try:
        async with session.get(f"{PAYMENTS_URL}/charges?limit=20", timeout=aiohttp.ClientTimeout(total=10)) as resp:
            counters["list" if resp.status == 200 else "err"] += 1
    except Exception:
        counters["err"] += 1


async def _lookup_charge(session: aiohttp.ClientSession) -> None:
    if not _recent_txns:
        return await _post_charge(session)
    txn = random.choice(list(_recent_txns))
    try:
        async with session.get(f"{PAYMENTS_URL}/charge/{txn}", timeout=aiohttp.ClientTimeout(total=10)) as resp:
            counters["lookup" if resp.status == 200 else "err"] += 1
    except Exception:
        counters["err"] += 1


async def _refund(session: aiohttp.ClientSession) -> None:
    if not _recent_txns:
        return await _post_charge(session)
    txn = random.choice(list(_recent_txns))
    try:
        async with session.post(
            f"{PAYMENTS_URL}/refund", json={"txn_id": txn}, timeout=aiohttp.ClientTimeout(total=10)
        ) as resp:
            counters["refund" if resp.status == 200 else "err"] += 1
    except Exception:
        counters["err"] += 1


async def _one_request(session: aiohttp.ClientSession) -> None:
    r = random.random()
    if r < 0.80:
        await _post_charge(session)
    elif r < 0.90:
        await _list_charges(session)
    elif r < 0.96:
        await _lookup_charge(session)
    else:
        await _refund(session)


async def poll_reporting(session: aiohttp.ClientSession) -> None:
    path = "/dashboard/charges-summary" if random.random() < 0.5 else "/dashboard/top-merchants"
    try:
        async with session.get(f"{REPORTING_URL}{path}", timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status == 200:
                counters["reporting"] += 1
    except Exception:
        pass


async def payments_loop(session: aiohttp.ClientSession, stop: asyncio.Event) -> None:
    interval = 1.0 / TARGET_RPS
    while not stop.is_set():
        asyncio.create_task(_one_request(session))
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
        total = sum(counters[k] for k in ("ok", "dup", "bad", "declined", "list", "lookup", "refund", "err"))
        rps = total / elapsed if elapsed else 0
        print(
            f"[{elapsed:5.0f}s] ok={counters['ok']:>5} dup={counters['dup']:>4} bad={counters['bad']:>3} "
            f"declined={counters['declined']:>3} list={counters['list']:>4} lookup={counters['lookup']:>4} "
            f"refund={counters['refund']:>3} reporting={counters['reporting']:>4} err={counters['err']:>3} "
            f"rps={rps:.1f}",
            flush=True,
        )


async def main() -> None:
    print(f"v2 LEARNING burst: ~{TARGET_RPS} RPS for {DURATION}s")
    print(f"  Payments  -> {PAYMENTS_URL} (charge/list/lookup/refund mix)")
    print(f"  Reporting -> {REPORTING_URL} (warm-cache fast path)")
    print()

    stop = asyncio.Event()
    connector = aiohttp.TCPConnector(limit=120)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [
            asyncio.create_task(payments_loop(session, stop)),
            asyncio.create_task(reporting_loop(session, stop)),
            asyncio.create_task(stats_loop(stop)),
        ]
        await asyncio.sleep(DURATION)
        stop.set()
        await asyncio.gather(*tasks, return_exceptions=True)

    total = sum(counters[k] for k in ("ok", "dup", "bad", "declined", "list", "lookup", "refund", "err"))
    print(f"\nDone. {total} requests: {dict(counters)}")


if __name__ == "__main__":
    asyncio.run(main())
