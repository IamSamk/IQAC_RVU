"""Real-account flow: teacher uploads a syllabus, runs a class, student checks in and gets notes + graph.

    API=http://localhost:8000/api/v1 python backend/tests/flow_test.py [path/to/syllabus.pdf]

Logs in with the seeded test accounts (see supabase/migrations/004_auth_attendance_uploads.sql).
"""
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

API = os.getenv("API", "http://localhost:8000/api/v1").rstrip("/")
HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLE = os.path.join(HERE, "..", "..", "frontend", "public", "samples", "CS310_Digital_Image_Processing_Syllabus.pdf")
failures = []


def req(method, path, body=None, token=None, form=None, timeout=300):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    data = None
    if form is not None:
        boundary = uuid.uuid4().hex
        parts = []
        for k, v in form.items():
            if isinstance(v, tuple):
                name, content, mime = v
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + content + b"\r\n")
            else:
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        data = b"".join(parts) + f"--{boundary}--\r\n".encode()
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(API + path, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as f:
            return f.status, json.loads(f.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]


def check(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")
    if not ok:
        failures.append(name)


path = sys.argv[1] if len(sys.argv) > 1 else SAMPLE
s, _ = req("POST", "/auth/login", {"email": "teacher@campusai.test", "password": "wrong"})
check("wrong password rejected", s == 401)
s, t = req("POST", "/auth/login", {"email": "teacher@campusai.test", "password": "Teacher@123"})
check("teacher logs in", s == 200 and t["user"]["portal"] == "teacher", t["user"]["full_name"] if s == 200 else t)
T = t["token"]
s, st = req("POST", "/auth/login", {"email": "student@campusai.test", "password": "Student@123"})
check("student logs in", s == 200 and st["user"]["portal"] == "student")
S = st["token"]

t0 = time.time()
with open(path, "rb") as f:
    content = f.read()
s, up = req("POST", "/teacher/syllabus", token=T, form={
    "file": (os.path.basename(path), content, mimetypes.guess_type(path)[0] or "application/octet-stream"),
    "semester": "5", "sections": "A,B,C"})
check("syllabus upload parsed", s == 200 and up["topics"] >= 6, f"{up.get('parse_engine')} · {up.get('topics')} topics · {time.time() - t0:.0f}s" if s == 200 else up)
if s != 200:
    sys.exit(1)
print("   units:", [(u["title"], u["topics"]) for u in up["units"]])
print("   sections:", [(x["section"], x["students"], x["sessions"]) for x in up["sections"]])
print("   bridges:", [(b["from"][:30], b["to"][:30], b["similarity"]) for b in up["bridges"]])
check("three sections created", [x["section"] for x in up["sections"]] == ["A", "B", "C"])
check("students enrolled per section", all(x["students"] > 0 for x in up["sections"]))
course_id = up["course"]["course_id"]

s, home = req("GET", "/teacher/home", token=T)
check("teacher home lists the course", s == 200 and any(c["course_id"] == course_id for c in home["courses"]))
s, cd = req("GET", f"/teacher/courses/{course_id}", token=T)
check("course plan per section", s == 200 and len(cd["sections"]) == 3, str([(x["section"], x["dip_minute"]) for x in cd["sections"]]) if s == 200 else cd)
sec_a = next(x for x in cd["sections"] if x["section"] == "A")
first = next(x for x in sec_a["sessions"] if x["session_type"] == "REGULAR_CLASS")
sid = first["session_id"]

s, lp = req("POST", f"/classes/{sid}/lesson-plan", {"platform": "Mentimeter"}, token=T)
check("AI lesson plan", s == 200 and "Flow" in lp["lesson_plan_md"], lp.get("engine") if s == 200 else lp)
s, lv = req("POST", f"/classes/{sid}/start", token=T)
code = lv["session"]["attendance_code"] if s == 200 else None
check("class started with code", s == 200 and code and len(code) == 4)
s, _ = req("POST", f"/classes/{sid}/attend", {"code": "0000" if code != "0000" else "1111"}, token=S)
check("wrong code rejected", s == 403)
s, _ = req("POST", f"/classes/{sid}/attend", {"code": code}, token=S)
check("student checks in", s == 200)
s, _ = req("POST", f"/classes/{sid}/attend", {"code": code}, token=T)
check("teacher cannot check in as student", s == 403)
s, lv = req("GET", f"/classes/{sid}/live", token=T)
check("teacher sees attendance", s == 200 and lv["present_count"] == 1, f"{lv['present_count']}/{lv['enrolled_count']}" if s == 200 else lv)
s, act = req("POST", f"/live-class/{sid}/trigger-activity", {"delivery_platform": "MENTIMETER", "use_ai": False})
check("activity launched", s == 200 and len(act["question_sets"]) == 10)
s, mine = req("GET", f"/classes/{sid}/my-activity", token=S)
check("student gets their own set", s == 200 and mine.get("questions"), f"set {mine.get('set_number')}/{mine.get('total_sets')}" if s == 200 else mine)
s, sh = req("GET", "/student/home", token=S)
check("student sees today's class", s == 200 and any(c["session_id"] == sid and c["attended"] for c in sh["todays_classes"]))
s, end = req("POST", f"/live-class/{sid}/end-session", {"transcript": "Today we covered how a camera sensor captures light, how sampling and quantisation turn it into pixels, and why higher ISO adds noise."}, token=T)
check("class ended, notes generated", s == 200 and len(end["generated_class_notes_md"]) > 100)
s, notes = req("GET", "/student/notes", token=S)
check("student can read the notes", s == 200 and any(n["session_id"] == sid for n in notes))
s, kg = req("GET", f"/knowledge-graph/{st['user']['user_id']}", token=S)
codes = sorted({n["course_code"] for n in kg["nodes"]}) if s == 200 else []
check("student graph spans new course", s == 200 and up["course"]["course_code"] in codes, str(codes))
check("graph has cross-course links", s == 200 and len(kg["bridges"]) >= 2, str(len(kg.get("bridges", []))) if s == 200 else "")

print(f"\n{'ALL PASSED' if not failures else f'{len(failures)} FAILED: ' + ', '.join(failures)}  ({API})")
sys.exit(1 if failures else 0)
