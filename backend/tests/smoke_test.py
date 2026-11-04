"""End-to-end smoke test for the CampusAI API.

    API=http://localhost:8000/api/v1 python backend/tests/smoke_test.py
    API=https://campusai-backend-ak60.onrender.com/api/v1 python backend/tests/smoke_test.py

Resets the shared demo data at the start and end. Exits 1 if any check fails.
"""
import json
import os
import sys
import urllib.error
import urllib.request

API = os.getenv("API", "http://localhost:8000/api/v1").rstrip("/")
OFFERING = "40000000-0000-0000-0000-000000000001"
AARAV = "20000000-0000-0000-0000-000000000005"
DARSHAN = "20000000-0000-0000-0000-000000000002"
ADMIN = "20000000-0000-0000-0000-000000000001"
failures = []


def call(method, path, body=None, user=None, timeout=180):
    headers = {"Content-Type": "application/json", **({"X-User-Id": user} if user else {})}
    req = urllib.request.Request(API + path, method=method, headers=headers,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def check(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")
    if not ok:
        failures.append(name)


s, d = call("POST", "/seed-demo")
check("seed demo data", s == 200 and d["sql_seed"]["users"] == 12, str(d.get("sql_seed") if s == 200 else d))

# Agent 1: pacing + live class
s, p = call("GET", f"/pacing/{OFFERING}")
check("pacing plan", s == 200 and p["progress"]["sessions_completed"] == 12 and p["progress"]["net_pacing_delta_mins"] == -15, p["ltp_badge"] if s == 200 else p)
s, cur = call("GET", f"/live-class/current?offering_id={OFFERING}")
check("current session is 13", s == 200 and cur["session_number"] == 13)
sid = cur["session_id"]
s, a = call("GET", f"/live-class/{sid}/attention-model?use_poll=false")
check("attention dip ~20 min (applied core, 9 AM)", s == 200 and 19 <= a["dip_trigger_minute"] <= 21, a.get("dip_trigger_minute") if s == 200 else a)
check("strata dips ordered heavy < applied < studio", s == 200 and a["strata_curves"][0]["dip_minute"] < a["strata_curves"][2]["dip_minute"] < a["strata_curves"][4]["dip_minute"])
s, t = call("POST", f"/live-class/{sid}/transcript", {"text": "noise", "confidence": 0.5})
check("low-confidence ASR triggers fallback", s == 200 and t["fallback_required"] is True)
s, act = call("POST", f"/live-class/{sid}/trigger-activity", {"chunk_id": "50000000-0000-0000-0001-000000000103", "use_ai": False})
check("10 isomorphic activity sets", s == 200 and len(act["question_sets"]) == 10 and act["question_sets"][0] != act["question_sets"][1])

# Agent 2: OCR + assessment
s, o = call("POST", "/ocr/evaluate-sheet", {"sample_case": "aarav_ia1"})
check("OCR flags Q2b (<95% confidence)", s == 200 and [f["q"] for f in o["hitl_flags"]] == ["Q2b"])
eid = o["evaluation"]["eval_id"] if s == 200 else None
s, o = call("POST", "/ocr/evaluate-sheet", {"sample_case": "total_mismatch"})
check("OCR catches total mismatch", s == 200 and any(f["q"] == "TOTAL" for f in o["hitl_flags"]))
s, _ = call("POST", f"/ocr/{eid}/approve-and-sync", {}, user=AARAV)
check("student cannot approve marks (RBAC 403)", s == 403, str(s))
s, ap = call("POST", f"/ocr/{eid}/approve-and-sync", {"corrections": {"Q2b": 4}}, user=DARSHAN)
check("faculty approves + syncs", s == 200 and ap["spreadsheet_sync"]["row"]["Total"] == 21)
s, cp = call("GET", f"/assessments/co-po-mapping/{OFFERING}")
check("CO-PO matrix for CO1-CO4", s == 200 and [m["co"] for m in cp["mapping"]] == ["CO1", "CO2", "CO3", "CO4"])
s, q = call("POST", "/assessments/compile", {"offering_id": OFFERING, "timeline": "BIWEEKLY"})
check("biweekly quiz compiles", s == 200 and q["questions"])
s, m = call("POST", f"/assessments/mock-test/{OFFERING}")
check("IQAC mock test covers CO1-CO4", s == 200 and set(m["co_split"]) == {"CO1", "CO2", "CO3", "CO4"})

# Agent 3: knowledge graph + PYQ
s, kg = call("GET", f"/knowledge-graph/{AARAV}")
scores = sorted(b["similarity_score"] for b in kg["bridges"]) if s == 200 else []
check("two cross-subject bridges (0.89, 0.91)", scores == [0.89, 0.91], str(scores))
check("weak topics flagged", s == 200 and len(kg["weak_chunk_ids"]) == 2)
s, pyq = call("GET", "/pyq/search")
check("PYQ filter: 7 valid, 3 blocked", s == 200 and pyq["counts"] == {"valid": 7, "filtered_out": 3}, str(pyq.get("counts") if s == 200 else pyq))
s, dg = call("GET", f"/students/{AARAV}/diagnostics")
check("remediation route for weak topics", s == 200 and dg["weak_topics"] == 2)

# Agent 4: co-pilot
s, tasks = call("GET", f"/copilot/tasks?faculty_id={DARSHAN}")
check("4 drafted co-pilot tasks", s == 200 and len(tasks) == 4)
recal = next(t for t in tasks if t["tool_call_name"] == "recalibrate_pacing_calendar")
s, r = call("POST", f"/copilot/tasks/{recal['task_id']}/approve", {}, user=DARSHAN)
check("approve recalibration executes", s == 200 and r["status"] == "APPROVED_EXECUTED" and r["execution_result"]["finishes_before_lwd"])
s, sc = call("POST", f"/copilot/tasks/scan?faculty_id={DARSHAN}")
check("scan drafts new tasks with ids", s == 200 and all("task_id" in t for t in sc["created"]))
s, cur2 = call("GET", f"/live-class/current?offering_id={OFFERING}")
check("session ids stable after recalibration", s == 200 and cur2["session_id"] == sid)
s, logs = call("GET", "/audit-logs", user=ADMIN)
check("audit log records approvals", s == 200 and any(l["action_type"] == "APPROVE_COPILOT_TASK" for l in logs))

call("POST", "/seed-demo")
print(f"\n{'ALL PASSED' if not failures else f'{len(failures)} FAILED: ' + ', '.join(failures)}  ({API})")
sys.exit(1 if failures else 0)
