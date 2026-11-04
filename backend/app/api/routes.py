import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.agents import assessment, copilot, knowledge_graph, pacing
from app.core.db import audit, get_db, one, rows
from app.core.rbac import Actor, get_actor, require_role
from app.models.schemas import (ActivityIn, ApproveOcrIn, ApproveTaskIn, CheckpointIn, CompileIn, EndSessionIn, OcrSheetIn,
                                PacingRequest, PersonaIn, TranscriptIn, VoteIn)
from app.services import attention, llm, seeder
from app.services.questions import generate_sets

api = APIRouter(prefix="/api/v1")


def _404(e: Exception):
    raise HTTPException(404, str(e))


# ------------------------------------------------------------------ core / ERP
@api.post("/seed-demo", tags=["ERP"])
def seed_demo():
    """Reset and seed RBAC users, CS304 + DES201 + CS204-2024, chunks, KG, PYQs, OCR sheets, co-pilot tasks, pacing calendars."""
    return seeder.seed_all()


@api.get("/ai/status", tags=["ERP"])
def ai_status():
    return {"enabled": llm.enabled(), "provider": "Google Gemini API", "model": llm.MODEL,
            "used_for": ["OCR mark-sheet vision", "lecture audio transcription", "grounded class notes", "10-set isomorphic activities", "cross-subject bridge examples"]}


@api.get("/me", tags=["ERP"])
def me(actor: Actor = Depends(get_actor)):
    return actor


@api.get("/users", tags=["ERP"])
def users(role: str | None = None):
    data = rows(get_db().table("users").select("user_id, institution_id, full_name, email, semester, section, department_id, roles(role_code, hierarchy_rank), departments(dept_code)").order("full_name"))
    return [u for u in data if not role or (u.get("roles") or {}).get("role_code") == role]


@api.get("/users/{user_id}", tags=["ERP"])
def user(user_id: str):
    u = one(get_db().table("users").select("*, roles(*), departments(*)").eq("user_id", user_id))
    if not u:
        raise HTTPException(404, "user not found")
    db = get_db()
    u["teaching"] = rows(db.table("course_offerings").select("offering_id, section, default_time_slot, courses(course_id, course_code, course_title, l_ratio, t_ratio, p_ratio)").eq("faculty_id", user_id))
    u["enrollments"] = rows(db.table("student_enrollments").select("enrollment_category, course_offerings(offering_id, courses(course_id, course_code, course_title))").eq("student_id", user_id))
    return u


@api.patch("/users/{user_id}/persona", tags=["ERP"])
def update_persona(user_id: str, body: PersonaIn, actor: Actor = Depends(require_role("FACULTY"))):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    get_db().table("users").update(patch).eq("user_id", user_id).execute()
    audit(actor.user_id or user_id, "UPDATE_TEACHER_PERSONA", "users", user_id, patch)
    return {"user_id": user_id, **patch}


@api.get("/roles", tags=["ERP"])
def roles():
    return rows(get_db().table("roles").select("*").order("hierarchy_rank", desc=True))


@api.get("/courses", tags=["ERP"])
def courses():
    return rows(get_db().table("courses").select("*, departments(dept_code, dept_name), course_offerings(offering_id, section, academic_year, faculty_id, default_time_slot)").order("course_code"))


@api.get("/courses/{course_id}/chunks", tags=["ERP"])
def course_chunks(course_id: str):
    return rows(get_db().table("syllabus_chunks").select("chunk_id, unit_number, sequence_order, topic_title, syllabus_content, slide_range, ltp_type, estimated_minutes, cognitive_complexity, co_mapping, bloom_level, canonical_keywords, is_deprecated").eq("course_id", course_id).order("unit_number").order("sequence_order"))


@api.get("/audit-logs", tags=["ERP"])
def audit_logs(limit: int = 50, actor: Actor = Depends(require_role("HOD"))):
    return rows(get_db().table("rbac_audit_logs").select("*, users(full_name)").order("created_at", desc=True).limit(limit))


