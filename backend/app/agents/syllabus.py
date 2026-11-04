"""Syllabus upload: file -> Gemini (or a heuristic parser) -> course, topics, sections, enrolments, semester plan, graph links."""
import io
import re
import zipfile
from datetime import date

from app.agents import knowledge_graph, pacing
from app.core.db import audit, get_db, rows
from app.services import llm
from app.services.attention import stratum_from_ltp

SLOT_BY_SECTION = {"A": "MORNING_09AM", "B": "MIDDAY_11AM", "C": "POST_LUNCH_02PM"}
BLOOMS = {"UNDERSTAND", "APPLY", "ANALYZE", "CREATE"}


# ---------------------------------------------------------------- file -> text
def docx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        xml = z.read("word/document.xml").decode("utf-8", "ignore")
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<w:tab/>", "\t", xml)
    text = re.sub(r"<[^>]+>", "", xml)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def pdf_text(data: bytes) -> str:
    """Plain text from a text-based PDF, used when the AI is unavailable."""
    try:
        from pypdf import PdfReader
        return "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(data)).pages)
    except Exception:
        return ""


def read_file(data: bytes, filename: str, mime: str | None) -> tuple[str | None, bytes | None]:
    """Returns (text, pdf_bytes). PDFs go straight to Gemini, which reads them natively."""
    name = (filename or "").lower()
    if name.endswith(".pdf") or mime == "application/pdf":
        return None, data
    if name.endswith(".docx"):
        return docx_text(data), None
    return data.decode("utf-8", "ignore"), None


# ---------------------------------------------------------------- heuristic fallback (no AI)
UNIT_RE = re.compile(r"^\s*(unit|module|chapter)\s*[-:]?\s*([0-9ivx]+)\s*[:.\-–]?\s*(.*)$", re.I)


def heuristic_parse(text: str) -> dict:
    units, current = [], None
    for raw in text.splitlines():
        line = raw.strip(" \t•-*·")
        if not line:
            continue
        m = UNIT_RE.match(line)
        if m:
            current = {"unit_number": len(units) + 1, "title": m.group(3).strip() or f"Unit {len(units) + 1}", "topics": []}
            units.append(current)
            continue
        if current is None or len(line) < 4 or line.lower().startswith(("course", "credits", "l:t:p", "prerequisite")):
            continue
        for part in re.split(r"[;,](?![^()]*\))", line) if len(line) > 140 else [line]:
            part = part.strip(" .")
            if len(part) > 3:
                current["topics"].append({"title": part[:90], "content": part, "keywords": [w.lower() for w in re.findall(r"[A-Za-z][A-Za-z\-]{3,}", part)][:6]})
    if not units:
        lines = [l.strip() for l in text.splitlines() if len(l.strip()) > 6][:20]
        units = [{"unit_number": 1, "title": "Syllabus", "topics": [{"title": l[:90], "content": l, "keywords": []} for l in lines]}]
    # merge very small topics so each is roughly one class
    for u in units:
        merged = []
        for t in u["topics"]:
            if merged and len(merged[-1]["content"]) < 60:
                merged[-1]["content"] += "; " + t["content"]
                merged[-1]["keywords"] += t["keywords"]
            else:
                merged.append(t)
        u["topics"] = merged[:6] or [{"title": u["title"], "content": u["title"], "keywords": []}]
    title = next((l.strip() for l in text.splitlines() if l.strip()), "Uploaded course")[:120]
    return {"course_title": title, "units": units, "course_outcomes": []}


# ---------------------------------------------------------------- build the course
def _clean_topic(t: dict, unit_idx: int) -> dict:
    bloom = str(t.get("bloom_level") or "APPLY").upper()
    ltp = str(t.get("ltp_type") or "L").upper()
    co = str(t.get("co") or f"CO{min(unit_idx, 5)}").upper()
    return {
        "title": str(t.get("title") or "Topic")[:200],
        "content": str(t.get("content") or t.get("title") or "")[:2000],
        "keywords": [str(k).lower()[:60] for k in (t.get("keywords") or [])][:8],
        "bloom": bloom if bloom in BLOOMS else "APPLY",
        "ltp": ltp if ltp in ("L", "T", "P") else "L",
        "co": co if re.fullmatch(r"CO[1-9]", co) else f"CO{min(unit_idx, 5)}",
        "minutes": int(min(120, max(20, float(t.get("estimated_minutes") or 45)))),
        "complexity": round(min(2.0, max(0.8, float(t.get("cognitive_complexity") or 1.2))), 2),
    }


