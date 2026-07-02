import json
import os
import uuid
from datetime import datetime
from decimal import Decimal

import asyncpg

_pool: asyncpg.Pool | None = None


async def _init_connection(conn: asyncpg.Connection):
    # asyncpg doesn't decode jsonb by default; audit_logs.details needs to
    # round-trip as a plain Python dict on both insert and select.
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog", format="text"
    )


async def init_pool() -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(
        os.environ["DATABASE_URL"], min_size=2, max_size=10, init=_init_connection
    )
    return _pool


async def close_pool():
    if _pool is not None:
        await _pool.close()


def get_pool() -> asyncpg.Pool:
    return _pool


def pg_doc(record) -> dict | None:
    """Equivalent of the old Mongo doc(): converts a Record to a JSON-safe dict."""
    if record is None:
        return None
    r = {}
    for k, v in dict(record).items():
        if isinstance(v, uuid.UUID):
            r[k] = str(v)
        elif isinstance(v, datetime):
            r[k] = v.isoformat()
        elif isinstance(v, Decimal):
            r[k] = float(v)
        else:
            r[k] = v
    return r


def pg_docs(records) -> list:
    return [pg_doc(r) for r in records]


async def pg_update(conn, table: str, row_id, fields: dict, id_col: str = "id"):
    """Partial UPDATE helper, equivalent of Mongo's {"$set": exclude_unset}.
    Column names come only from Pydantic model field names, never raw user input."""
    fields = {k: v for k, v in fields.items() if v is not None}
    if not fields:
        return
    set_clause = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(fields))
    await conn.execute(
        f"UPDATE {table} SET {set_clause}, updated_at = now() WHERE {id_col} = $1",
        row_id, *fields.values(),
    )
