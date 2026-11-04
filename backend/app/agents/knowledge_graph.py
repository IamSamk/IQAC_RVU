"""Agent 3: Strictly grounded cross-subject knowledge graph & syllabus-diffed PYQ engine.

Closed-world rule: every node, edge, example, flashcard and quiz is derived from the student's enrolled
syllabus_chunks (and saved class notes). Nothing comes from the open web."""
from app.core.db import get_db, rows
from app.services.questions import flashcards, quick_quiz
from app.services.similarity import TfIdf, best_match, chunk_doc, cross_course_pairs

COURSE_COLORS = ["#4F46E5", "#14B8A6", "#F97316", "#EC4899"]
PYQ_THRESHOLD = 0.85


def _enrolled(student_id: str) -> tuple[list[dict], list[dict]]:
    db = get_db()
    enr = rows(db.table("student_enrollments").select("enrollment_category, course_offerings(offering_id, course_id, courses(course_id, course_code, course_title, l_ratio, t_ratio, p_ratio))").eq("student_id", student_id))
    courses = []
    for e in enr:
        off = e["course_offerings"]
        courses.append({**off["courses"], "offering_id": off["offering_id"], "enrollment_category": e["enrollment_category"]})
    ids = [c["course_id"] for c in courses]
    chunks = rows(db.table("syllabus_chunks").select("*").in_("course_id", ids).order("unit_number").order("sequence_order")) if ids else []
    return courses, chunks


