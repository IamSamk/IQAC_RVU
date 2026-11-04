"""Day-to-day class flow for real teacher and student accounts."""
import hashlib
import random
from datetime import date, datetime, timezone

from app.agents import pacing
from app.core.db import audit, get_db, one, rows
from app.services import attention, llm

SLOT_LABEL = {"MORNING_09AM": "9:00 AM", "MIDDAY_11AM": "11:00 AM", "POST_LUNCH_02PM": "2:00 PM"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _chunks(ids: list[str]) -> list[dict]:
    if not ids:
        return []
    by_id = {c["chunk_id"]: c for c in rows(get_db().table("syllabus_chunks").select("*").in_("chunk_id", ids))}
    return [by_id[i] for i in dict.fromkeys(ids) if i in by_id]


def _session_card(s: dict, off: dict, course: dict) -> dict:
    topics = _chunks(s.get("planned_chunk_ids") or [])
    return {"session_id": s["session_id"], "session_number": s["session_number"], "date": s["scheduled_date"], "status": s["status"],
            "session_type": s["session_type"], "ltp": "P" if s.get("session_duration_mins", 60) > 90 else "L",
            "offering_id": off["offering_id"], "section": off["section"], "time": SLOT_LABEL.get(off.get("default_time_slot"), ""),
            "course_id": course["course_id"], "course_code": course["course_code"], "course_title": course["course_title"],
            "topics": [{"chunk_id": c["chunk_id"], "title": c["topic_title"], "unit": c["unit_number"]} for c in topics],
            "has_notes": bool(s.get("generated_class_notes_md")), "attendance_code": s.get("attendance_code") if s["status"] == "IN_PROGRESS" else None}


def _attention_for(off: dict, course: dict) -> dict:
    sems = [e["users"]["semester"] for e in rows(get_db().table("student_enrollments").select("users(semester)").eq("offering_id", off["offering_id"])) if e.get("users") and e["users"].get("semester")]
    stratum = course.get("course_stratum") or attention.stratum_from_ltp(course["l_ratio"], course["t_ratio"], course["p_ratio"])
    return attention.build_model(stratum, round(sum(sems) / len(sems)) if sems else course["semester"], off.get("default_time_slot") or "MIDDAY_11AM")


# ---------------------------------------------------------------- teacher
def teacher_home(teacher_id: str) -> dict:
    db = get_db()
    offs = rows(db.table("course_offerings").select("*, courses(*)").eq("faculty_id", teacher_id).eq("academic_year", "2026-27"))
    today = date.today().isoformat()
    courses: dict[str, dict] = {}
    todays, upcoming = [], []
    for off in offs:
        course = off.pop("courses")
        sessions = rows(db.table("session_plans").select("*").eq("offering_id", off["offering_id"]).order("session_number"))
        done = [s for s in sessions if s["status"] == "COMPLETED"]
        enrolled = db.table("student_enrollments").select("student_id", count="exact").eq("offering_id", off["offering_id"]).limit(1).execute().count or 0
        entry = courses.setdefault(course["course_id"], {"course_id": course["course_id"], "course_code": course["course_code"],
                                                          "course_title": course["course_title"], "ltp": f"{course['l_ratio']}:{course['t_ratio']}:{course['p_ratio']}",
                                                          "semester": course["semester"], "uploaded": bool(course.get("created_by")), "sections": []})
        nxt = next((s for s in sessions if s["status"] in ("SCHEDULED", "IN_PROGRESS")), None)
        entry["sections"].append({"offering_id": off["offering_id"], "section": off["section"], "time": SLOT_LABEL.get(off.get("default_time_slot"), ""),
                                  "students": enrolled, "sessions_done": len(done), "sessions_total": len(sessions),
                                  "next_session": _session_card(nxt, off, course) if nxt else None})
        for s in sessions:
            if s["status"] == "IN_PROGRESS" or (s["scheduled_date"] == today and s["status"] == "SCHEDULED"):
                todays.append(_session_card(s, off, course))
        if nxt and nxt["scheduled_date"] > today:
            upcoming.append(_session_card(nxt, off, course))
    for c in courses.values():
        c["sections"].sort(key=lambda x: x["section"])
    todays.sort(key=lambda x: (x["status"] != "IN_PROGRESS", x["time"]))
    upcoming.sort(key=lambda x: (x["date"], x["time"]))
    return {"today": today, "todays_classes": todays, "upcoming": upcoming[:6], "courses": list(courses.values())}


def course_detail(course_id: str) -> dict:
    """Everything the course page needs in five queries."""
    db = get_db()
    course = one(db.table("courses").select("*").eq("course_id", course_id))
    if not course:
        raise ValueError("course not found")
    chunks = rows(db.table("syllabus_chunks").select("chunk_id, unit_number, sequence_order, topic_title, syllabus_content, ltp_type, estimated_minutes, co_mapping, bloom_level, canonical_keywords, slide_range, is_deprecated").eq("course_id", course_id).order("unit_number").order("sequence_order"))
    title = {c["chunk_id"]: c["topic_title"] for c in chunks}
    units: dict[int, dict] = {}
    for c in chunks:
        units.setdefault(c["unit_number"], {"unit_number": c["unit_number"], "topics": []})["topics"].append(c)
    offs = rows(db.table("course_offerings").select("*").eq("course_id", course_id).order("section"))
    ids = [o["offering_id"] for o in offs]
    sessions = rows(db.table("session_plans").select("session_id, offering_id, session_number, scheduled_date, status, session_type, session_duration_mins, lecture_minutes_split, activity_minutes_split, pacing_delta_mins, planned_chunk_ids, covered_chunk_ids").in_("offering_id", ids).order("session_number")) if ids else []
    enrolled = rows(db.table("student_enrollments").select("offering_id, users(semester)").in_("offering_id", ids)) if ids else []
    stratum = course.get("course_stratum") or attention.stratum_from_ltp(course["l_ratio"], course["t_ratio"], course["p_ratio"])
    teachable = len([c for c in chunks if not c.get("is_deprecated")])
    sections = []
    for off in offs:
        mine = [s for s in sessions if s["offering_id"] == off["offering_id"]]
        sems = [e["users"]["semester"] for e in enrolled if e["offering_id"] == off["offering_id"] and e.get("users") and e["users"].get("semester")]
        model = attention.build_model(stratum, round(sum(sems) / len(sems)) if sems else course["semester"], off.get("default_time_slot") or "MIDDAY_11AM")
        done = [s for s in mine if s["status"] == "COMPLETED"]
        covered = {c for s in done for c in (s.get("covered_chunk_ids") or [])}
        sections.append({"offering_id": off["offering_id"], "section": off["section"], "time": SLOT_LABEL.get(off.get("default_time_slot"), ""),
                         "dip_minute": model["dip_trigger_minute"], "activity_splits": model["activity_splits"],
                         "progress": {"sessions_completed": len(done), "sessions_total": len(mine), "chunks_covered": len(covered), "chunks_total": teachable,
                                      "net_pacing_delta_mins": sum(s.get("pacing_delta_mins") or 0 for s in done)},
                         "sessions": [{"session_id": s["session_id"], "session_number": s["session_number"], "date": s["scheduled_date"], "status": s["status"],
                                       "session_type": s["session_type"], "duration": s["session_duration_mins"], "lecture_minutes": s["lecture_minutes_split"],
                                       "activity_minutes": s["activity_minutes_split"], "pacing_delta_mins": s["pacing_delta_mins"],
                                       "topics": [title[c] for c in dict.fromkeys(s.get("planned_chunk_ids") or []) if c in title]} for s in mine]})
    upload = one(db.table("syllabus_uploads").select("file_name, parse_engine, created_at").eq("course_id", course_id).order("created_at", desc=True))
    return {"course": course, "units": list(units.values()), "sections": sections, "upload": upload}


def start_session(session_id: str, teacher_id: str | None) -> dict:
    db = get_db()
    s = one(db.table("session_plans").select("*").eq("session_id", session_id))
    if not s:
        raise ValueError("session not found")
    code = s.get("attendance_code") if s["status"] == "IN_PROGRESS" and s.get("attendance_code") else f"{random.randint(0, 9999):04d}"
    db.table("session_plans").update({"status": "IN_PROGRESS", "attendance_code": code, "started_at": s.get("started_at") or _now()}).eq("session_id", session_id).execute()
    audit(teacher_id, "START_CLASS", "session_plans", session_id, {"code": code})
    return live_view(session_id)


def live_view(session_id: str) -> dict:
    db = get_db()
    s = one(db.table("session_plans").select("*, course_offerings(*, courses(*))").eq("session_id", session_id))
    if not s:
        raise ValueError("session not found")
    off = s.pop("course_offerings")
    course = off.pop("courses")
    enrolled = rows(db.table("student_enrollments").select("users(user_id, full_name, institution_id)").eq("offering_id", off["offering_id"]))
    present = {a["student_id"]: a["checked_in_at"] for a in rows(db.table("session_attendance").select("student_id, checked_in_at").eq("session_id", session_id))}
    roster = sorted([{"student_id": e["users"]["user_id"], "name": e["users"]["full_name"], "usn": e["users"]["institution_id"],
                      "present": e["users"]["user_id"] in present, "checked_in_at": present.get(e["users"]["user_id"])} for e in enrolled if e.get("users")],
                    key=lambda r: (not r["present"], r["name"]))
    model = _attention_for(off, course)
    activity = one(db.table("polymorphic_activities").select("activity_id, delivery_platform, trigger_minute, learning_goal, chunk_id, created_at").eq("session_id", session_id).order("created_at", desc=True))
    return {"session": {k: s.get(k) for k in ("session_id", "session_number", "scheduled_date", "status", "session_type", "session_duration_mins",
                                              "lecture_minutes_split", "activity_minutes_split", "attendance_code", "started_at", "ended_at",
                                              "lesson_plan_md", "generated_class_notes_md", "live_transcript_text", "pacing_delta_mins")},
            "course": {"course_id": course["course_id"], "course_code": course["course_code"], "course_title": course["course_title"]},
            "offering": {"offering_id": off["offering_id"], "section": off["section"], "time": SLOT_LABEL.get(off.get("default_time_slot"), "")},
            "topics": [{"chunk_id": c["chunk_id"], "title": c["topic_title"], "content": c["syllabus_content"], "unit": c["unit_number"],
                        "slide_range": c.get("slide_range"), "keywords": c.get("canonical_keywords") or []} for c in _chunks(s.get("planned_chunk_ids") or [])],
            "attention": {"dip_minute": model["dip_trigger_minute"], "activity_splits": model["activity_splits"], "t": model["t"],
                          "passive": model["passive_curve"], "active": model["active_intervened_curve"]},
            "roster": roster, "present_count": len(present), "enrolled_count": len(roster), "activity": activity}


def make_lesson_plan(session_id: str, platform: str = "Mentimeter", force: bool = False) -> dict:
    db = get_db()
    view = live_view(session_id)
    if view["session"].get("lesson_plan_md") and not force:
        return {"lesson_plan_md": view["session"]["lesson_plan_md"], "engine": "cached"}
    off = one(db.table("course_offerings").select("faculty_id, users(pedagogical_system_prompt)").eq("offering_id", view["offering"]["offering_id"]))
    persona = ((off or {}).get("users") or {}).get("pedagogical_system_prompt")
    chunks = _chunks([t["chunk_id"] for t in view["topics"]])
    att = {"dip_trigger_minute": view["attention"]["dip_minute"], "activity_splits": view["attention"]["activity_splits"]}
    md = llm.lesson_plan(view["course"], view["offering"]["section"], view["session"], chunks, persona, att, platform) if llm.enabled() and chunks else None
    engine = llm.MODEL if md else "TEMPLATE"
    if not md:
        dip = round(att["dip_trigger_minute"])
        names = ", ".join(c["topic_title"] for c in chunks) or "today's topics"
        md = "\n".join(["## Goal", f"Cover {names}.", "", "## Flow", "| Minutes | What you do | What students do |", "|---|---|---|",
                        "| 0-5 | Hook with a real-world example | Predict the answer |",
                        f"| 5-{dip} | Explain the core idea step by step | Take notes, ask questions |",
                        f"| {dip}-{dip + 7} | Run a {platform} poll on the key idea | Answer on their phones |",
                        f"| {dip + 7}-55 | Worked example and practice | Solve in pairs |", "| 55-60 | Recap and exit question | Write one takeaway |"])
    db.table("session_plans").update({"lesson_plan_md": md}).eq("session_id", session_id).execute()
    return {"lesson_plan_md": md, "engine": engine}


# ---------------------------------------------------------------- student
def attend(session_id: str, student_id: str, code: str) -> dict:
    db = get_db()
    s = one(db.table("session_plans").select("session_id, offering_id, status, attendance_code").eq("session_id", session_id))
    if not s:
        raise ValueError("Class not found")
    if not one(db.table("student_enrollments").select("enrollment_id").eq("offering_id", s["offering_id"]).eq("student_id", student_id)):
        raise PermissionError("You are not enrolled in this class")
    if s["status"] != "IN_PROGRESS":
        raise PermissionError("This class has not started yet")
    if (code or "").strip() != (s.get("attendance_code") or ""):
        raise PermissionError("That code is not right. Check the code on the teacher's screen.")
    db.table("session_attendance").upsert({"session_id": session_id, "student_id": student_id, "status": "PRESENT", "checked_in_at": _now()},
                                          on_conflict="session_id,student_id").execute()
    return {"session_id": session_id, "status": "PRESENT"}


def student_home(student_id: str) -> dict:
    db = get_db()
    enr = rows(db.table("student_enrollments").select("enrollment_category, course_offerings(*, courses(*), users(full_name))").eq("student_id", student_id))
    today = date.today().isoformat()
    attended = {a["session_id"] for a in rows(db.table("session_attendance").select("session_id").eq("student_id", student_id))}
    courses, todays, notes = [], [], []
    for e in enr:
        off = e["course_offerings"]
        course = off.pop("courses")
        teacher = (off.pop("users") or {}).get("full_name")
        sessions = rows(db.table("session_plans").select("*").eq("offering_id", off["offering_id"]).order("session_number"))
        done = [s for s in sessions if s["status"] == "COMPLETED"]
        mine = [s for s in done if s["session_id"] in attended]
        courses.append({"course_id": course["course_id"], "course_code": course["course_code"], "course_title": course["course_title"],
                        "section": off["section"], "teacher": teacher, "category": e["enrollment_category"],
                        "sessions_done": len(done), "sessions_total": len(sessions), "attended": len(mine)})
        for s in sessions:
            if s["status"] == "IN_PROGRESS" or s["scheduled_date"] == today:
                card = _session_card(s, off, course) | {"teacher": teacher, "attended": s["session_id"] in attended}
                card.pop("attendance_code", None)
                todays.append(card)
        for s in done[-6:]:
            if s.get("generated_class_notes_md"):
                notes.append({"session_id": s["session_id"], "course_code": course["course_code"], "session_number": s["session_number"],
                              "date": s["scheduled_date"], "topics": [c["topic_title"] for c in _chunks(s.get("covered_chunk_ids") or s.get("planned_chunk_ids") or [])],
                              "attended": s["session_id"] in attended})
    todays.sort(key=lambda x: (x["status"] != "IN_PROGRESS", x["time"]))
    notes.sort(key=lambda n: n["date"], reverse=True)
    return {"today": today, "todays_classes": todays, "courses": courses, "recent_notes": notes[:12]}


def session_notes(session_id: str) -> dict:
    s = one(get_db().table("session_plans").select("session_id, session_number, scheduled_date, status, generated_class_notes_md, covered_chunk_ids, planned_chunk_ids, course_offerings(section, courses(course_code, course_title))").eq("session_id", session_id))
    if not s:
        raise ValueError("session not found")
    off = s.pop("course_offerings")
    return {**s, "course_code": off["courses"]["course_code"], "course_title": off["courses"]["course_title"], "section": off["section"],
            "topics": [c["topic_title"] for c in _chunks(s.get("covered_chunk_ids") or s.get("planned_chunk_ids") or [])]}


def my_activity(session_id: str, student_id: str) -> dict | None:
    act = one(get_db().table("polymorphic_activities").select("*").eq("session_id", session_id).order("created_at", desc=True))
    if not act:
        return None
    sets = act["question_sets_json"] or []
    idx = int(hashlib.sha256(f"{student_id}:{act['activity_id']}".encode()).hexdigest(), 16) % max(1, len(sets))
    chosen = sets[idx] if sets else {"questions": []}
    questions = [{k: q.get(k) for k in ("type", "question", "options")} for q in chosen.get("questions", [])]
    return {"activity_id": act["activity_id"], "learning_goal": act["learning_goal"], "set_number": chosen.get("set_number", idx + 1),
            "total_sets": len(sets), "questions": questions}
