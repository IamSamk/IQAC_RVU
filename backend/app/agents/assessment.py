"""Agent 2: OCR mark-sheet evaluation, HITL verification, spreadsheet sync, CO attainment and quiz compilation."""
from app.core.db import audit, get_db, one, rows
from app.services.questions import generate_sets

HITL_CONF = 0.95

# Sample OCR outputs (what the vision engine returns for the demo booklets)
SAMPLE_CASES = {
    "aarav_ia1": {
        "student_usn": "1RVU23CSE042", "exam_name": "IA-1 Examination", "written_total": 20,
        "cells": [
            {"q": "Q1a", "marks": 4, "max": 5, "conf": 0.98}, {"q": "Q1b", "marks": 4, "max": 5, "conf": 0.97},
            {"q": "Q2a", "marks": 3, "max": 5, "conf": 0.96}, {"q": "Q2b", "marks": 3, "max": 5, "conf": 0.82},
            {"q": "Q3a", "marks": 2, "max": 5, "conf": 0.96}, {"q": "Q3b", "marks": 4, "max": 5, "conf": 0.99},
        ],
    },
    "total_mismatch": {
        "student_usn": "1RVU23CSE036", "exam_name": "IA-1 Examination", "written_total": 19,
        "cells": [
            {"q": "Q1a", "marks": 3, "max": 5, "conf": 0.98}, {"q": "Q1b", "marks": 3, "max": 5, "conf": 0.97},
            {"q": "Q2a", "marks": 2, "max": 5, "conf": 0.96}, {"q": "Q2b", "marks": 3, "max": 5, "conf": 0.97},
            {"q": "Q3a", "marks": 3, "max": 5, "conf": 0.98}, {"q": "Q3b", "marks": 3, "max": 5, "conf": 0.98},
        ],
    },
}

# IA-1 blueprint: question -> syllabus chunk + CO (CS304)
IA1_BLUEPRINT = {
    "Q1a": ("50000000-0000-0000-0001-000000000101", "CO1"), "Q1b": ("50000000-0000-0000-0001-000000000102", "CO1"),
    "Q2a": ("50000000-0000-0000-0001-000000000103", "CO1"), "Q2b": ("50000000-0000-0000-0001-000000000103", "CO1"),
    "Q3a": ("50000000-0000-0000-0001-000000000202", "CO2"), "Q3b": ("50000000-0000-0000-0001-000000000201", "CO2"),
}


def evaluate(offering_id: str, payload: dict) -> dict:
    db = get_db()
    student = one(db.table("users").select("user_id, full_name, institution_id").eq("institution_id", payload["student_usn"]))
    if not student:
        raise ValueError(f"Unknown USN {payload['student_usn']}")
    marks, flags, weak = {}, [], []
    total = 0
    for cell in payload["cells"]:
        chunk_id, co = IA1_BLUEPRINT.get(cell["q"], (None, None))
        marks[cell["q"]] = {"marks": cell["marks"], "max": cell["max"], "conf": cell["conf"], "chunk_id": chunk_id, "co": co,
                            "needs_review": cell["conf"] < HITL_CONF}
        total += cell["marks"]
        if cell["conf"] < HITL_CONF:
            flags.append({"q": cell["q"], "reason": f"OCR confidence {round(cell['conf'] * 100)}% < 95%", "status": "Requires Faculty Verification"})
        if chunk_id and cell["marks"] / cell["max"] < 0.6:
            weak.append(chunk_id)
    max_total = sum(c["max"] for c in payload["cells"])
    written = payload.get("written_total")
    sum_ok = written is None or written == total
    if not sum_ok:
        flags.append({"q": "TOTAL", "reason": f"Sum of question marks ({total}) != written total ({written})", "status": "Requires Faculty Verification"})
    marks["TOTAL"] = {"marks": total, "max": max_total, "written_total": written, "sum_verified": sum_ok}
    overall = round(sum(c["conf"] for c in payload["cells"]) / len(payload["cells"]), 3)
    weak = sorted(set(weak))
    chunk_titles = {c["chunk_id"]: c["topic_title"] for c in rows(db.table("syllabus_chunks").select("chunk_id, topic_title").in_("chunk_id", weak))} if weak else {}
    feedback = (f"Scored {total}/{max_total}. " + ("Weak areas: " + "; ".join(chunk_titles.values()) + "." if weak else "No weak areas detected."))
    rec = db.table("ocr_exam_evaluations").insert({
        "offering_id": offering_id, "student_id": student["user_id"], "exam_name": payload.get("exam_name", "IA-1 Examination"),
        "scanned_sheet_url": payload.get("scanned_sheet_url"), "question_marks_json": marks, "ocr_overall_confidence": overall,
        "requires_faculty_hitl": bool(flags), "faculty_approved": False, "synced_to_spreadsheet": False,
        "ai_diagnostic_feedback": feedback, "weak_chunk_ids": weak,
    }).execute().data[0]
    return {"evaluation": rec, "student": student, "hitl_flags": flags, "sum_verified": sum_ok, "confidence_threshold": HITL_CONF}


