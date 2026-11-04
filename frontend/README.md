# CampusAI Frontend

Next.js 15 (App Router, TypeScript) portals for faculty, students, juniors and IQAC admins, connected to the FastAPI backend in [`../backend`](../backend).

## Run

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

With no configuration the app talks to the deployed backend at `https://campusai-backend-ak60.onrender.com/api/v1`. To use another one, copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL`.

Other scripts: `npm run build`, `npm run lint`, `npm run typecheck`.

## Before a live demo

The backend runs on a Render service that sleeps when idle and can take up to a minute to wake. Open the app about a minute beforehand, then check that the badge in the top bar says **Live API**. While the app stays open it pings the backend every 10 minutes to keep it awake.

The **Reset** button in the judge demo flow calls `POST /seed-demo`, which resets the shared demo database for everyone using it. Reset before a run-through, because these actions change that data:

- Recalibrate Semester Plan
- A fallback checkpoint, which also completes the current session
- Verify & Sync
- Co-Pilot approvals

## Views

| Route | Roles | Main endpoints |
| :--- | :--- | :--- |
| `/pacing` | Faculty | `GET`/`POST /pacing/{offering_id}` |
| `/live-class` | Faculty, Student | `/live-class/current`, `/live-class/{id}/attention-model`, `attention-vote`, `fallback-checkpoint`, `trigger-activity` |
| `/knowledge-graph` | Student | `/knowledge-graph/{student_id}` |
| `/pyq` | Junior | `/pyq/search` |
| `/evaluation` | Faculty, IQAC | `/ocr/evaluations`, `/ocr/evaluate-sheet/upload`, `/ocr/{id}/approve-and-sync`, `/assessments/co-attainment/{id}`, `/copilot/*` |
| `/admin` | IQAC | `/admin/compliance`, `/audit-logs` |

## How data flows

- `src/lib/adapters.ts` maps each backend response onto the UI types in `src/types`. If the API changes, this is the file to update.
- `src/lib/api.ts` sends requests with an `X-User-Id` header for the current role, one at a time and retrying failed reads, because the backend currently returns HTTP 500 to most simultaneous requests. If the backend can't be reached, rejects a request, or returns an unexpected shape, the view keeps working from `src/lib/fallback/`.
- `GET /ai/status` reports whether Gemini is enabled. Uploaded sheets are read by Gemini when it is, and the app says when a sample sheet was used instead.
- The badge in the top bar shows **Live API**, **Partly live** or **Offline demo data**, and action messages say when something was not saved.

## Simulated or sample content

These are not live, even when the backend is connected:

- **Classroom transcript and waveform:** simulated from the session's syllabus text until a presenter uses **Record from mic**, which sends the clip to the backend's Gemini transcription. A low-confidence result opens the slide checkpoint.
- **Google Sheets, Mentimeter, Kahoot and Classroom:** mock payloads.
- **CO-PO mapping:** sample data, because the API does not return one.
- **Role gating in the UI:** demonstrates the views. The backend's rank checks do the real enforcement.
