"""Agent 1: Dynamic L:T:P pacing & self-healing recalibration."""
from datetime import date, datetime, timedelta, timezone

from app.core import config
from app.core.db import get_db, one, rows
from app.services import attention

# Weekday pattern per contact hour type: lectures first, then tutorials, then practicals (Mon=0).
WEEKDAYS = [0, 1, 2, 3, 4]


def _d(s: str | date) -> date:
    return s if isinstance(s, date) else date.fromisoformat(str(s)[:10])


def offering_context(offering_id: str) -> dict:
    db = get_db()
    off = one(db.table("course_offerings").select("*, courses(*), users(user_id, full_name, pedagogical_system_prompt, persona_parameters)").eq("offering_id", offering_id))
    if not off:
        raise ValueError("offering not found")
    course = off.pop("courses")
    faculty = off.pop("users")
    chunks = rows(db.table("syllabus_chunks").select("*").eq("course_id", course["course_id"]).order("unit_number").order("sequence_order"))
    sems = rows(db.table("student_enrollments").select("users(semester)").eq("offering_id", offering_id))
    semesters = [s["users"]["semester"] for s in sems if s.get("users") and s["users"].get("semester")]
    cohort_sem = round(sum(semesters) / len(semesters)) if semesters else course["semester"]
    return {"offering": off, "course": course, "faculty": faculty, "chunks": chunks, "cohort_semester": cohort_sem}


def persona_weights(prompt: str | None, params: dict | None) -> dict:
    p = (prompt or "").lower()
    params = params or {}
    theory_depth = float(params.get("theory_depth", 0.7))
    pace = float(params.get("pace_multiplier", 1.0))
    activity_bias = 0
    if any(w in p for w in ("socratic", "case", "studio", "critique", "discussion", "interactive")):
        activity_bias += 4
    if any(w in p for w in ("derivation", "math", "proof", "rigor")):
        theory_depth = min(1.0, theory_depth + 0.1)
    return {"theory_depth": theory_depth, "pace_multiplier": pace, "activity_bias_mins": activity_bias}


def build_slots(course: dict, start: date, ia_dates: list[date], holidays: set[date]) -> list[dict]:
    l, t, p = course["l_ratio"], course["t_ratio"], course["p_ratio"]
    pattern = ["L"] * l + ["T"] * t + ["P"] * p
    pattern = pattern[:5]
    slots, d = [], start
    lwd = _d(course["last_working_day"])
    # align pattern to weekdays Mon..; course-week starts on the start date's weekday
    while d <= lwd:
        if d.weekday() < len(pattern) and d not in holidays:
            kind = pattern[d.weekday()]
            stype = "REGULAR_CLASS"
            if d in ia_dates:
                stype = "IA_EXAM"
            elif any(0 < (ia - d).days <= 1 for ia in ia_dates):
                stype = "INTERNAL_EXAM_PREP"
            slots.append({"date": d, "ltp": kind, "session_type": stype})
        d += timedelta(days=1)
    # last two regular slots are buffers so the syllabus always finishes before last working day
    regular = [s for s in slots if s["session_type"] == "REGULAR_CLASS"]
    for s in regular[-2:]:
        s["session_type"] = "BUFFER"
    return slots


def allocate(chunks: list[dict], slots: list[dict], weights: dict, remaining_mins: dict | None = None) -> list[list[str]]:
    """Assign chunks to slots proportionally to estimated_minutes x complexity^theory_depth, keeping order.
    Lecture/tutorial chunks go to L/T slots, practical chunks to P slots."""
    out: list[list[str]] = [[] for _ in slots]
    for kinds in (("L", "T"), ("P",)):
        idx = [i for i, s in enumerate(slots) if s["session_type"] == "REGULAR_CLASS" and s["ltp"] in kinds]
        cks = [c for c in chunks if (c.get("ltp_type") or "L") in kinds]
        if not idx or not cks:
            continue
        rm = remaining_mins or {}
        w = [rm.get(c["chunk_id"], c["estimated_minutes"]) * (c["cognitive_complexity"] ** (1 + weights["theory_depth"])) / weights["pace_multiplier"] for c in cks]
        total = sum(w)
        n = len(idx)
        if len(cks) >= n:
            # more chunks than slots: pack sequentially
            per = len(cks) / n
            for k, c in enumerate(cks):
                out[idx[min(n - 1, int(k / per))]].append(c["chunk_id"])
            continue
        alloc = [max(1, round(x / total * n)) for x in w]
        while sum(alloc) > n:
            j = max(range(len(alloc)), key=lambda q: alloc[q])
            alloc[j] -= 1
        while sum(alloc) < n:
            j = max(range(len(alloc)), key=lambda q: w[q] / alloc[q])
            alloc[j] += 1
        pos = 0
        for c, a in zip(cks, alloc):
            for _ in range(a):
                out[idx[pos]].append(c["chunk_id"])
                pos += 1
    return out


