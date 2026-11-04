import functools
import threading

import httpx
import postgrest._sync.request_builder as _rb
from supabase import Client, create_client

from app.core.config import SUPABASE_KEY, SUPABASE_URL

_local = threading.local()

# Supabase closes idle HTTP/2 connections (e.g. while a long Gemini call runs). The first request on a
# dropped connection fails with "Server disconnected"; httpx opens a fresh one on retry, so retry once.
_TRANSIENT = (httpx.RemoteProtocolError, httpx.ReadError, httpx.WriteError, httpx.ConnectError, httpx.PoolTimeout)


def _with_retry(execute):
    @functools.wraps(execute)
    def wrapper(self, *args, **kwargs):
        try:
            return execute(self, *args, **kwargs)
        except _TRANSIENT:
            return execute(self, *args, **kwargs)
    return wrapper


for _name in ("SyncQueryRequestBuilder", "SyncSingleRequestBuilder", "SyncMaybeSingleRequestBuilder",
              "SyncFilterRequestBuilder", "SyncSelectRequestBuilder", "SyncRPCFilterRequestBuilder"):
    _cls = getattr(_rb, _name, None)
    if _cls is not None and "execute" in _cls.__dict__ and not getattr(_cls.execute, "_retrying", False):
        _cls.execute = _with_retry(_cls.execute)
        _cls.execute._retrying = True


def get_db() -> Client:
    """One client per worker thread: the shared HTTP/2 connection inside a single client
    is not thread-safe and fails under concurrent requests."""
    client = getattr(_local, "client", None)
    if client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set")
        client = _local.client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return client


def rows(query) -> list[dict]:
    return query.execute().data or []


def one(query) -> dict | None:
    data = query.limit(1).execute().data
    return data[0] if data else None


def audit(actor_user_id: str | None, action_type: str, target_table: str, target_record_id: str | None, payload: dict):
    get_db().table("rbac_audit_logs").insert({
        "actor_user_id": actor_user_id,
        "action_type": action_type,
        "target_table": target_table,
        "target_record_id": target_record_id,
        "payload_diff": payload,
    }).execute()


def remember(user_id: str, scope: str, summary: str, context: dict | None = None):
    get_db().table("agent_memory_logs").insert({
        "user_id": user_id, "memory_scope": scope, "memory_summary": summary, "structured_context": context or {},
    }).execute()
