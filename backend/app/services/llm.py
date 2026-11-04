"""Gemini (Google AI) integration. Every call is closed-world: the model only sees approved syllabus chunks,
transcripts, or the uploaded sheet/audio, and is told never to add outside facts.
Every helper returns None on failure so callers fall back to the deterministic engines."""
import base64
import json
import logging
import os
import time

import httpx

from app.core import config  # noqa: F401  (loads backend/.env)

log = logging.getLogger("campusai.llm")

API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY", "")
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
# Tried in order when a model is rate-limited or overloaded; each has its own free-tier quota.
FALLBACK_MODELS = [m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-2.5-flash,gemini-flash-latest,gemini-flash-lite-latest").split(",") if m.strip()]
BASE = "https://generativelanguage.googleapis.com/v1beta/models"

GROUNDING = ("You are CampusAI, an academic assistant for RV University. Use ONLY the material provided in this prompt "
             "(approved syllabus chunks, lecture transcript, or the attached file). Never add facts, examples, names or "
             "references that are not supported by that material.")


def enabled() -> bool:
    return bool(API_KEY)


def _call(parts: list[dict], json_mode: bool, timeout: float = 60.0) -> str | None:
    if not API_KEY:
        return None
    body = {
        "systemInstruction": {"parts": [{"text": GROUNDING}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"temperature": 0.4, "thinkingConfig": {"thinkingBudget": 0},
                             **({"responseMimeType": "application/json"} if json_mode else {})},
    }
    # The key goes in a header, never the URL, so it can't leak into logs or error messages.
    headers = {"x-goog-api-key": API_KEY}
    attempts = [(MODEL, 0), (MODEL, 6)] + [(m, 0) for m in FALLBACK_MODELS if m != MODEL]
    for model, wait in attempts:
        if wait:
            time.sleep(wait)
        payload = body
        for _ in range(2):
            try:
                r = httpx.post(f"{BASE}/{model}:generateContent", headers=headers, json=payload, timeout=timeout)
            except httpx.HTTPError as e:
                log.warning("gemini %s request error: %s", model, type(e).__name__)
                r = None
                break
            if r.status_code == 400 and "thinkingConfig" in payload["generationConfig"]:
                # Some models reject a zero thinking budget; retry with their default.
                payload = {**body, "generationConfig": {k: v for k, v in body["generationConfig"].items() if k != "thinkingConfig"}}
                continue
            break
        if r is None or r.status_code in (404, 429, 500, 503):
            if r is not None:
                log.warning("gemini %s unavailable (HTTP %s), trying next", model, r.status_code)
            continue
        if r.status_code != 200:
            log.warning("gemini %s failed (HTTP %s)", model, r.status_code)
            continue
        try:
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, ValueError):
            log.warning("gemini %s returned no text", model)
            continue
    return None


def text(prompt: str, timeout: float = 60.0) -> str | None:
    return _call([{"text": prompt}], json_mode=False, timeout=timeout)


def json_call(prompt: str, attachment: tuple[bytes, str] | None = None, timeout: float = 90.0):
    parts = [{"text": prompt}]
    if attachment:
        data, mime = attachment
        parts.insert(0, {"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode()}})
    out = _call(parts, json_mode=True, timeout=timeout)
    if out is None:
        return None
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        log.warning("gemini returned non-JSON")
        return None


def _chunk_block(chunks: list[dict]) -> str:
    return "\n\n".join(f"[CHUNK {c['chunk_id']}] {c['topic_title']} ({c.get('slide_range')}, {c.get('co_mapping')}, Bloom {c.get('bloom_level')})\n"
                       f"{c['syllabus_content']}\nKeywords: {', '.join(c.get('canonical_keywords') or [])}" for c in chunks)


# ---------------------------------------------------------------- agent helpers
def ocr_marksheet(image: bytes, mime: str) -> dict | None:
    prompt = ("This is a scanned exam answer-booklet mark grid. Extract the student USN, each question's awarded marks and maximum "
              "marks (question ids like Q1a, Q1b, Q2a, Q2b, Q3a, Q3b), and the handwritten total. For every cell give your own "
              "confidence 0-1 in the reading (lower it for smudged or ambiguous digits). Return JSON: "
              '{"student_usn": str, "written_total": int|null, "cells": [{"q": str, "marks": int, "max": int, "conf": float}]}')
    data = json_call(prompt, (image, mime))
    if not data or not data.get("cells"):
        return None
    return data


def transcribe(audio: bytes, mime: str) -> dict | None:
    prompt = ("Transcribe this classroom lecture audio verbatim in English. Estimate your overall transcription confidence 0-1 "
              "(lower it for noise, dropouts or inaudible parts) and the speaking rate in words per minute. Return JSON: "
              '{"text": str, "confidence": float, "words_per_minute": float}')
    return json_call(prompt, (audio, mime), timeout=120)


def class_notes(session_number: int, date: str, chunks: list[dict], transcript: str | None, checkpoint: str | None) -> str | None:
    prompt = (f"Write study notes a student can revise from for Session {session_number} ({date}). Markdown structure:\n"
              "'# Session N: <short title>'; a 2-sentence '**In short**' summary; then one '##' section per topic with "
              "2-4 short paragraphs that explain each idea clearly in plain language (use the syllabus wording, define every term), "
              "a '**Worked example**' only when the topic is numeric or procedural and the syllabus supports it, and a "
              "'> Remember' one-line callout; then '## Key terms' as a bulleted glossary (term: one-line meaning); then "
              "'## Check yourself' with 3 numbered questions and their answers in italics. If the transcript mentions an "
              "example or analogy the teacher used, include it. Only cover topics the teacher reports finishing."
              + (f" The teacher confirmed coverage manually at: {checkpoint}." if checkpoint else "")
              + f"\n\nAPPROVED SYLLABUS CHUNKS:\n{_chunk_block(chunks)}\n\nLECTURE TRANSCRIPT / TEACHER SUMMARY:\n{(transcript or '(none)')[:6000]}")
    return text(prompt)


def isomorphic_sets(chunk: dict, n_sets: int = 10, per_set: int = 3) -> list[dict] | None:
    prompt = (f"Create {n_sets} isomorphic question sets for an in-class activity so adjacent students get different but equivalent "
              f"questions on the SAME learning goal. Each set has {per_set} questions of matching difficulty and type across sets "
              "(change numbers, scenarios and wording, not the concept). Mix one numeric/applied question and MCQs with 4 options. "
              "Use only the chunk below.\n\n" + _chunk_block([chunk]) +
              '\n\nReturn JSON: {"sets": [{"set_number": int, "questions": [{"type": "numeric"|"mcq", "question": str, '
              '"options": [str] (mcq only), "answer": str, "explanation": str}]}]}')
    data = json_call(prompt, timeout=90)
    sets = (data or {}).get("sets")
    if not sets or len(sets) < n_sets // 2:
        return None
    return sets[:n_sets]


def bridge_example(a: dict, b: dict, shared: list[str]) -> str | None:
    prompt = ("Two syllabus chunks from different courses taken by the same student are below. In 2-3 sentences, write one applied "
              "example that connects them, using only concepts present in both chunks"
              + (f" (shared concepts: {', '.join(shared)})" if shared else "") + ". No outside facts.\n\n" + _chunk_block([a, b]))
    return text(prompt, timeout=40)


SYLLABUS_SCHEMA = (
    '{"course_title": str, "course_code": str|null, "credits": int|null, "ltp": {"l": int, "t": int, "p": int}|null, '
    '"course_outcomes": [{"co": "CO1", "statement": str}], '
    '"units": [{"unit_number": int, "title": str, "topics": [{"title": str, "content": str, "keywords": [str], '
    '"bloom_level": "UNDERSTAND"|"APPLY"|"ANALYZE"|"CREATE", "co": "CO1".."CO5", "ltp_type": "L"|"T"|"P", '
    '"estimated_minutes": int, "cognitive_complexity": float}]}]}'
)


def parse_syllabus(text_content: str | None = None, pdf: bytes | None = None) -> dict | None:
    """Turn an uploaded syllabus into units -> teachable topics. Uses only the document's own wording."""
    prompt = ("Read this university course syllabus and structure it for lesson planning. Keep the document's own unit "
              "order and wording. Split each unit into 2-5 teachable topics (one topic is roughly one 40-60 minute class). "
              "For each topic: a short title; 'content' = 1-3 sentences copied or closely paraphrased from the syllabus "
              "(never add material that is not in it); 4-7 lowercase keywords taken from the text; Bloom level; the CO it "
              "serves (map units to COs in order if the syllabus does not say); ltp_type 'P' only for lab/practical items; "
              "estimated_minutes 30-90; cognitive_complexity 0.8 (easy) to 2.0 (maths-heavy). If course outcomes are listed, "
              "copy them. Return JSON exactly in this shape: " + SYLLABUS_SCHEMA)
    if pdf is not None:
        return json_call(prompt, (pdf, "application/pdf"), timeout=150)
    return json_call(prompt + "\n\nSYLLABUS:\n" + (text_content or "")[:60000], timeout=150)


def lesson_plan(course: dict, section: str, session: dict, chunks: list[dict], persona: str | None, attention: dict,
                platform: str) -> str | None:
    splits = ", ".join(f"minute {s['start']}-{s['end']}" for s in attention.get("activity_splits", [])) or "none"
    prompt = (f"Write a practical minute-by-minute plan for teaching this {session.get('session_duration_mins', 60)}-minute class "
              f"of {course['course_code']} {course['course_title']} to section {section} (Session {session['session_number']}).\n"
              f"Teacher's style: {persona or 'balanced'}.\n"
              f"Attention model for this section's time slot predicts focus drops below 55% at minute "
              f"{attention.get('dip_trigger_minute')}; schedule activity breaks at: {splits}. Use {platform} for the activities.\n"
              "Markdown with: '## Goal' (one line), '## Flow' as a table | Minutes | What you do | What students do |, "
              "'## Activity break' with 2 ready-to-use poll questions (with options and answers) written for the activity "
              "platform, '## Board summary' (3-5 bullets), '## If you run short on time' (one line). Use only the topics below.\n\n"
              f"TOPICS FOR TODAY:\n{_chunk_block(chunks)}")
    return text(prompt, timeout=90)