@api.get("/admin/compliance", tags=["ERP"])
def compliance():
    """IQAC view: per-offering pacing health, OCR verification backlog, CO attainment."""
    db = get_db()
    out = []
    for off in rows(db.table("course_offerings").select("offering_id, academic_year, courses(course_code, course_title, l_ratio, t_ratio, p_ratio, iqac_rubric_config), users(full_name)").eq("academic_year", "2026-27")):
        plan = pacing.get_plan(off["offering_id"])
        out.append({"offering_id": off["offering_id"], "course_code": off["courses"]["course_code"], "course_title": off["courses"]["course_title"],
                    "faculty": (off.get("users") or {}).get("full_name"), "ltp": plan["ltp_badge"], "progress": plan["progress"],
                    "co_attainment": assessment.co_attainment(off["offering_id"]),
                    "co_po_mapping": assessment.co_po_mapping(off["offering_id"]),
                    "rubric": off["courses"]["iqac_rubric_config"]})
    return {"offerings": out, "rbac_matrix": roles()}


# ------------------------------------------------------------------ Agent 1: pacing
@api.get("/pacing/{offering_id}", tags=["Agent 1 - Pacing"])
def get_pacing(offering_id: str):
    try:
        return pacing.get_plan(offering_id)
    except ValueError as e:
        _404(e)


@api.post("/pacing/{offering_id}", tags=["Agent 1 - Pacing"])
def post_pacing(offering_id: str, body: PacingRequest, actor: Actor = Depends(require_role("FACULTY"))):
    """Regenerate the L:T:P semester plan using the teacher persona prompt (completed sessions are preserved)."""
    try:
        ctx = pacing.offering_context(offering_id)
    except ValueError as e:
        _404(e)
    fac_id = ctx["offering"]["faculty_id"]
    if body.save_persona and (body.pedagogical_system_prompt or body.persona_parameters):
        patch = {k: v for k, v in {"pedagogical_system_prompt": body.pedagogical_system_prompt, "persona_parameters": body.persona_parameters}.items() if v}
        get_db().table("users").update(patch).eq("user_id", fac_id).execute()
    result = pacing.generate_plan(offering_id, body.start_date, body.ia_dates, body.pedagogical_system_prompt, body.persona_parameters, body.preserve_completed)
    audit(actor.user_id or fac_id, "OVERRIDE_PACING", "session_plans", offering_id, {"prompt": body.pedagogical_system_prompt, "result": {k: result[k] for k in ("sessions_planned", "syllabus_finishes_on")}})
    return {"summary": result, "plan": pacing.get_plan(offering_id)}


# ------------------------------------------------------------------ Agent 1: live class
def _session(session_id: str) -> dict:
    s = one(get_db().table("session_plans").select("*").eq("session_id", session_id))
    if not s:
        raise HTTPException(404, "session not found")
    return s


@api.get("/live-class/current", tags=["Agent 1 - Live Class"])
def current_session(offering_id: str = seeder.O_CS304):
    s = one(get_db().table("session_plans").select("*").eq("offering_id", offering_id).in_("status", ["SCHEDULED", "IN_PROGRESS"]).order("session_number"))
    if not s:
        raise HTTPException(404, "no upcoming session")
    chunks = rows(get_db().table("syllabus_chunks").select("chunk_id, topic_title, slide_range, unit_number").in_("chunk_id", s["planned_chunk_ids"] or []))
    return {**s, "planned_topics": chunks}


@api.get("/live-class/{session_id}/attention-model", tags=["Agent 1 - Live Class"])
def attention_model(session_id: str, words_per_minute: float | None = None, use_poll: bool = True,
                    stratum: str | None = None, semester: int | None = None, time_slot: str | None = None):
    """IUCEE passive decay vs CampusAI active-reset curve, strata dip timings, optional student-poll override."""
    s = _session(session_id)
    ctx = pacing.offering_context(s["offering_id"])
    course = ctx["course"]
    st = stratum or course.get("course_stratum") or attention.stratum_from_ltp(course["l_ratio"], course["t_ratio"], course["p_ratio"])
    poll_dip, pref = (None, None)
    votes = rows(get_db().table("attention_telemetry_votes").select("minute_of_class, reported_focus_score, preferred_split_min").eq("session_id", session_id))
    if use_poll and votes:
        poll_dip, pref = attention.poll_dip_from_votes(votes)
    elif use_poll:
        # cold start: fall back to the class's most recent session that has votes
        prev = rows(get_db().table("session_plans").select("session_id").eq("offering_id", s["offering_id"]).lt("session_number", s["session_number"]).order("session_number", desc=True).limit(5))
        for p in prev:
            v = rows(get_db().table("attention_telemetry_votes").select("minute_of_class, reported_focus_score, preferred_split_min").eq("session_id", p["session_id"]))
            if v:
                poll_dip, pref = attention.poll_dip_from_votes(v)
                votes = v
                break
    model = attention.build_model(st, semester or ctx["cohort_semester"], time_slot or ctx["offering"]["default_time_slot"],
                                  s["session_duration_mins"] if s["session_duration_mins"] <= 90 else 60, words_per_minute, poll_dip)
    model["strata_curves"] = attention.strata_curves()
    model["student_poll"] = {"votes": len(votes), "poll_dip_minute": poll_dip, "avg_preferred_split_min": pref}
    model["session"] = {"session_id": session_id, "session_number": s["session_number"], "course_code": course["course_code"]}
    model["citations"] = ["Stuart & Rutherford (1978) Medical student concentration during lectures, The Lancet",
                          "Bunce, Flens & Neiles (2010) How long can students pay attention in class?, J. Chem. Educ.",
                          "IUCEE faculty-development guidance on active-learning breaks"]
    return model


