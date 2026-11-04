from functools import lru_cache

from supabase import Client, create_client

from app.core.config import SUPABASE_KEY, SUPABASE_URL


@lru_cache
def get_db() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


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