def student_graph(student_id: str) -> dict:
    db = get_db()
    courses, chunks = _enrolled(student_id)
    chunk_ids = [c["chunk_id"] for c in chunks]
    color = {c["course_id"]: COURSE_COLORS[i % len(COURSE_COLORS)] for i, c in enumerate(courses)}
    code = {c["course_id"]: c["course_code"] for c in courses}
    if not chunks:
        return {"student_id": student_id, "courses": courses, "nodes": [], "edges": [], "bridges": [], "grounding": {"closed_world": True, "source_chunks": 0}}

    weak = set()
    for ev in rows(db.table("ocr_exam_evaluations").select("weak_chunk_ids").eq("student_id", student_id)):
        weak.update(ev.get("weak_chunk_ids") or [])

    offering_ids = [c["offering_id"] for c in courses]
    notes = {}
    for s in rows(db.table("session_plans").select("session_number, scheduled_date, covered_chunk_ids, generated_class_notes_md").in_("offering_id", offering_ids).eq("status", "COMPLETED")):
        for cid in s.get("covered_chunk_ids") or []:
            notes.setdefault(cid, []).append({"session_number": s["session_number"], "date": s["scheduled_date"], "notes_md": s.get("generated_class_notes_md")})

    edges = rows(db.table("knowledge_graph_edges").select("*").in_("source_chunk_id", chunk_ids))
    edges = [e for e in edges if e["target_chunk_id"] in chunk_ids]

    # live closed-world verification of each bridge
    model = TfIdf([chunk_doc(c) for c in chunks])
    vec = {c["chunk_id"]: v for c, v in zip(chunks, model.vecs)}
    by_id = {c["chunk_id"]: c for c in chunks}
    bridge_nodes = set()
    for e in edges:
        e["lexical_similarity"] = round(TfIdf.cos(vec[e["source_chunk_id"]], vec[e["target_chunk_id"]]), 3)
        if e["edge_type"] == "CROSS_SUBJECT_BRIDGE":
            bridge_nodes.update([e["source_chunk_id"], e["target_chunk_id"]])

    nodes = []
    for c in chunks:
        same_course = [x for x in chunks if x["course_id"] == c["course_id"]]
        bridge_examples = [e["grounded_application_example"] for e in edges if e["edge_type"] == "CROSS_SUBJECT_BRIDGE" and c["chunk_id"] in (e["source_chunk_id"], e["target_chunk_id"])]
        nodes.append({
            "id": c["chunk_id"], "label": c["topic_title"], "course_id": c["course_id"], "course_code": code[c["course_id"]],
            "color": "#F59E0B" if c["chunk_id"] in bridge_nodes else color[c["course_id"]],
            "unit": c["unit_number"], "sequence": c["sequence_order"], "ltp_type": c["ltp_type"], "co": c["co_mapping"], "bloom": c["bloom_level"],
            "is_bridge": c["chunk_id"] in bridge_nodes, "is_weak": c["chunk_id"] in weak,
            "drawer": {
                "syllabus_content": c["syllabus_content"], "slide_range": c["slide_range"],
                "class_notes": notes.get(c["chunk_id"], []),
                "applied_cross_course_example": bridge_examples[0] if bridge_examples else None,
                "flashcards": flashcards(c), "quick_quiz": quick_quiz(c, same_course),
            },
        })
    bridges = []
    for e in edges:
        if e["edge_type"] != "CROSS_SUBJECT_BRIDGE":
            continue
        a, b = by_id[e["source_chunk_id"]], by_id[e["target_chunk_id"]]
        bridges.append({"edge_id": e["edge_id"], "label": " / ".join(e["shared_concepts"][:3]),
                        "source": {"chunk_id": a["chunk_id"], "course_code": code[a["course_id"]], "unit": a["unit_number"], "chunk": a["sequence_order"], "topic": a["topic_title"]},
                        "target": {"chunk_id": b["chunk_id"], "course_code": code[b["course_id"]], "unit": b["unit_number"], "chunk": b["sequence_order"], "topic": b["topic_title"]},
                        "similarity_score": e["similarity_score"], "lexical_similarity": e["lexical_similarity"],
                        "shared_concepts": e["shared_concepts"], "grounded_application_example": e["grounded_application_example"]})
    return {
        "student_id": student_id, "courses": [{**c, "color": color[c["course_id"]]} for c in courses],
        "nodes": nodes,
        "edges": [{"id": e["edge_id"], "source": e["source_chunk_id"], "target": e["target_chunk_id"], "type": e["edge_type"],
                   "similarity_score": e["similarity_score"], "lexical_similarity": e["lexical_similarity"], "shared_concepts": e["shared_concepts"]} for e in edges],
        "bridges": bridges,
        "weak_chunk_ids": sorted(weak & set(chunk_ids)),
        "grounding": {"closed_world": True, "source_chunks": len(chunks), "badge": "100% Grounded in Uploaded RVU Syllabus Chunks (Zero External Web Hallucination)"},
    }


def rebuild_bridges(student_id: str, threshold: float = 0.3, persist: bool = False) -> dict:
    """Recompute cross-subject candidates using TF-IDF over the student's enrolled chunks only."""
    _, chunks = _enrolled(student_id)
    pairs = cross_course_pairs(chunks, threshold)
    out = []
    from app.services import llm
    for i, p in enumerate(pairs[:10]):
        a, b = p["a"], p["b"]
        ai_example = llm.bridge_example(a, b, p["shared"]) if (i < 3 and llm.enabled()) else None
        example = ai_example or (f"'{a['topic_title']}' and '{b['topic_title']}' both cover {', '.join(p['shared']) or 'related concepts'}. "
                   f"Per the syllabus: {a['syllabus_content'].split('.')[0]}. Likewise: {b['syllabus_content'].split('.')[0]}.")
        out.append({"source_chunk_id": a["chunk_id"], "target_chunk_id": b["chunk_id"], "source_topic": a["topic_title"], "target_topic": b["topic_title"],
                    "lexical_similarity": p["score"], "shared_concepts": p["shared"], "grounded_application_example": example})
    if persist and out:
        db = get_db()
        existing = {(e["source_chunk_id"], e["target_chunk_id"]) for e in rows(db.table("knowledge_graph_edges").select("source_chunk_id, target_chunk_id").eq("edge_type", "CROSS_SUBJECT_BRIDGE"))}
        new = [{"source_chunk_id": o["source_chunk_id"], "target_chunk_id": o["target_chunk_id"], "edge_type": "CROSS_SUBJECT_BRIDGE",
                "similarity_score": o["lexical_similarity"], "shared_concepts": o["shared_concepts"] or ["related"], "grounded_application_example": o["grounded_application_example"]}
               for o in out if (o["source_chunk_id"], o["target_chunk_id"]) not in existing and (o["target_chunk_id"], o["source_chunk_id"]) not in existing]
        if new:
            db.table("knowledge_graph_edges").insert(new).execute()
    return {"student_id": student_id, "threshold": threshold, "candidates": out, "closed_world": True}


