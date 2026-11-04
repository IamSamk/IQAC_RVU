"""Demo seeding: SQL `seed_demo()` for static data, then Agent 1 builds the semester and plays sessions 1-12."""
import random

from app.agents import pacing
from app.core import config
from app.core.db import get_db, rows

O_CS304 = "40000000-0000-0000-0000-000000000001"
O_DES201 = "40000000-0000-0000-0000-000000000002"
HARRIS = "50000000-0000-0000-0001-000000000203"

DEMO_TRANSCRIPT = ("Today we continue with feature detection. Recall the structure tensor from the image gradients. "
                   "When both eigenvalues are large we have a corner, which is the Harris response. We then built the scale space "
                   "using differences of Gaussians before SIFT descriptors...")


def _play_sessions(offering_id: str, upto: int, behind_session: int | None = None, behind_chunk: str | None = None):
    db = get_db()
    sessions = rows(db.table("session_plans").select("*").eq("offering_id", offering_id).order("session_number"))
    chunks = {c["chunk_id"]: c for c in rows(db.table("syllabus_chunks").select("*"))}
    last_seen = {}
    for s in sessions:
        for c in s["planned_chunk_ids"] or []:
            last_seen[c] = s["session_number"]
    for s in sessions:
        n = s["session_number"]
        if n > upto:
            break
        covered = [c for c in s["planned_chunk_ids"] or [] if last_seen.get(c, 0) <= n]
        delta = 0
        if n == behind_session:
            if behind_chunk and behind_chunk in covered:
                covered.remove(behind_chunk)
            delta = -15
        notes = pacing.class_notes(s, [chunks[c] for c in (s["planned_chunk_ids"] or []) if c in chunks],
                                   DEMO_TRANSCRIPT if n == behind_session else None)
        db.table("session_plans").update({
            "status": "COMPLETED", "covered_chunk_ids": covered, "pacing_delta_mins": delta,
            "transcription_status": "COMPLETED_ASR", "generated_class_notes_md": notes,
            "live_transcript_text": DEMO_TRANSCRIPT if n == behind_session else None,
        }).eq("session_id", s["session_id"]).execute()


def _votes(offering_id: str, session_number: int, seed: int):
    db = get_db()
    s = rows(db.table("session_plans").select("session_id").eq("offering_id", offering_id).eq("session_number", session_number))
    if not s:
        return
    sid = s[0]["session_id"]
    students = [e["student_id"] for e in rows(db.table("student_enrollments").select("student_id").eq("offering_id", offering_id))]
    rng = random.Random(seed)
    out = []
    for st in students:
        pref = rng.choice([15, 18, 20, 22])
        for m in range(0, 61, 5):
            base = 8 if m <= 12 else max(2, 8 - (m - 12) / 3.2)
            out.append({"session_id": sid, "student_id": st, "minute_of_class": m,
                        "reported_focus_score": int(max(1, min(9, round(base + rng.uniform(-1, 1))))), "preferred_split_min": pref})
    if out:
        db.table("attention_telemetry_votes").insert(out).execute()


def seed_all() -> dict:
    db = get_db()
    res = db.rpc("seed_demo").execute().data
    cs = pacing.generate_plan(O_CS304, preserve_completed=False)
    des = pacing.generate_plan(O_DES201, preserve_completed=False)
    cur = config.DEMO_CURRENT_SESSION
    _play_sessions(O_CS304, cur, behind_session=cur, behind_chunk=HARRIS)
    _play_sessions(O_DES201, max(1, cur - 2))
    _votes(O_CS304, cur, 42)
    _votes(O_CS304, cur - 1, 41)
    return {"sql_seed": res, "cs304_plan": cs, "des201_plan": des, "demo_current_session": cur + 1,
            "ids": {
                "users": {"iqac_admin": "20000000-0000-0000-0000-000000000001", "prof_darshan": "20000000-0000-0000-0000-000000000002",
                          "prof_veena": "20000000-0000-0000-0000-000000000003", "prof_rao": "20000000-0000-0000-0000-000000000004",
                          "aarav": "20000000-0000-0000-0000-000000000005", "riya": "20000000-0000-0000-0000-000000000006"},
                "courses": {"CS304": "30000000-0000-0000-0000-000000000001", "DES201": "30000000-0000-0000-0000-000000000002", "CS204-2024": "30000000-0000-0000-0000-000000000003"},
                "offerings": {"CS304": O_CS304, "DES201": O_DES201},
                "aarav_ia1_eval": "80000000-0000-0000-0000-000000000001",
            }}


def seed_if_empty():
    db = get_db()
    users = db.table("users").select("user_id", count="exact").limit(1).execute()
    sessions = db.table("session_plans").select("session_id", count="exact").limit(1).execute()
    if not users.count or not sessions.count:
        seed_all()
