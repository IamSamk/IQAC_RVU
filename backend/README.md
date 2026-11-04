# CampusAI Backend (Person 1)

FastAPI + Supabase (Postgres, pgvector, Realtime). Four agents:

1. **Pacing & Attention** – L:T:P semester calendar from the teacher persona prompt, IUCEE/Stuart-Rutherford/Bunce attention-decay model, 1-tap slide fallback, 10-set polymorphic activities, self-healing recalibration.
2. **OCR & Assessment** – question-wise mark extraction, confidence < 0.95 → HITL, sum check, spreadsheet sync (mock), CO attainment, quiz / IQAC mock-test compiler.
3. **Knowledge Graph & PYQ** – closed-world cross-subject bridges (TF-IDF over enrolled syllabus chunks only), syllabus-diffed PYQ filter (sim ≥ 0.85), diagnostic routing.
4. **Faculty Co-Pilot** – pre-executed tool-call drafts awaiting 1-click approval, episodic memory, audit log.

## Run locally

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # Windows (use .venv/bin on macOS/Linux)
cp .env.example .env                              # fill SUPABASE_URL + SUPABASE_KEY
.venv/Scripts/python -m uvicorn main:app --port 8000
```

Docs: http://localhost:8000/docs · Reset demo data: `POST /api/v1/seed-demo` (~6 s).

## Database

Supabase project **CampusAI** (`pxptxkmbwtrafukfzmns`, ap-south-1). Migrations in [`../supabase/migrations`](../supabase/migrations):
`001` schema, `002` PYQ mapping columns + indexes + RLS + Realtime, `003` `seed_demo()` function.

Realtime is on for `attention_telemetry_votes`, `session_plans`, `faculty_copilot_tasks`, `ocr_exam_evaluations`.

> **Demo-mode RLS:** every table has a permissive `demo_all` policy so the publishable key works from the browser and the backend. Replace with role-scoped policies + the service-role key before real use.

## RBAC

Send `X-User-Id: <user_id>` from the role switcher. Mutating endpoints check the role rank (`STUDENT` 10 … `IQAC_ADMIN` 100) and return 403 when too low. Without the header requests run as an anonymous demo actor (set `RBAC_STRICT=true` to require it).

## Fixed demo IDs (stable across reseeds)

| What | ID |
|---|---|
| Dr. Veena A. (IQAC_ADMIN) | `20000000-0000-0000-0000-000000000001` |
| Prof. S. Darshan (FACULTY, CS304) | `20000000-0000-0000-0000-000000000002` |
| Prof. Veena K. (FACULTY, DES201) | `20000000-0000-0000-0000-000000000003` |
| Prof. Rao (COURSE_LEAD) | `20000000-0000-0000-0000-000000000004` |
| Aarav Sharma (STUDENT, CS304 + DES201) | `20000000-0000-0000-0000-000000000005` |
| Riya Patel (STUDENT, junior) | `20000000-0000-0000-0000-000000000006` |
| Course CS304 / DES201 / CS204-2024 | `30000000-0000-0000-0000-00000000000{1,2,3}` |
| Offering CS304-A / DES201-A | `40000000-0000-0000-0000-00000000000{1,2}` |
| Aarav IA-1 OCR sheet | `80000000-0000-0000-0000-000000000001` |
| Syllabus chunk | `50000000-0000-0000-000<course>-000000000<unit><seq>` e.g. CS304 U1C2 = `...0001-000000000102` |

Demo state after seeding: CS304 sessions 1-12 completed (session 12 ran 15 min behind on Harris/SIFT), session 13 is the live class. Get its id from `GET /live-class/current`.

## Endpoints (`/api/v1`)

| Endpoint | Method | Tab |
|---|---|---|
| `/seed-demo` | POST | Demo reset |
| `/users`, `/users/{id}`, `/me`, `/roles`, `/courses`, `/courses/{id}/chunks` | GET | Role switcher / ERP |
| `/users/{id}/persona` | PATCH | Persona studio |
| `/admin/compliance`, `/audit-logs` | GET | IQAC admin |
| `/pacing/{offering_id}` | GET / POST | Tab 1 – POST `{pedagogical_system_prompt, persona_parameters}` recalibrates |
| `/live-class/current?offering_id=` | GET | Tab 2 |
| `/live-class/{session_id}/attention-model` | GET | Tab 2 – `t`, `passive_curve`, `active_intervened_curve`, `strata_curves`, `dip_trigger_minute`, `activity_splits` (`?use_poll=false`, `?words_per_minute=`) |
| `/live-class/{session_id}/attention-vote` | POST | Tab 2 student poll (1-9 scale) |
| `/live-class/{session_id}/transcript` | POST | Tab 2 – confidence < 0.75 returns `fallback_required: true` |
| `/live-class/{session_id}/fallback-checkpoint` | POST | Tab 2 modal – `{slide_number, chunk_id?}` |
| `/live-class/{session_id}/trigger-activity` | POST | Tab 2 – `{delivery_platform: MENTIMETER\|KAHOOT\|GOOGLE_CLASSROOM\|IN_APP_10_SETS}` |
| `/live-class/{session_id}/end-session` | POST | Tab 2 – notes + recalibration |
| `/knowledge-graph/{student_id}` | GET | Tab 3 – nodes (with drawer: notes, example, flashcards, quiz), edges, bridges, weak ids |
| `/knowledge-graph/{student_id}/rebuild` | POST | Tab 3 – recompute bridges from syllabus text |
| `/students/{student_id}/diagnostics` | GET | Tab 3 remediation |
| `/pyq/search?course_id=` | GET | Tab 4 – `valid[]`, `filtered_out[]`, `syllabus_overlap` |
| `/ocr/evaluate-sheet` | POST | Tab 5 – `{sample_case: "aarav_ia1"}` or `{student_usn, cells[]}` |
| `/ocr/evaluate-sheet/upload` | POST | Tab 5 – multipart image |
| `/ocr/evaluations?offering_id=` | GET | Tab 5 grid |
| `/ocr/{eval_id}/approve-and-sync` | POST | Tab 5 – `{corrections: {"Q2b": 4}}` → sheet row + CO attainment |
| `/assessments/co-attainment/{offering_id}` | GET | Tab 5 chart |
| `/assessments/compile`, `/assessments/mock-test/{offering_id}` | POST | Quizzes / IQAC mock test |
| `/copilot/tasks?faculty_id=` | GET | Tab 5 drawer |
| `/copilot/tasks/scan?faculty_id=` | POST | Agent drafts new due tasks |
| `/copilot/tasks/{task_id}/approve` | POST | 1-click approve (`{edited_payload}` optional) |
| `/copilot/memory/{user_id}` | GET | Episodic memory viewer |

## Not wired yet

- Real OCR / vision and Whisper ASR: the upload endpoints accept files but use the sample cases / slide fallback.
- Google Sheets, Classroom, Mentimeter, Kahoot calls are mock payloads.
- `embedding vector(1536)` columns are unused; similarity is TF-IDF over syllabus text.

## Testing

```bash
# from the repo root; resets the shared demo data before and after
API=http://localhost:8000/api/v1 backend/.venv/Scripts/python backend/tests/smoke_test.py
API=https://campusai-backend-ak60.onrender.com/api/v1 python backend/tests/smoke_test.py
```

23 end-to-end checks across all four agents, RBAC (a student gets 403 on mark approval) and the audit log. Exits non-zero on any failure.