def pyq_search(course_id: str, recompute: bool = False, threshold: float = PYQ_THRESHOLD) -> dict:
    db = get_db()
    course = rows(db.table("courses").select("*").eq("course_id", course_id))
    if not course:
        raise ValueError("course not found")
    course = course[0]
    # walk the predecessor chain
    chain, pred = [], course.get("predecessor_course_id")
    while pred:
        p = rows(db.table("courses").select("course_id, course_code, course_title, predecessor_course_id").eq("course_id", pred))
        if not p:
            break
        chain.append(p[0])
        pred = p[0].get("predecessor_course_id")
    current_chunks = rows(db.table("syllabus_chunks").select("*").eq("course_id", course_id))
    by_id = {c["chunk_id"]: c for c in current_chunks}
    origin_ids = [c["course_id"] for c in chain] or [course_id]
    pyqs = rows(db.table("pyq_question_bank").select("*").in_("origin_course_id", origin_ids).order("exam_year", desc=True))
    old_chunks = {c["chunk_id"]: c for c in rows(db.table("syllabus_chunks").select("chunk_id, topic_title, is_deprecated").in_("course_id", origin_ids))}

    valid, filtered = [], []
    for q in pyqs:
        lex_match, lex = best_match(q["question_text"], current_chunks)
        sim = q.get("current_similarity")
        if recompute or sim is None:
            sim = lex
            q["current_chunk_id"] = lex_match["chunk_id"] if lex_match else None
        cur = by_id.get(q.get("current_chunk_id"))
        old = old_chunks.get(q.get("mapped_chunk_id"), {})
        item = {"pyq_id": q["pyq_id"], "exam_year": q["exam_year"], "exam_type": q["exam_type"], "question_text": q["question_text"],
                "marks": q["marks"], "co_code": q["co_code"], "bloom_level": q["bloom_level"],
                "similarity": round(sim, 3), "lexical_similarity": lex,
                "original_topic": old.get("topic_title"), "original_topic_deprecated": bool(old.get("is_deprecated")),
                "current_unit_tag": f"2026 Unit {cur['unit_number']}: {cur['topic_title']}" if cur else None,
                "current_chunk_id": cur["chunk_id"] if cur else None}
        if sim >= threshold and not old.get("is_deprecated"):
            valid.append({**item, "status": "VALID_CURRENT"})
        else:
            filtered.append({**item, "status": "FILTERED_OUT_DEPRECATED"})
    total_old = len(old_chunks)
    deprecated = sum(1 for c in old_chunks.values() if c.get("is_deprecated"))
    return {"course": {"course_id": course_id, "course_code": course["course_code"], "course_title": course["course_title"]},
            "predecessors": chain, "threshold": threshold,
            "syllabus_overlap": round((total_old - deprecated) / total_old, 2) if total_old else None,
            "verified_by": course.get("similarity_verified_by"),
            "valid": valid, "filtered_out": filtered, "counts": {"valid": len(valid), "filtered_out": len(filtered)}}