def generate_plan(offering_id: str, start_date: str | None = None, ia_dates: list[str] | None = None,
                  pedagogical_system_prompt: str | None = None, persona_parameters: dict | None = None,
                  preserve_completed: bool = True) -> dict:
    db = get_db()
    ctx = offering_context(offering_id)
    course, faculty, chunks = ctx["course"], ctx["faculty"] or {}, ctx["chunks"]
    prompt = pedagogical_system_prompt or faculty.get("pedagogical_system_prompt")
    params = persona_parameters or faculty.get("persona_parameters")
    weights = persona_weights(prompt, params)

    existing = rows(db.table("session_plans").select("*").eq("offering_id", offering_id).order("session_number"))
    completed = [s for s in existing if s["status"] in ("COMPLETED",)] if preserve_completed else []
    covered = {c for s in completed for c in (s.get("covered_chunk_ids") or [])}

    start = _d(start_date or config.SEMESTER_START)
    ias = [_d(x) for x in (ia_dates or [config.IA1_DATE, config.IA2_DATE])]
    holidays = {_d(h) for h in config.HOLIDAYS}
    slots = build_slots(course, start, ias, holidays)

    if completed:
        last_done = max(_d(s["scheduled_date"]) for s in completed)
        future_slots = [s for s in slots if s["date"] > last_done]
    else:
        future_slots = slots
    remaining_chunks = [c for c in chunks if c["chunk_id"] not in covered and not c.get("is_deprecated")]
    # Partially taught chunks only need their remaining minutes (+ any minutes the class fell behind).
    spent: dict[str, float] = {}
    for s in completed:
        planned = s.get("planned_chunk_ids") or []
        open_chunks = [c for c in planned if c not in (s.get("covered_chunk_ids") or [])]
        if open_chunks:
            share = max(0, (s.get("lecture_minutes_split") or 45) + (s.get("pacing_delta_mins") or 0)) / len(planned)
            for c in open_chunks:
                spent[c] = spent.get(c, 0) + share
    remaining_mins = {c["chunk_id"]: max(10.0, c["estimated_minutes"] - spent.get(c["chunk_id"], 0)) for c in remaining_chunks}
    assignment = allocate(remaining_chunks, future_slots, weights, remaining_mins)

    stratum = course.get("course_stratum") or attention.stratum_from_ltp(course["l_ratio"], course["t_ratio"], course["p_ratio"])
    model = attention.build_model(stratum, ctx["cohort_semester"], ctx["offering"]["default_time_slot"])
    extra_activity = weights["activity_bias_mins"]

    # Carry over pacing drift: if completed sessions ran behind, start future sessions with that debt noted.
    drift = sum(s.get("pacing_delta_mins") or 0 for s in completed)

    new_rows = []
    base_no = len(completed)
    for i, (slot, chunk_ids) in enumerate(zip(future_slots, assignment)):
        dur = 120 if slot["ltp"] == "P" else 60
        is_class = slot["session_type"] == "REGULAR_CLASS" and slot["ltp"] != "P"
        act = (model["activity_minutes_split"] + extra_activity) if is_class else 0
        new_rows.append({
            "offering_id": offering_id,
            "session_number": base_no + i + 1,
            "scheduled_date": slot["date"].isoformat(),
            "session_type": slot["session_type"] if slot["ltp"] != "P" or slot["session_type"] != "REGULAR_CLASS" else "REGULAR_CLASS",
            "planned_chunk_ids": chunk_ids,
            "covered_chunk_ids": [],
            "session_duration_mins": dur,
            "predicted_dip_minute": model["dip_trigger_minute"] if is_class else None,
            "lecture_minutes_split": dur - act,
            "activity_minutes_split": act,
            "split_source": model["split_source"],
            "status": "SCHEDULED",
            "pacing_delta_mins": 0,
        })

    # Update future sessions in place (keeps session_id stable for the frontend and attention votes)
    if not preserve_completed:
        db.table("session_plans").delete().eq("offering_id", offering_id).execute()
    if new_rows:
        db.table("session_plans").upsert(new_rows, on_conflict="offering_id,session_number").execute()
    last_no = base_no + len(new_rows)
    db.table("session_plans").delete().eq("offering_id", offering_id).gt("session_number", last_no).execute()

    finish = next((r["scheduled_date"] for r in reversed(new_rows) if r["planned_chunk_ids"]), None)
    return {
        "offering_id": offering_id,
        "course_code": course["course_code"],
        "ltp": f"{course['l_ratio']}:{course['t_ratio']}:{course['p_ratio']}",
        "persona_weights": weights,
        "pedagogical_system_prompt": prompt,
        "sessions_completed": len(completed),
        "sessions_planned": len(new_rows),
        "carried_drift_mins": drift,
        "syllabus_finishes_on": finish,
        "last_working_day": course["last_working_day"],
        "finishes_before_lwd": bool(finish and _d(finish) <= _d(course["last_working_day"])),
    }


