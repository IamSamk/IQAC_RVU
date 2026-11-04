-- PYQ syllabus-diff mapping columns, indexes, RLS (demo mode) and Realtime
SET search_path = public, extensions;

-- PYQ -> current-syllabus mapping (approved by Course Lead, recomputable by Agent 3)
ALTER TABLE pyq_question_bank
    ADD COLUMN current_chunk_id UUID REFERENCES syllabus_chunks(chunk_id) ON DELETE SET NULL,
    ADD COLUMN current_similarity FLOAT,
    ADD COLUMN mapping_status VARCHAR(30) DEFAULT 'PENDING'; -- 'VALID_CURRENT', 'FILTERED_OUT_DEPRECATED'

-- Deprecated topics in predecessor syllabi
ALTER TABLE syllabus_chunks ADD COLUMN is_deprecated BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_chunks_course ON syllabus_chunks(course_id, unit_number, sequence_order);
CREATE INDEX idx_sessions_offering ON session_plans(offering_id, session_number);
CREATE INDEX idx_votes_session ON attention_telemetry_votes(session_id);
CREATE INDEX idx_enroll_student ON student_enrollments(student_id);
CREATE INDEX idx_kg_source ON knowledge_graph_edges(source_chunk_id);
CREATE INDEX idx_kg_target ON knowledge_graph_edges(target_chunk_id);
CREATE INDEX idx_pyq_origin ON pyq_question_bank(origin_course_id);
CREATE INDEX idx_ocr_offering ON ocr_exam_evaluations(offering_id);
CREATE INDEX idx_copilot_faculty ON faculty_copilot_tasks(faculty_id, status);
CREATE INDEX idx_memory_user ON agent_memory_logs(user_id);
CREATE INDEX idx_audit_actor ON rbac_audit_logs(actor_user_id);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_dept ON users(department_id);
CREATE INDEX idx_courses_dept ON courses(department_id);
CREATE INDEX idx_courses_pred ON courses(predecessor_course_id);
CREATE INDEX idx_courses_verifier ON courses(similarity_verified_by);
CREATE INDEX idx_offer_course ON course_offerings(course_id);
CREATE INDEX idx_offer_faculty ON course_offerings(faculty_id);
CREATE INDEX idx_votes_student ON attention_telemetry_votes(student_id);
CREATE INDEX idx_act_session ON polymorphic_activities(session_id);
CREATE INDEX idx_act_chunk ON polymorphic_activities(chunk_id);
CREATE INDEX idx_pyq_mapped ON pyq_question_bank(mapped_chunk_id);
CREATE INDEX idx_pyq_current ON pyq_question_bank(current_chunk_id);
CREATE INDEX idx_ocr_student ON ocr_exam_evaluations(student_id);
CREATE INDEX idx_copilot_offering ON faculty_copilot_tasks(offering_id);

-- RLS: enabled everywhere. DEMO MODE policies allow the anon/authenticated keys full access
-- so the hackathon frontend + backend work with the publishable key.
-- TODO before production: replace demo_all with role-scoped policies and use the service_role key in the backend.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'departments','roles','users','rbac_audit_logs','agent_memory_logs','courses',
    'course_offerings','student_enrollments','syllabus_chunks','session_plans',
    'attention_telemetry_votes','polymorphic_activities','knowledge_graph_edges',
    'pyq_question_bank','ocr_exam_evaluations','faculty_copilot_tasks'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY demo_all ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Realtime channels for live class, OCR grid and co-pilot drawer
ALTER PUBLICATION supabase_realtime ADD TABLE
    attention_telemetry_votes, session_plans, faculty_copilot_tasks, ocr_exam_evaluations;