@api.post("/live-class/{session_id}/attention-vote", tags=["Agent 1 - Live Class"])
def attention_vote(session_id: str, body: VoteIn):
    _session(session_id)
    rec = get_db().table("attention_telemetry_votes").insert({"session_id": session_id, **body.model_dump()}).execute().data[0]
    return rec


@api.post("/live-class/{session_id}/start", tags=["Agent 1 - Live Class"])
def start_session(session_id: str):
    _session(session_id)
    get_db().table("session_plans").update({"status": "IN_PROGRESS"}).eq("session_id", session_id).execute()
    return {"session_id": session_id, "status": "IN_PROGRESS"}


@api.post("/live-class/{session_id}/transcript", tags=["Agent 1 - Live Class"])
def push_transcript(session_id: str, body: TranscriptIn):
    """Append an ASR transcript segment. Confidence < 0.75 tells the UI to open the 1-tap slide fallback."""
    s = _session(session_id)
    if body.confidence < 0.75:
        get_db().table("session_plans").update({"transcription_status": "PENDING"}).eq("session_id", session_id).execute()
        return {"accepted": False, "fallback_required": True, "reason": f"ASR confidence {body.confidence:.2f} < 0.75",
                "fallback_endpoint": f"/api/v1/live-class/{session_id}/fallback-checkpoint"}
    text = ((s.get("live_transcript_text") or "") + " " + body.text).strip()
    get_db().table("session_plans").update({"live_transcript_text": text, "transcription_status": "COMPLETED_ASR"}).eq("session_id", session_id).execute()
    return {"accepted": True, "fallback_required": False, "transcript_chars": len(text)}


@api.post("/live-class/{session_id}/transcribe-audio", tags=["Agent 1 - Live Class"])
async def transcribe_audio(session_id: str, audio: UploadFile = File(...)):
    """Gemini ASR. Confidence < 0.75 (or engine failure) tells the UI to open the 1-tap slide fallback."""
    s = _session(session_id)
    data = await audio.read()
    res = llm.transcribe(data, audio.content_type or "audio/webm") if llm.enabled() else None
    fallback = {"fallback_endpoint": f"/api/v1/live-class/{session_id}/fallback-checkpoint", "bytes_received": len(data)}
    if not res or not res.get("text"):
        return {"accepted": False, "fallback_required": True, "reason": "ASR engine unavailable or returned nothing", **fallback}
    conf = float(res.get("confidence") or 0)
    if conf < 0.75:
        return {"accepted": False, "fallback_required": True, "reason": f"ASR confidence {conf:.2f} < 0.75", "partial_text": res["text"], **fallback}
    text = ((s.get("live_transcript_text") or "") + " " + res["text"]).strip()
    get_db().table("session_plans").update({"live_transcript_text": text, "transcription_status": "COMPLETED_ASR"}).eq("session_id", session_id).execute()
    return {"accepted": True, "fallback_required": False, "engine": llm.MODEL, "text": res["text"], "confidence": conf,
            "words_per_minute": res.get("words_per_minute"), "transcript_chars": len(text)}


def _slide_bounds(slide_range: str | None) -> tuple[int, int] | None:
    m = re.search(r"(\d+)\s*-\s*(\d+)", slide_range or "")
    return (int(m.group(1)), int(m.group(2))) if m else None