def create_from_upload(*, teacher_id: str, data: bytes, filename: str, mime: str | None, course_code: str | None,
                       course_title: str | None, semester: int, credits: int | None, l: int | None, t: int | None, p: int | None,
                       sections: list[str], last_working_day: str | None, start_date: str | None) -> dict:
    db = get_db()
    text, pdf = read_file(data, filename, mime)
    parsed, engine = None, "HEURISTIC"
    if llm.enabled():
        parsed = llm.parse_syllabus(text, pdf)
        engine = llm.MODEL if parsed and parsed.get("units") else "HEURISTIC"
    if not parsed or not parsed.get("units"):
        if text is None:
            text = pdf_text(pdf or b"")
            if len(text.strip()) < 40:
                raise ValueError("Couldn't read text from this PDF (it may be a scan). Try the .docx version, or retry in a minute.")
        parsed = heuristic_parse(text)

    ltp = parsed.get("ltp") or {}
    l = l if l is not None else int(ltp.get("l") or 3)
    t = t if t is not None else int(ltp.get("t") or 0)
    p = p if p is not None else int(ltp.get("p") or 1)
    code = (course_code or parsed.get("course_code") or "NEW").strip().upper()[:24]
    existing = {c["course_code"] for c in rows(db.table("courses").select("course_code").like("course_code", f"{code}%"))}
    if code in existing:
        n = 2
        while f"{code}-{n}" in existing:
            n += 1
        code = f"{code}-{n}"
    title = (course_title or parsed.get("course_title") or "Uploaded course").strip()[:180]
    teacher = rows(db.table("users").select("department_id").eq("user_id", teacher_id))
    course = db.table("courses").insert({
        "course_code": code, "course_title": title, "department_id": teacher[0]["department_id"] if teacher else None,
        "semester": semester, "credits": credits or int(parsed.get("credits") or (l + t + p)),
        "l_ratio": l, "t_ratio": t, "p_ratio": p, "course_stratum": stratum_from_ltp(l, t, p),
        "last_working_day": last_working_day or "2026-12-18", "created_by": teacher_id,
        "course_outcomes": parsed.get("course_outcomes") or [],
    }).execute().data[0]

    chunk_rows, slide = [], 1
    for ui, unit in enumerate(parsed["units"], start=1):
        for si, topic in enumerate(unit.get("topics") or [], start=1):
            c = _clean_topic(topic, ui)
            span = 10 + int(c["minutes"] / 6)
            chunk_rows.append({
                "course_id": course["course_id"], "unit_number": ui, "sequence_order": si, "topic_title": c["title"],
                "syllabus_content": c["content"], "slide_range": "Lab sheet" if c["ltp"] == "P" else f"Slides {slide}-{slide + span - 1}",
                "ltp_type": c["ltp"], "estimated_minutes": c["minutes"], "cognitive_complexity": c["complexity"],
                "co_mapping": c["co"], "bloom_level": c["bloom"], "canonical_keywords": c["keywords"],
            })
            if c["ltp"] != "P":
                slide += span
    if not chunk_rows:
        raise ValueError("No topics could be found in this file.")
    db.table("syllabus_chunks").insert(chunk_rows).execute()

    start = start_date or date.today().isoformat()
    section_out = []
    for sec in sections:
        sec = sec.strip().upper()[:3]
        off = db.table("course_offerings").insert({
            "course_id": course["course_id"], "faculty_id": teacher_id, "academic_year": "2026-27", "section": sec,
            "default_time_slot": SLOT_BY_SECTION.get(sec, "MIDDAY_11AM"),
        }).execute().data[0]
        students = rows(db.table("users").select("user_id").eq("role_id", 8).eq("semester", semester).eq("section", sec))
        if students:
            db.table("student_enrollments").upsert([{"offering_id": off["offering_id"], "student_id": s["user_id"], "enrollment_category": "MAJOR"} for s in students],
                                                   on_conflict="offering_id,student_id").execute()
        plan = pacing.generate_plan(off["offering_id"], start_date=start, preserve_completed=False)
        section_out.append({"offering_id": off["offering_id"], "section": sec, "time_slot": off["default_time_slot"],
                            "students": len(students), "sessions": plan["sessions_planned"], "finishes_on": plan["syllabus_finishes_on"]})

    bridges = knowledge_graph.build_course_links(course["course_id"])
    db.table("syllabus_uploads").insert({"course_id": course["course_id"], "uploaded_by": teacher_id, "file_name": filename,
                                         "mime_type": mime, "parse_engine": engine, "parsed_json": parsed}).execute()
    audit(teacher_id, "UPLOAD_SYLLABUS", "courses", course["course_id"], {"file": filename, "engine": engine, "topics": len(chunk_rows)})
    return {
        "course": {"course_id": course["course_id"], "course_code": code, "course_title": title, "ltp": f"{l}:{t}:{p}", "semester": semester},
        "parse_engine": engine, "units": [{"unit_number": i, "title": u.get("title"), "topics": len(u.get("topics") or [])} for i, u in enumerate(parsed["units"], 1)],
        "topics": len(chunk_rows), "course_outcomes": parsed.get("course_outcomes") or [], "sections": section_out, "bridges": bridges,
    }
