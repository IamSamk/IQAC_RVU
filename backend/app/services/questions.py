"""Polymorphic (isomorphic) question generator grounded in syllabus chunks.

Every set tests the same learning goal with different numbers / blanks, so adjacent students cannot copy.
Numeric generators exist for formula-heavy topics; every chunk also gets cloze questions built from its
own approved syllabus text (closed-world: no outside facts)."""
import math
import random
import re

from app.services.similarity import tokens


def _exposure(rng: random.Random) -> dict:
    iso1 = rng.choice([100, 200, 400])
    mult = rng.choice([2, 4, 8])
    iso2 = iso1 * mult
    den = rng.choice([30, 60, 125, 250])
    f = rng.choice([2.8, 4, 5.6, 8])
    return {"type": "numeric",
            "question": f"A camera at ISO {iso1}, 1/{den} s, f/{f} is switched to ISO {iso2} at the same aperture. What shutter time keeps the exposure constant?",
            "answer": f"1/{den * mult} s", "explanation": f"ISO x{mult} raises sensor gain by {int(math.log2(mult))} stop(s), so shutter time must shrink by {mult}x. Noise rises with the higher gain."}


def _dof(rng: random.Random) -> dict:
    f1 = rng.choice([1.8, 2.8, 4])
    f2 = rng.choice([8, 11, 16])
    return {"type": "conceptual-numeric",
            "question": f"Changing aperture from f/{f2} to f/{f1} with focus fixed: does depth of field grow or shrink, and by roughly what factor does the circle-of-confusion diameter for an out-of-focus point change?",
            "answer": f"Shrinks; blur circle grows ~{round(f2 / f1, 1)}x", "explanation": "Blur-circle diameter scales with aperture diameter, which is focal length / f-number."}


def _conv(rng: random.Random) -> dict:
    patch = [[rng.randint(0, 9) for _ in range(3)] for _ in range(3)]
    val = round(sum(sum(r) for r in patch) / 9, 2)
    return {"type": "numeric", "question": f"Apply a 3x3 box (mean) filter to the patch {patch}. What is the output at the centre pixel?",
            "answer": str(val), "explanation": "Mean filter = sum of 9 values / 9."}


def _sobel(rng: random.Random) -> dict:
    patch = [[rng.randint(0, 9) for _ in range(3)] for _ in range(3)]
    kx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
    gx = sum(kx[i][j] * patch[i][j] for i in range(3) for j in range(3))
    return {"type": "numeric", "question": f"Compute the Sobel Gx response at the centre of {patch} with kernel [[-1,0,1],[-2,0,2],[-1,0,1]].",
            "answer": str(gx), "explanation": "Element-wise multiply and sum."}


def _harris(rng: random.Random) -> dict:
    l1 = round(rng.uniform(0.05, 9), 2)
    l2 = round(rng.uniform(0.05, 9), 2)
    k = 0.05
    r = l1 * l2 - k * (l1 + l2) ** 2
    label = "corner" if r > 1 else ("edge" if r < 0 else "flat")
    return {"type": "numeric", "question": f"Structure-tensor eigenvalues are {l1} and {l2}. With k = 0.05, compute the Harris response R and classify the point.",
            "answer": f"R = {round(r, 2)} -> {label}", "explanation": "R = l1*l2 - k(l1+l2)^2; large positive = corner, negative = edge, small = flat."}


NUMERIC = [
    (("exposure", "iso", "shutter speed"), _exposure),
    (("depth of field", "circle of confusion", "aperture"), _dof),
    (("convolution", "gaussian"), _conv),
    (("sobel", "gradient", "edge detection"), _sobel),
    (("harris", "structure tensor"), _harris),
]


def _numeric_for(chunk: dict):
    kws = {k.lower() for k in chunk.get("canonical_keywords") or []}
    for keys, fn in NUMERIC:
        if kws & set(keys):
            return fn
    return None


def _cloze(chunk: dict, rng: random.Random, pool: list[str], offset: int) -> dict | None:
    kws = [k for k in (chunk.get("canonical_keywords") or []) if k.lower() in chunk["syllabus_content"].lower()]
    if not kws:
        return None
    kw = kws[offset % len(kws)]
    sentence = re.sub(re.escape(kw), "_____", chunk["syllabus_content"], count=1, flags=re.I)
    distractors = [p for p in pool if p.lower() != kw.lower() and p.lower() not in chunk["syllabus_content"].lower()]
    rng.shuffle(distractors)
    options = distractors[:3] + [kw]
    rng.shuffle(options)
    return {"type": "mcq-cloze", "question": f"Fill in the blank (from the approved syllabus): {sentence}",
            "options": options, "answer": kw, "explanation": f"Source: {chunk['topic_title']} ({chunk.get('slide_range')})."}


def generate_sets(chunk: dict, course_chunks: list[dict], n_sets: int = 10, per_set: int = 3, seed: int = 7) -> list[dict]:
    pool = sorted({k for c in course_chunks for k in (c.get("canonical_keywords") or [])})
    numeric = _numeric_for(chunk)
    sets = []
    for i in range(n_sets):
        rng = random.Random(seed * 100 + i)
        qs = []
        if numeric:
            qs.append(numeric(rng))
        k = 0
        while len(qs) < per_set and k < per_set * 3:
            q = _cloze(chunk, rng, pool, i + k)
            k += 1
            if q and all(q["question"] != x["question"] for x in qs):
                qs.append(q)
        sets.append({"set_number": i + 1, "questions": qs})
    return sets


def flashcards(chunk: dict, n: int = 4) -> list[dict]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", chunk["syllabus_content"]) if s.strip()]
    cards = []
    for kw in (chunk.get("canonical_keywords") or [])[:n]:
        src = next((s for s in sentences if kw.lower() in s.lower()), sentences[0] if sentences else "")
        cards.append({"front": kw.title(), "back": src, "chunk_id": chunk["chunk_id"]})
    return cards


def quick_quiz(chunk: dict, course_chunks: list[dict]) -> list[dict]:
    return generate_sets(chunk, course_chunks, n_sets=1, per_set=3, seed=13)[0]["questions"]


def keyword_overlap(a: str, b: str) -> float:
    ta, tb = set(tokens(a)), set(tokens(b))
    return len(ta & tb) / max(1, len(ta | tb))