@api.post("/live-class/{session_id}/fallback-checkpoint", tags=["Agent 1 - Live Class"])
def fallback_checkpoint(session_id: str, body: CheckpointIn, actor: Actor = Depends(require_role("TA"))):
    """Teacher taps the slide / sub-topic reached when ASR fails; pacing recalibrates with no data loss."""
    s = _session(session_id)
    db = get_db()
    planned = s["planned_chunk_ids"] or []
    chunks = {c["chunk_id"]: c for c in rows(db.table("syllabus_chunks").select("*").in_("chunk_id", planned))} if planned else {}
    target = body.chunk_id or (planned[0] if planned else None)
    covered, behind = [], 0
    label = body.topic or ""
    if target and target in chunks:
        c = chunks[target]
        frac = 1.0
        b = _slide_bounds(c.get("slide_range"))
        if body.slide_number is not None and b:
            frac = max(0.0, min(1.0, (body.slide_number - b[0] + 1) / (b[1] - b[0] + 1)))
        idx = planned.index(target)
        covered = planned[:idx] + ([target] if frac >= 0.999 else [])
        expected = s.get("lecture_minutes_split") or 42
        behind = round((1 - frac) * min(expected, c["estimated_minutes"]))
        label = label or (f"{c['topic_title']} - slide {body.slide_number}" if body.slide_number else c["topic_title"])
    db.table("session_plans").update({"fallback_slide_checkpoint": label[:120], "transcription_status": "FALLBACK_SLIDE_MANUAL"}).eq("session_id", session_id).execute()
    s["transcription_status"] = "FALLBACK_SLIDE_MANUAL"
    notes = pacing.class_notes(s, [chunks[c] for c in covered if c in chunks], s.get("live_transcript_text"), label, use_ai=True)
    result = pacing.recalibrate_after(s, covered, behind, notes, status_source="FALLBACK_SLIDE_MANUAL")
    audit(actor.user_id, "FALLBACK_CHECKPOINT", "session_plans", session_id, {"checkpoint": label, "reason": body.reason, "minutes_behind": behind})
    return {"session_id": session_id, "checkpoint": label, "covered_chunk_ids": covered, "minutes_behind": behind, "recalibration": result}


@api.post("/live-class/{session_id}/trigger-activity", tags=["Agent 1 - Live Class"])
def trigger_activity(session_id: str, body: ActivityIn):
    """10 isomorphic question sets for the same chunk + mock Mentimeter / Kahoot / Google Classroom payloads."""
    s = _session(session_id)
    db = get_db()
    chunk_id = body.chunk_id or (s["planned_chunk_ids"] or [None])[0]
    chunk = one(db.table("syllabus_chunks").select("*").eq("chunk_id", chunk_id)) if chunk_id else None
    if not chunk:
        raise HTTPException(400, "session has no planned chunk; pass chunk_id")
    course_chunks = rows(db.table("syllabus_chunks").select("*").eq("course_id", chunk["course_id"]))
    sets = llm.isomorphic_sets(chunk, body.n_sets) if (body.use_ai and llm.enabled()) else None
    engine = llm.MODEL if sets else "TEMPLATE_GENERATOR"
    if not sets:
        sets = generate_sets(chunk, course_chunks, n_sets=body.n_sets)
    minute = body.trigger_minute or round(s.get("predicted_dip_minute") or 18)
    goal = f"Apply {chunk['topic_title']} ({chunk['co_mapping']}, Bloom: {chunk['bloom_level']})"
    rec = db.table("polymorphic_activities").insert({"session_id": session_id, "chunk_id": chunk_id, "delivery_platform": body.delivery_platform,
                                                     "trigger_minute": minute, "learning_goal": goal, "question_sets_json": sets,
                                                     "requires_hitl_review": False}).execute().data[0]
    q1 = sets[0]["questions"][0]
    webhooks = {
        "MENTIMETER": {"endpoint": "https://api.mentimeter.com/v1/presentations (mock)", "payload": {"type": "quiz", "question": q1["question"], "choices": q1.get("options", [])}, "status": "QUEUED_MOCK"},
        "KAHOOT": {"endpoint": "https://create.kahoot.it/rest/kahoots (mock)", "payload": {"title": goal, "questions": [{"question": q["question"], "time": 30000} for q in sets[0]["questions"]]}, "status": "QUEUED_MOCK"},
        "GOOGLE_CLASSROOM": {"endpoint": "classroom.courses.courseWork.create (mock)", "payload": {"title": goal, "workType": "MULTIPLE_CHOICE_QUESTION", "description": q1["question"]}, "status": "QUEUED_MOCK"},
        "IN_APP_10_SETS": {"status": "LIVE", "assignment": "student i receives set ((seat_index) mod 10) + 1"},
    }
    return {"activity_id": rec["activity_id"], "trigger_minute": minute, "learning_goal": goal, "chunk_id": chunk_id,
            "delivery_platform": body.delivery_platform, "generator": engine, "question_sets": sets, "platform_sync": webhooks}


