"""Send ~35 RPS to svc-payments-v3 for 2 minutes so the watcher has v3 telemetry."""
from __future__ import annotations

import asyncio
import random
import uuid

import aiohttp

PAYMENTS_URL = "https://karma-svc-payments-v3-ucvx5uwt5q-uc.a.run.app"
REPEATED_KEYS = ["idem-key-alpha-001", "idem-key-alpha-002", "idem-key-alpha-003"]
DURATION = 120

counters = {"ok": 0, "dup": 0, "err": 0}


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


async def main() -> None:
    print(f"Sending v3 traffic for {DURATION}s to {PAYMENTS_URL}/charge")
    stop = asyncio.Event()
    connector = aiohttp.TCPConnector(limit=100)

    async with aiohttp.ClientSession(connector=connector) as session:
        async def loop() -> None:
            while not stop.is_set():
                asyncio.create_task(charge(session))
                await asyncio.sleep(1 / 35)

        task = asyncio.create_task(loop())
        await asyncio.sleep(DURATION)
        stop.set()
        await asyncio.gather(task, return_exceptions=True)

    total = counters["ok"] + counters["dup"] + counters["err"]
    print(f"Done: {total} requests — {counters['ok']} ok, {counters['dup']} dup, {counters['err']} err")


if __name__ == "__main__":
    asyncio.run(main())
