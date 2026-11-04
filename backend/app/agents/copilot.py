"""Agent 4: Proactive faculty co-pilot. Tasks are pre-executed as drafts and wait for 1-click HITL approval."""
from datetime import datetime, timedelta, timezone

from app.agents import assessment, pacing
from app.core.db import audit, get_db, one, remember, rows


def list_tasks(faculty_id: str | None, status: str | None = None) -> list[dict]:
    q = get_db().table("faculty_copilot_tasks").select("*, course_offerings(courses(course_code, course_title))").order("due_timestamp")
    if faculty_id:
        q = q.eq("faculty_id", faculty_id)
    if status:
        q = q.eq("status", status)
    return rows(q)


def scan_and_draft(faculty_id: str) -> list[dict]:
    """Look at the faculty's live state and pre-execute any tool calls that are due."""
    db = get_db()
    created = []
    open_titles = {t["task_title"] for t in list_tasks(faculty_id, "AWAITING_HITL_APPROVAL")}
    for off in rows(db.table("course_offerings").select("offering_id, courses(course_code)").eq("faculty_id", faculty_id)):
        oid, code = off["offering_id"], off["courses"]["course_code"]
        pending = rows(db.table("ocr_exam_evaluations").select("eval_id").eq("offering_id", oid).eq("faculty_approved", False))
        if pending:
            title = f"{code}: {len(pending)} OCR sheet(s) awaiting verification"
            if title not in open_titles:
                created.append({"faculty_id": faculty_id, "offering_id": oid, "task_title": title, "tool_call_name": "sync_ocr_grades",
                                "due_timestamp": (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
                                "pre_executed_draft_payload": {"eval_ids": [p["eval_id"] for p in pending]}})
        done = rows(db.table("session_plans").select("session_number").eq("offering_id", oid).eq("status", "COMPLETED").order("session_number", desc=True).limit(4))
        if done:
            quiz = assessment.compile_quiz(oid, "WEEKLY")
            title = f"{code}: Weekly Quiz drafted from Sessions {quiz['session_range'][0]}-{quiz['session_range'][1]}"
            if title not in open_titles:
                created.append({"faculty_id": faculty_id, "offering_id": oid, "task_title": title, "tool_call_name": "compile_biweekly_quiz",
                                "due_timestamp": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(), "pre_executed_draft_payload": quiz})
    if created:
        db.table("faculty_copilot_tasks").insert(created).execute()
    return created


def approve(task_id: str, actor_id: str | None, edited_payload: dict | None = None) -> dict:
    db = get_db()
    task = one(db.table("faculty_copilot_tasks").select("*").eq("task_id", task_id))
    if not task:
        raise ValueError("task not found")
    if task["status"] != "AWAITING_HITL_APPROVAL":
        return {"task_id": task_id, "status": task["status"], "message": "already executed"}
    payload = edited_payload or task["pre_executed_draft_payload"]
    tool = task["tool_call_name"]
    result: dict
    if tool == "recalibrate_pacing_calendar":
        result = pacing.generate_plan(task["offering_id"], preserve_completed=True)
    elif tool == "sync_ocr_grades":
        ids = payload.get("eval_ids") or [e["eval_id"] for e in rows(db.table("ocr_exam_evaluations").select("eval_id").eq("offering_id", task["offering_id"]).eq("faculty_approved", False))]
        result = {"synced": [assessment.approve_and_sync(i, actor_id or task["faculty_id"], None)["eval_id"] for i in ids],
                  "co_attainment": assessment.co_attainment(task["offering_id"])}
    elif tool == "compile_biweekly_quiz":
        result = {"published_to": ["IN_APP", "GOOGLE_CLASSROOM_MOCK"], "questions": len(payload.get("questions", [])), "status": "PUBLISHED"}
    elif tool == "push_remedial_flashcards":
        result = {"pushed_to": payload.get("students", []), "channel": payload.get("channel"), "status": "DELIVERED_MOCK"}
    else:
        result = {"status": "EXECUTED_MOCK", "tool": tool}
    status = "EDITED_BY_FACULTY" if edited_payload else "APPROVED_EXECUTED"
    db.table("faculty_copilot_tasks").update({"status": status, "pre_executed_draft_payload": payload}).eq("task_id", task_id).execute()
    actor = actor_id or task["faculty_id"]
    audit(actor, "APPROVE_COPILOT_TASK", "faculty_copilot_tasks", task_id, {"tool": tool, "edited": bool(edited_payload)})
    remember(task["faculty_id"], "TOOL_PREFERENCE", f"Approved '{task['task_title']}' ({tool}){' after editing' if edited_payload else ''}.", {"tool": tool})
    return {"task_id": task_id, "status": status, "tool_call_name": tool, "execution_result": result}


def memory(user_id: str) -> list[dict]:
    return rows(get_db().table("agent_memory_logs").select("memory_id, memory_scope, memory_summary, structured_context, created_at").eq("user_id", user_id).order("created_at", desc=True))