@api.post("/live-class/{session_id}/end-session", tags=["Agent 1 - Live Class"])
def end_session(session_id: str, body: EndSessionIn, actor: Actor = Depends(require_role("TA"))):
    """Compute coverage delta, shift upcoming sessions so the syllabus still ends before the last working day, and write notes."""
    s = _session(session_id)
    db = get_db()
    planned = s["planned_chunk_ids"] or []
    if body.covered_chunk_ids is None:
        later = rows(db.table("session_plans").select("planned_chunk_ids").eq("offering_id", s["offering_id"]).gt("session_number", s["session_number"]))
        still_planned = {c for r in later for c in (r["planned_chunk_ids"] or [])}
        covered = [c for c in planned if c not in still_planned]
    else:
        covered = body.covered_chunk_ids
    chunks = {c["chunk_id"]: c for c in rows(db.table("syllabus_chunks").select("*").in_("chunk_id", planned))} if planned else {}
    transcript = body.transcript or s.get("live_transcript_text")
    notes = pacing.class_notes(s, [chunks[c] for c in planned if c in chunks], transcript, s.get("fallback_slide_checkpoint"), use_ai=True)
    result = pacing.recalibrate_after(s, covered, body.minutes_behind, notes, transcript)
    audit(actor.user_id, "END_SESSION", "session_plans", session_id, {"covered": covered, "minutes_behind": body.minutes_behind})
    return {"session_id": session_id, "generated_class_notes_md": notes, "recalibration": result}


# ------------------------------------------------------------------ Agent 2: OCR + assessments
@api.post("/ocr/evaluate-sheet", tags=["Agent 2 - OCR & Assessment"])
def evaluate_sheet(body: OcrSheetIn):
    """Parse question-wise marks (Q1a..Q3b), verify sum = total, flag any cell with confidence < 0.95 for HITL."""
    if body.sample_case:
        case = assessment.SAMPLE_CASES.get(body.sample_case)
        if not case:
            raise HTTPException(400, f"sample_case must be one of {list(assessment.SAMPLE_CASES)}")
        payload = {**case, "scanned_sheet_url": body.scanned_sheet_url or f"demo://scans/{case['student_usn']}.jpg"}
    else:
        if not body.student_usn or not body.cells:
            raise HTTPException(400, "send sample_case, or student_usn + cells")
        payload = {"student_usn": body.student_usn, "exam_name": body.exam_name, "written_total": body.written_total,
                   "scanned_sheet_url": body.scanned_sheet_url, "cells": [c.model_dump() for c in body.cells]}
    try:
        return assessment.evaluate(body.offering_id, payload)
    except ValueError as e:
        raise HTTPException(400, str(e))


@api.post("/ocr/evaluate-sheet/upload", tags=["Agent 2 - OCR & Assessment"])
async def evaluate_sheet_upload(image: UploadFile = File(...), offering_id: str = Form(seeder.O_CS304), sample_case: str = Form("aarav_ia1"),
                                exam_name: str = Form("IA-1 Examination")):
    """Gemini vision reads the mark grid (USN, Q1a..Q3b, total, per-cell confidence). Falls back to the named sample case."""
    data = await image.read()
    extracted = llm.ocr_marksheet(data, image.content_type or "image/jpeg") if llm.enabled() else None
    if extracted:
        payload = {"student_usn": extracted["student_usn"], "exam_name": exam_name, "written_total": extracted.get("written_total"),
                   "scanned_sheet_url": f"upload://{image.filename}",
                   "cells": [{"q": c["q"], "marks": int(c["marks"]), "max": int(c["max"]), "conf": float(c.get("conf", 0.9))} for c in extracted["cells"]]}
        mode = llm.MODEL
    else:
        payload = {**assessment.SAMPLE_CASES.get(sample_case, assessment.SAMPLE_CASES["aarav_ia1"]), "scanned_sheet_url": f"upload://{image.filename}"}
        mode = "SAMPLE_CASE"
    try:
        res = assessment.evaluate(offering_id, payload)
    except ValueError as e:
        raise HTTPException(400, f"{e} (extracted by {mode})")
    res["ocr_engine"] = {"mode": mode, "bytes_received": len(data)}
    return res


