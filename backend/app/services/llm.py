"""Gemini (Google AI) integration. Every call is closed-world: the model only sees approved syllabus chunks,
transcripts, or the uploaded sheet/audio, and is told never to add outside facts.
Every helper returns None on failure so callers fall back to the deterministic engines."""
import base64
import json
import logging
import os

import httpx

from app.core import config  # noqa: F401  (loads backend/.env)

log = logging.getLogger("campusai.llm")

API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY", "")
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

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
    try:
        r = httpx.post(URL, params={"key": API_KEY}, json=body, timeout=timeout)
        r.raise_for_status()
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        log.warning("gemini call failed: %s", e)
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
    prompt = (f"Write concise Markdown lecture notes for Session {session_number} ({date}). Structure: '# Session N Notes', one '##' "
              "section per syllabus chunk with key ideas as bullets, a worked example only if the chunk text supports one, a "
              "'## Key terms' list, and a '## Check your understanding' list of 3 questions. Cover only what the transcript shows "
              "was taught; if no transcript is given, use the chunks." + (f" The teacher confirmed coverage manually at: {checkpoint}." if checkpoint else "")
              + f"\n\nAPPROVED SYLLABUS CHUNKS:\n{_chunk_block(chunks)}\n\nLECTURE TRANSCRIPT:\n{(transcript or '(none)')[:6000]}")
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
