"""Routes for real accounts: login, teacher workspace, syllabus upload, live class, student portal."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.agents import classroom, syllabus
from app.core import auth
from app.core.db import get_db, one, rows
from app.core.rbac import ROLE_RANK, Actor, require_login

app_api = APIRouter(prefix="/api/v1")

MAX_UPLOAD_BYTES = 15 * 1024 * 1024


class LoginIn(BaseModel):
    email: str
    password: str


class AttendIn(BaseModel):
    code: str


class LessonPlanIn(BaseModel):
    platform: str = "Mentimeter"
    regenerate: bool = False


def _profile(user_id: str) -> dict:
    u = one(get_db().table("users").select("user_id, full_name, email, institution_id, semester, section, roles(role_code, hierarchy_rank), departments(dept_code, dept_name)").eq("user_id", user_id))
    if not u:
        raise HTTPException(404, "user not found")
    role = u.pop("roles") or {}
    dept = u.pop("departments") or {}
    code = role.get("role_code")
    portal = "student" if code == "STUDENT" else "admin" if code in ("IQAC_ADMIN", "DEAN") else "teacher"
    return {**u, "role_code": code, "rank": role.get("hierarchy_rank"), "department": dept.get("dept_name"), "portal": portal}


def _teacher(actor: Actor) -> Actor:
    if actor.rank < ROLE_RANK["TA"]:
        raise HTTPException(403, "Teachers only")
    return actor


def _student(actor: Actor) -> Actor:
    if actor.get("role_code") != "STUDENT":
        raise HTTPException(403, "Students only")
    return actor


# ---------------------------------------------------------------- auth
@app_api.post("/auth/login", tags=["Accounts"])
def login(body: LoginIn):
    found = get_db().rpc("verify_login", {"p_email": body.email, "p_password": body.password}).execute().data
    if not found:
        raise HTTPException(401, "Email or password is incorrect")
    uid = found[0]["user_id"]
    return {"token": auth.issue(uid), "user": _profile(uid)}


@app_api.get("/auth/me", tags=["Accounts"])
def me(actor: Actor = Depends(require_login)):
    return _profile(actor.user_id)


# ---------------------------------------------------------------- teacher
@app_api.get("/teacher/home", tags=["Teacher"])
def teacher_home(actor: Actor = Depends(require_login)):
    return classroom.teacher_home(_teacher(actor).user_id)


@app_api.post("/teacher/syllabus", tags=["Teacher"])
async def upload_syllabus(file: UploadFile = File(...), course_code: str = Form(""), course_title: str = Form(""),
                          semester: int = Form(5), credits: int | None = Form(None), l: int | None = Form(None),
                          t: int | None = Form(None), p: int | None = Form(None), sections: str = Form("A,B,C"),
                          last_working_day: str = Form("2026-12-18"), start_date: str = Form(""),
                          actor: Actor = Depends(require_login)):
    """Upload a syllabus (PDF, DOCX, TXT or MD). Gemini splits it into units and topics; the course, sections,
    enrolments, semester plan and knowledge-graph links are created in one go."""
    _teacher(actor)
    data = await file.read()
    if not data:
        raise HTTPException(400, "The file is empty")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Please upload a file under 15 MB")
    secs = [s.strip().upper() for s in sections.split(",") if s.strip()] or ["A"]
    try:
        return syllabus.create_from_upload(teacher_id=actor.user_id, data=data, filename=file.filename or "syllabus", mime=file.content_type,
                                           course_code=course_code or None, course_title=course_title or None, semester=semester,
                                           credits=credits, l=l, t=t, p=p, sections=secs, last_working_day=last_working_day or None,
                                           start_date=start_date or None)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app_api.get("/teacher/courses/{course_id}", tags=["Teacher"])
def course_detail(course_id: str, actor: Actor = Depends(require_login)):
    _teacher(actor)
    try:
        return classroom.course_detail(course_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app_api.post("/classes/{session_id}/start", tags=["Teacher"])
def start_class(session_id: str, actor: Actor = Depends(require_login)):
    _teacher(actor)
    try:
        return classroom.start_session(session_id, actor.user_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app_api.get("/classes/{session_id}/live", tags=["Teacher"])
def live(session_id: str, actor: Actor = Depends(require_login)):
    _teacher(actor)
    try:
        return classroom.live_view(session_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app_api.post("/classes/{session_id}/lesson-plan", tags=["Teacher"])
def lesson_plan(session_id: str, body: LessonPlanIn | None = None, actor: Actor = Depends(require_login)):
    _teacher(actor)
    body = body or LessonPlanIn()
    try:
        return classroom.make_lesson_plan(session_id, body.platform, body.regenerate)
    except ValueError as e:
        raise HTTPException(404, str(e))


# ---------------------------------------------------------------- student
@app_api.get("/student/home", tags=["Student"])
def student_home(actor: Actor = Depends(require_login)):
    return classroom.student_home(_student(actor).user_id)


@app_api.post("/classes/{session_id}/attend", tags=["Student"])
def attend(session_id: str, body: AttendIn, actor: Actor = Depends(require_login)):
    _student(actor)
    try:
        return classroom.attend(session_id, actor.user_id, body.code)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))


@app_api.get("/classes/{session_id}/my-activity", tags=["Student"])
def my_activity(session_id: str, actor: Actor = Depends(require_login)):
    _student(actor)
    return classroom.my_activity(session_id, actor.user_id) or {}


@app_api.get("/classes/{session_id}/notes", tags=["Student"])
def notes(session_id: str, actor: Actor = Depends(require_login)):
    try:
        return classroom.session_notes(session_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app_api.get("/student/notes", tags=["Student"])
def all_notes(actor: Actor = Depends(require_login)):
    sid = _student(actor).user_id
    offs = [e["offering_id"] for e in rows(get_db().table("student_enrollments").select("offering_id").eq("student_id", sid))]
    if not offs:
        return []
    sessions = rows(get_db().table("session_plans").select("session_id").in_("offering_id", offs).eq("status", "COMPLETED").not_.is_("generated_class_notes_md", "null").order("scheduled_date", desc=True).limit(40))
    return [classroom.session_notes(s["session_id"]) for s in sessions]