def get_plan(offering_id: str) -> dict:
    db = get_db()
    ctx = offering_context(offering_id)
    course = ctx["course"]
    sessions = rows(db.table("session_plans").select("*").eq("offering_id", offering_id).order("session_number"))
    chunk_map = {c["chunk_id"]: c for c in ctx["chunks"]}
    for s in sessions:
        s["planned_topics"] = [{"chunk_id": c, "topic_title": chunk_map.get(c, {}).get("topic_title"), "unit": chunk_map.get(c, {}).get("unit_number"),
                                "slide_range": chunk_map.get(c, {}).get("slide_range")} for c in s["planned_chunk_ids"] or []]
    lwd = _d(course["last_working_day"])
    today = date.today()
    done = [s for s in sessions if s["status"] == "COMPLETED"]
    covered = {c for s in done for c in (s["covered_chunk_ids"] or [])}
    milestones = [{"name": "IA-1", "date": config.IA1_DATE}, {"name": "IA-2", "date": config.IA2_DATE},
                  {"name": "Last Working Day", "date": str(lwd)}, {"name": "SEE (approx.)", "date": str(lwd + timedelta(days=10))}]
    nxt = next((s for s in sessions if s["status"] in ("SCHEDULED", "IN_PROGRESS")), None)
    return {
        "offering": ctx["offering"], "course": course, "faculty": ctx["faculty"],
        "ltp_badge": f"{course['l_ratio']}:{course['t_ratio']}:{course['p_ratio']}",
        "days_to_last_working_day": (lwd - today).days,
        "milestones": milestones,
        "progress": {"sessions_completed": len(done), "sessions_total": len(sessions),
                     "chunks_covered": len(covered), "chunks_total": len([c for c in ctx["chunks"] if not c.get("is_deprecated")]),
                     "net_pacing_delta_mins": sum(s.get("pacing_delta_mins") or 0 for s in done)},
        "next_session_id": nxt["session_id"] if nxt else None,
        "sessions": sessions,
    }


def recalibrate_after(session: dict, covered_chunk_ids: list[str], minutes_behind: int, notes_md: str | None,
                      transcript: str | None = None, status_source: str = "COMPLETED_ASR") -> dict:
    """Self-healing: close this session, then re-spread every uncovered chunk over the remaining sessions."""
    db = get_db()
    planned = session.get("planned_chunk_ids") or []
    uncovered = [c for c in planned if c not in covered_chunk_ids]
    db.table("session_plans").update({
        "covered_chunk_ids": covered_chunk_ids,
        "status": "COMPLETED",
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "pacing_delta_mins": -abs(minutes_behind) if minutes_behind else 0,
        "generated_class_notes_md": notes_md,
        "live_transcript_text": transcript if transcript is not None else session.get("live_transcript_text"),
        "transcription_status": status_source if session.get("transcription_status") != "FALLBACK_SLIDE_MANUAL" else "FALLBACK_SLIDE_MANUAL",
    }).eq("session_id", session["session_id"]).execute()

    # Chunks that span multiple sessions are "covered" when the teacher reports them finished.
    # Any planned chunk that was not finished keeps its place at the front of the queue.
    before = rows(db.table("session_plans").select("session_number, scheduled_date, planned_chunk_ids").eq("offering_id", session["offering_id"]).gt("session_number", session["session_number"]).order("session_number"))
    # Covered = union of covered over completed sessions; a chunk that is still planned in a later session is not covered yet
    result = generate_plan(session["offering_id"], preserve_completed=True)
    after = rows(db.table("session_plans").select("session_number, scheduled_date, planned_chunk_ids").eq("offering_id", session["offering_id"]).gt("session_number", session["session_number"]).order("session_number"))
    shifted = [a["session_number"] for a, b in zip(after, before) if a["planned_chunk_ids"] != b["planned_chunk_ids"]]
    return {"uncovered_carried_over": uncovered, "minutes_behind": minutes_behind, "shifted_sessions": shifted[:12], "plan": result,
            "delta_coverage": {"planned": len(planned), "covered": len(covered_chunk_ids), "carried": len(uncovered)}}


def class_notes(session: dict, chunks: list[dict], transcript: str | None, checkpoint: str | None = None, use_ai: bool = False) -> str:
    """Markdown notes built strictly from covered syllabus chunks + the lecture transcript (Gemini when use_ai, else template)."""
    if use_ai and chunks:
        from app.services import llm
        md = llm.class_notes(session["session_number"], str(session["scheduled_date"]), chunks, transcript, checkpoint)
        if md:
            return md + "\n\n---\n_Generated by CampusAI (Gemini) from approved syllabus chunks and the session transcript only._"
    lines = [f"# Session {session['session_number']} Notes - {session['scheduled_date']}", ""]
    for c in chunks:
        lines += [f"## {c['topic_title']}", f"*Unit {c['unit_number']} - {c.get('slide_range')} - {c.get('co_mapping')} - Bloom: {c.get('bloom_level')}*", "",
                  c["syllabus_content"], "", "**Key terms:** " + ", ".join(c.get("canonical_keywords") or []), ""]
    if checkpoint:
        lines += [f"> Coverage confirmed manually by faculty at checkpoint: **{checkpoint}** (ASR unavailable).", ""]
    if transcript:
        excerpt = transcript.strip()
        lines += ["## From the lecture", "", (excerpt[:1200] + ("..." if len(excerpt) > 1200 else "")), ""]
    lines += ["---", "_Generated by CampusAI from approved syllabus chunks and the session transcript only._"]
    return "\n".join(lines)
