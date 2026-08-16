"""Opt-in command: python -m seed.backfill_embeddings [--limit N]."""

import argparse
import asyncio

from app.core.db import SessionLocal
from app.services.embeddings import backfill_skill_embeddings, embedding_service


async def main(limit: int | None) -> int:
    async with SessionLocal() as session:
        return await backfill_skill_embeddings(session, embedding_service(), limit=limit)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    arguments = parser.parse_args()
    print(asyncio.run(main(arguments.limit)))
