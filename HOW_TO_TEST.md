# How to test CampusAI (10 minutes, no setup)

Open **https://campusai-tau.vercel.app**. The first page load can take up to a minute while the server wakes up.

You need two browser windows: one for the teacher, one for the student. Use a normal window and a private/incognito window, because both share sign-in otherwise.

## 1. Teacher: upload a syllabus

1. Window 1: on the login page click **Teacher** (Prof. Test Teacher).
2. Click **Upload syllabus**. Don't have one? Click **CS310 sample (PDF)** to download ours, then drop it in.
3. Keep Sections **A, B, C** selected and click **Read syllabus and plan the semester**. Wait about 30 seconds.
4. You see what the AI found (units, topics, course outcomes), the three sections, and links to other courses.
5. Click **Open the semester plan**: every class up to the last working day, per section. Switch between Section A/B/C. The attention strip shows when focus dips for that time slot.

## 2. Teacher: run today's class

1. Click **Open** on Session 1 (today).
2. Click **Create lesson plan with AI**: a minute-by-minute plan with poll questions.
3. Click **Start class**. A 4-digit **attendance code** appears.

## 3. Student: check in

1. Window 2 (incognito): click **Student** (Test Student, Section A).
2. A **Class is live** card is at the top. Type the code from the teacher's screen.
3. Back in the teacher window, the class list shows the student as present within a few seconds.

## 4. Activity break

1. Teacher: under **Activity break** pick Mentimeter (or Kahoot / In-app) and click **Launch activity**. The AI writes 10 versions of the question.
2. Use **Copy all sets** or **Kahoot sheet** to paste into Mentimeter or Kahoot.
3. Student: their own version of the question appears on their screen ("set X of 10").

## 5. End class and notes

1. Teacher: **End class**, tick the topics you covered, optionally type or record a few lines, then **End class and share notes**.
2. Student: **Class notes** shows the AI-written notes for that class.

## 6. Student knowledge graph

Student: **Knowledge graph**. The student's courses (CS310 you just uploaded, CS304 and DES201) are columns; gold cards show where two subjects teach the same idea. Click any topic for notes, flashcards and a quick quiz.

## Other accounts on the login page

- **Faculty (CS304)**: a course already halfway through the semester, with pacing, attention lab and marks.
- **IQAC admin**: compliance dashboard, CO-PO matrix and audit log.

## Reset

Data is shared by everyone testing. To start clean: `POST https://campusai-backend-ak60.onrender.com/api/v1/seed-demo` (this also removes uploaded courses).

## Automated checks

```bash
API=https://campusai-backend-ak60.onrender.com/api/v1 python backend/tests/flow_test.py
API=https://campusai-backend-ak60.onrender.com/api/v1 python backend/tests/smoke_test.py
```