def approve_and_sync(eval_id: str, actor_id: str | None, corrections: dict[str, int] | None) -> dict:
    db = get_db()
    ev = one(db.table("ocr_exam_evaluations").select("*").eq("eval_id", eval_id))
    if not ev:
        raise ValueError("evaluation not found")
    marks = ev["question_marks_json"]
    for q, val in (corrections or {}).items():
        if q in marks:
            marks[q]["marks"] = val
            marks[q]["conf"] = 1.0
            marks[q]["needs_review"] = False
            marks[q]["corrected_by_faculty"] = True
    for q, cell in marks.items():
        if q != "TOTAL":
            cell["needs_review"] = False
    total = sum(c["marks"] for q, c in marks.items() if q != "TOTAL")
    marks["TOTAL"]["marks"] = total
    marks["TOTAL"]["sum_verified"] = True
    off = one(db.table("course_offerings").select("eval_spreadsheet_url, faculty_id").eq("offering_id", ev["offering_id"]))
    db.table("ocr_exam_evaluations").update({"question_marks_json": marks, "faculty_approved": True, "synced_to_spreadsheet": True,
                                             "requires_faculty_hitl": False}).eq("eval_id", eval_id).execute()
    audit(actor_id or (off or {}).get("faculty_id"), "APPROVE_OCR_MARKS", "ocr_exam_evaluations", eval_id, {"corrections": corrections or {}, "total": total})
    student = one(db.table("users").select("institution_id, full_name").eq("user_id", ev["student_id"]))
    row = {"USN": student["institution_id"], "Name": student["full_name"], **{q: c["marks"] for q, c in marks.items() if q != "TOTAL"}, "Total": total}
    return {"eval_id": eval_id, "approved": True, "spreadsheet_sync": {"status": "SYNCED_MOCK", "sheet_url": (off or {}).get("eval_spreadsheet_url"), "row": row},
            "co_attainment": co_attainment(ev["offering_id"], ev["exam_name"])}


def co_attainment(offering_id: str, exam_name: str | None = None, target_pct: float = 60.0) -> dict:
    """Per-CO average % and NBA-style attainment level (share of students >= target %)."""
    db = get_db()
    q = db.table("ocr_exam_evaluations").select("student_id, question_marks_json, faculty_approved").eq("offering_id", offering_id)
    if exam_name:
        q = q.eq("exam_name", exam_name)
    evals = rows(q)
    per_co: dict[str, dict] = {}
    for ev in evals:
        stu: dict[str, list[int]] = {}
        for qn, c in ev["question_marks_json"].items():
            if qn == "TOTAL":
                continue
            co = c.get("co") or IA1_BLUEPRINT.get(qn, (None, "CO1"))[1]
            s = stu.setdefault(co, [0, 0])
            s[0] += c["marks"]
            s[1] += c["max"]
        for co, (m, mx) in stu.items():
            d = per_co.setdefault(co, {"scores": []})
            d["scores"].append(m / mx * 100 if mx else 0)
    out = []
    for co in sorted(per_co):
        sc = per_co[co]["scores"]
        share = sum(1 for x in sc if x >= target_pct) / len(sc) * 100
        level = 3 if share >= 70 else 2 if share >= 60 else 1 if share >= 50 else 0
        out.append({"co": co, "avg_pct": round(sum(sc) / len(sc), 1), "students_above_target_pct": round(share, 1), "attainment_level": level, "n": len(sc)})
    return {"offering_id": offering_id, "exam_name": exam_name, "target_pct": target_pct, "outcomes": out,
            "approved_sheets": sum(1 for e in evals if e["faculty_approved"]), "total_sheets": len(evals)}


TIMELINE_SESSIONS = {"WEEKLY": 4, "BIWEEKLY": 8, "MONTHLY": 16}


def compile_quiz(offering_id: str, timeline: str = "BIWEEKLY", from_session: int | None = None, to_session: int | None = None,
                 total_marks: int = 20, mock_iqac: bool = False) -> dict:
    db = get_db()
    off = one(db.table("course_offerings").select("course_id, courses(course_code, iqac_rubric_config)").eq("offering_id", offering_id))
    sessions = rows(db.table("session_plans").select("session_number, planned_chunk_ids, covered_chunk_ids, status").eq("offering_id", offering_id).order("session_number"))
    done = [s for s in sessions if s["status"] == "COMPLETED"]
    if to_session is None:
        to_session = done[-1]["session_number"] if done else (sessions[0]["session_number"] if sessions else 1)
    if from_session is None:
        from_session = max(1, to_session - TIMELINE_SESSIONS.get(timeline, 8) + 1)
    chosen = [s for s in sessions if from_session <= s["session_number"] <= to_session]
    chunk_ids = list(dict.fromkeys(c for s in chosen for c in (s["covered_chunk_ids"] or s["planned_chunk_ids"] or [])))
    all_chunks = rows(db.table("syllabus_chunks").select("*").eq("course_id", off["course_id"]))
    chunks = [c for c in all_chunks if c["chunk_id"] in chunk_ids] if not mock_iqac else [c for c in all_chunks if not c.get("is_deprecated")]
    rubric = off["courses"]["iqac_rubric_config"]
    questions = []
    per_q = max(1, total_marks // max(1, len(chunks)))
    for c in chunks:
        q = generate_sets(c, all_chunks, n_sets=1, per_set=1, seed=len(questions) + 3)[0]["questions"][0]
        questions.append({**q, "marks": per_q, "co": c["co_mapping"], "bloom": c["bloom_level"], "chunk_id": c["chunk_id"], "topic": c["topic_title"]})
    co_split, bloom_split = {}, {}
    for q in questions:
        co_split[q["co"]] = co_split.get(q["co"], 0) + q["marks"]
        bloom_split[q["bloom"]] = bloom_split.get(q["bloom"], 0) + q["marks"]
    return {"offering_id": offering_id, "course_code": off["courses"]["course_code"], "timeline": "IQAC_MOCK_TEST" if mock_iqac else timeline,
            "session_range": None if mock_iqac else [from_session, to_session], "total_marks": per_q * len(questions),
            "co_split": co_split, "blooms_split": bloom_split, "rubric_target": rubric, "questions": questions}