@api.get("/ocr/evaluations", tags=["Agent 2 - OCR & Assessment"])
def evaluations(offering_id: str = seeder.O_CS304, pending_only: bool = False):
    q = get_db().table("ocr_exam_evaluations").select("*, users(full_name, institution_id)").eq("offering_id", offering_id).order("created_at", desc=True)
    if pending_only:
        q = q.eq("faculty_approved", False)
    return rows(q)


@api.post("/ocr/{eval_id}/approve-and-sync", tags=["Agent 2 - OCR & Assessment"])
def approve_ocr(eval_id: str, body: ApproveOcrIn, actor: Actor = Depends(require_role("FACULTY"))):
    try:
        return assessment.approve_and_sync(eval_id, actor.user_id, body.corrections)
    except ValueError as e:
        _404(e)


@api.get("/assessments/co-attainment/{offering_id}", tags=["Agent 2 - OCR & Assessment"])
def co_attainment(offering_id: str, exam_name: str | None = None):
    return assessment.co_attainment(offering_id, exam_name)


@api.get("/assessments/co-po-mapping/{offering_id}", tags=["Agent 2 - OCR & Assessment"])
def co_po(offering_id: str):
    """CO -> PO correlation matrix (0-3) derived from the approved syllabus, plus PO attainment."""
    try:
        return assessment.co_po_mapping(offering_id)
    except ValueError as e:
        _404(e)


@api.post("/assessments/compile", tags=["Agent 2 - OCR & Assessment"])
def compile_quiz(body: CompileIn):
    return assessment.compile_quiz(body.offering_id, body.timeline, body.from_session, body.to_session, body.total_marks)


@api.post("/assessments/mock-test/{offering_id}", tags=["Agent 2 - OCR & Assessment"])
def mock_test(offering_id: str, total_marks: int = 50):
    """IQAC rubric mock test across CO1-CO4 with the configured Bloom's split."""
    return assessment.compile_quiz(offering_id, total_marks=total_marks, mock_iqac=True)


# ------------------------------------------------------------------ Agent 3: knowledge graph + PYQ
@api.get("/knowledge-graph/{student_id}", tags=["Agent 3 - Knowledge Graph & PYQ"])
def kg(student_id: str):
    return knowledge_graph.student_graph(student_id)


@api.post("/knowledge-graph/{student_id}/rebuild", tags=["Agent 3 - Knowledge Graph & PYQ"])
def kg_rebuild(student_id: str, threshold: float = 0.3, persist: bool = False):
    return knowledge_graph.rebuild_bridges(student_id, threshold, persist)


@api.get("/students/{student_id}/diagnostics", tags=["Agent 3 - Knowledge Graph & PYQ"])
def diag(student_id: str):
    return knowledge_graph.diagnostics(student_id)


@api.get("/pyq/search", tags=["Agent 3 - Knowledge Graph & PYQ"])
def pyq(course_id: str = "30000000-0000-0000-0000-000000000001", recompute: bool = False, threshold: float = 0.85):
    try:
        return knowledge_graph.pyq_search(course_id, recompute, threshold)
    except ValueError as e:
        _404(e)


# ------------------------------------------------------------------ Agent 4: co-pilot
@api.get("/copilot/tasks", tags=["Agent 4 - Co-Pilot"])
def tasks(faculty_id: str | None = None, status: str | None = None):
    return copilot.list_tasks(faculty_id, status)


@api.post("/copilot/tasks/scan", tags=["Agent 4 - Co-Pilot"])
def scan(faculty_id: str):
    """Agent scans live state and pre-executes due tool calls as drafts."""
    return {"created": copilot.scan_and_draft(faculty_id)}


@api.post("/copilot/tasks/{task_id}/approve", tags=["Agent 4 - Co-Pilot"])
def approve_task(task_id: str, body: ApproveTaskIn | None = None, actor: Actor = Depends(require_role("FACULTY"))):
    try:
        return copilot.approve(task_id, actor.user_id, body.edited_payload if body else None)
    except ValueError as e:
        _404(e)


@api.get("/copilot/memory/{user_id}", tags=["Agent 4 - Co-Pilot"])
def memory(user_id: str):
    return copilot.memory(user_id)