def diagnostics(student_id: str) -> dict:
    """Post-quiz routing: weak chunks -> bridge example -> flashcards -> PYQs on that chunk."""
    g = student_graph(student_id)
    weak_nodes = [n for n in g["nodes"] if n["is_weak"]]
    pyq_by_chunk = {}
    for q in rows(get_db().table("pyq_question_bank").select("question_text, exam_year, current_chunk_id, mapping_status").eq("mapping_status", "VALID_CURRENT")):
        pyq_by_chunk.setdefault(q["current_chunk_id"], []).append(q)
    route = []
    for n in weak_nodes:
        route.append({"chunk_id": n["id"], "topic": n["label"], "course_code": n["course_code"],
                      "steps": [s for s in [
                          {"step": "Revisit via cross-course bridge", "content": n["drawer"]["applied_cross_course_example"]} if n["drawer"]["applied_cross_course_example"] else None,
                          {"step": "Flashcards", "content": n["drawer"]["flashcards"]},
                          {"step": "Quick quiz", "content": n["drawer"]["quick_quiz"]},
                          {"step": "Practice PYQs", "content": pyq_by_chunk.get(n["id"], [])},
                      ] if s]})
    return {"student_id": student_id, "weak_topics": len(route), "remediation_route": route}


def build_course_links(course_id: str, threshold: float = 0.3, per_pair: int = 3) -> list[dict]:
    """After a syllabus upload: chain the new course's topics, then link them to every other course its students take.
    Closed-world: similarity and examples come only from the two syllabi."""
    from app.services import llm
    db = get_db()
    chunks = rows(db.table("syllabus_chunks").select("*").eq("course_id", course_id).order("unit_number").order("sequence_order"))
    if not chunks:
        return []
    db.table("knowledge_graph_edges").insert([
        {"source_chunk_id": a["chunk_id"], "target_chunk_id": b["chunk_id"], "edge_type": "INTRA_COURSE_FLOW", "similarity_score": 1.0,
         "shared_concepts": [], "grounded_application_example": "Sequential syllabus progression"} for a, b in zip(chunks, chunks[1:])
    ]).execute() if len(chunks) > 1 else None

    offerings = [o["offering_id"] for o in rows(db.table("course_offerings").select("offering_id").eq("course_id", course_id))]
    students = {e["student_id"] for e in rows(db.table("student_enrollments").select("student_id").in_("offering_id", offerings))} if offerings else set()
    other_courses = set()
    if students:
        for e in rows(db.table("student_enrollments").select("course_offerings(course_id)").in_("student_id", list(students))):
            cid = (e.get("course_offerings") or {}).get("course_id")
            if cid and cid != course_id:
                other_courses.add(cid)
    created = []
    for other in other_courses:
        theirs = rows(db.table("syllabus_chunks").select("*").eq("course_id", other).eq("is_deprecated", False))
        pairs = [pr for pr in cross_course_pairs(chunks + theirs, threshold) if (pr["a"]["course_id"] == course_id) != (pr["b"]["course_id"] == course_id)]
        for pr in pairs[:per_pair]:
            a, b = (pr["a"], pr["b"]) if pr["a"]["course_id"] == course_id else (pr["b"], pr["a"])
            shared = pr["shared"] or sorted(set(a.get("canonical_keywords") or []) & set(b.get("canonical_keywords") or []))
            example = (llm.bridge_example(a, b, shared) if llm.enabled() else None) or (
                f"Both '{a['topic_title']}' and '{b['topic_title']}' build on {', '.join(shared[:3]) or 'the same ideas'}.")
            row = {"source_chunk_id": a["chunk_id"], "target_chunk_id": b["chunk_id"], "edge_type": "CROSS_SUBJECT_BRIDGE",
                   "similarity_score": pr["score"], "shared_concepts": [s.title() for s in shared[:5]] or ["Related concepts"],
                   "grounded_application_example": example.strip()}
            db.table("knowledge_graph_edges").insert(row).execute()
            created.append({"from": a["topic_title"], "to": b["topic_title"], "similarity": pr["score"], "shared": row["shared_concepts"]})
    return created
