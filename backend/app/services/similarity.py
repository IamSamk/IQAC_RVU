"""Closed-world lexical similarity: TF-IDF cosine computed ONLY over the supplied syllabus chunks.
No external corpus, no web data. Keywords are double-weighted because they are curated by the Course Lead."""
import math
import re
from collections import Counter

STOP = set("""a an and are as at be by for from how in into is it its of on or the this that to with using via
their than then these those which while what when where why will can each both all any our your vs""".split())

SYNONYMS = {"f-number": "f-stop", "fstop": "f-stop", "colour": "color", "quantisation": "quantization",
            "defocus": "blur", "noises": "noise", "iso": "iso", "apertures": "aperture"}


def tokens(text: str) -> list[str]:
    out = []
    for w in re.findall(r"[a-zA-Z][a-zA-Z\-]+", text.lower()):
        w = SYNONYMS.get(w, w)
        if w not in STOP and len(w) > 2:
            out.append(w[:-1] if w.endswith("s") and len(w) > 4 else w)
    return out


def chunk_doc(chunk: dict) -> list[str]:
    kw = " ".join(chunk.get("canonical_keywords") or [])
    return tokens(f"{chunk.get('topic_title', '')} {chunk.get('syllabus_content', '')} {kw} {kw}")


class TfIdf:
    def __init__(self, docs: list[list[str]]):
        n = len(docs)
        df = Counter(t for d in docs for t in set(d))
        self.idf = {t: math.log((1 + n) / (1 + c)) + 1 for t, c in df.items()}
        self.vecs = [self.vec(d) for d in docs]

    def vec(self, doc: list[str]) -> dict:
        tf = Counter(doc)
        v = {t: c * self.idf.get(t, 1.0) for t, c in tf.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {t: x / norm for t, x in v.items()}

    @staticmethod
    def cos(a: dict, b: dict) -> float:
        if len(a) > len(b):
            a, b = b, a
        return sum(x * b.get(t, 0.0) for t, x in a.items())


def shared_concepts(a: dict, b: dict) -> list[str]:
    ka = {k.lower() for k in (a.get("canonical_keywords") or [])}
    kb = {k.lower() for k in (b.get("canonical_keywords") or [])}
    return sorted(ka & kb)


def cross_course_pairs(chunks: list[dict], threshold: float = 0.3) -> list[dict]:
    """All cross-course chunk pairs above threshold, ranked."""
    model = TfIdf([chunk_doc(c) for c in chunks])
    out = []
    for i, a in enumerate(chunks):
        for j in range(i + 1, len(chunks)):
            b = chunks[j]
            if a["course_id"] == b["course_id"]:
                continue
            s = TfIdf.cos(model.vecs[i], model.vecs[j])
            if s >= threshold:
                out.append({"a": a, "b": b, "score": round(s, 3), "shared": shared_concepts(a, b)})
    return sorted(out, key=lambda x: -x["score"])


def best_match(text: str, chunks: list[dict]) -> tuple[dict | None, float]:
    docs = [chunk_doc(c) for c in chunks]
    model = TfIdf(docs + [tokens(text)])
    q = model.vecs[-1]
    best, score = None, 0.0
    for c, v in zip(chunks, model.vecs[:-1]):
        s = TfIdf.cos(q, v)
        if s > score:
            best, score = c, s
    return best, round(score, 3)
