-- Login credentials, class attendance, live-class state, syllabus uploads and test accounts.
SET search_path = public, extensions;

-- Credentials live in their own table with RLS on and no policies: the anon/publishable key can never
-- read them. Only the SECURITY DEFINER functions below touch it.
CREATE TABLE user_credentials (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

ALTER TABLE session_plans
    ADD COLUMN attendance_code VARCHAR(6),
    ADD COLUMN started_at TIMESTAMPTZ,
    ADD COLUMN ended_at TIMESTAMPTZ,
    ADD COLUMN lesson_plan_md TEXT;

ALTER TABLE courses
    ADD COLUMN created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN course_outcomes JSONB DEFAULT '[]';
CREATE INDEX idx_courses_created_by ON courses(created_by);

CREATE TABLE session_attendance (
    attendance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES session_plans(session_id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(15) DEFAULT 'PRESENT',
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, student_id)
);
CREATE INDEX idx_attendance_student ON session_attendance(student_id);

CREATE TABLE syllabus_uploads (
    upload_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(course_id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    file_name TEXT,
    mime_type TEXT,
    parse_engine VARCHAR(40),
    parsed_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_uploads_course ON syllabus_uploads(course_id);
CREATE INDEX idx_uploads_user ON syllabus_uploads(uploaded_by);

ALTER TABLE session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY demo_all ON session_attendance FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY demo_all ON syllabus_uploads FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE session_attendance;

-- Login check: returns the user only when the bcrypt hash matches.
CREATE OR REPLACE FUNCTION public.verify_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (user_id UUID, full_name TEXT, email TEXT, role_code TEXT, hierarchy_rank INT)
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
    SELECT u.user_id, u.full_name::text, u.email::text, r.role_code::text, r.hierarchy_rank
    FROM users u
    JOIN user_credentials c ON c.user_id = u.user_id
    JOIN roles r ON r.role_id = u.role_id
    WHERE lower(u.email) = lower(trim(p_email))
      AND u.is_active
      AND c.password_hash = crypt(p_password, c.password_hash);
$$;
GRANT EXECUTE ON FUNCTION public.verify_login(TEXT, TEXT) TO anon, authenticated;

-- Test accounts used by the login page's demo buttons. Called after seed_demo() on every reset.
CREATE OR REPLACE FUNCTION public.seed_accounts() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  d_cse UUID := '10000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO users (user_id, institution_id, full_name, email, role_id, department_id, semester, age_years, section, pedagogical_system_prompt, persona_parameters) VALUES
    ('20000000-0000-0000-0000-000000000101', 'RVU-FAC-201', 'Prof. Test Teacher', 'teacher@campusai.test', 5, d_cse, NULL, 35, NULL,
     'Clear, example-first teaching: start with a real-world problem, build the concept step by step, then check understanding with a quick poll.',
     '{"theory_depth": 0.7, "activity_preference": "mentimeter", "pace_multiplier": 1.0}'),
    ('20000000-0000-0000-0000-000000000201', '1RVU23CSE099', 'Test Student', 'student@campusai.test', 8, d_cse, 5, 20, 'A', NULL, '{}'),
    ('20000000-0000-0000-0000-000000000202', '1RVU23CSE061', 'Diya Menon', 'diya.menon@campusai.test', 8, d_cse, 5, 20, 'B', NULL, '{}'),
    ('20000000-0000-0000-0000-000000000203', '1RVU23CSE073', 'Kavya Rao', 'kavya.rao@campusai.test', 8, d_cse, 5, 20, 'B', NULL, '{}'),
    ('20000000-0000-0000-0000-000000000204', '1RVU23CSE084', 'Arjun Nair', 'arjun.nair@campusai.test', 8, d_cse, 5, 21, 'C', NULL, '{}'),
    ('20000000-0000-0000-0000-000000000205', '1RVU23CSE090', 'Nikhil Joshi', 'nikhil.joshi@campusai.test', 8, d_cse, 5, 20, 'C', NULL, '{}')
  ON CONFLICT (user_id) DO NOTHING;

  -- The test student also takes CS304 and DES201, so their knowledge graph has cross-course links from day one.
  INSERT INTO student_enrollments (offering_id, student_id, enrollment_category) VALUES
    ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000201', 'MAJOR'),
    ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000201', 'ELECTIVE')
  ON CONFLICT DO NOTHING;

  INSERT INTO user_credentials (user_id, password_hash)
  SELECT u.user_id, crypt(p.pw, gen_salt('bf', 8))
  FROM users u JOIN (VALUES
      ('teacher@campusai.test', 'Teacher@123'),
      ('darshan.s@rvu.edu.in', 'Teacher@123'),
      ('veena.k@rvu.edu.in', 'Teacher@123'),
      ('rao.k@rvu.edu.in', 'Teacher@123'),
      ('iqac.admin@rvu.edu.in', 'Admin@123'),
      ('student@campusai.test', 'Student@123'),
      ('aarav.sharma@rvu.edu.in', 'Student@123'),
      ('riya.patel@rvu.edu.in', 'Student@123'),
      ('diya.menon@campusai.test', 'Student@123'),
      ('kavya.rao@campusai.test', 'Student@123'),
      ('arjun.nair@campusai.test', 'Student@123'),
      ('nikhil.joshi@campusai.test', 'Student@123')
  ) AS p(email, pw) ON u.email = p.email
  ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW();

  RETURN jsonb_build_object('accounts', (SELECT count(*) FROM user_credentials));
END $$;
GRANT EXECUTE ON FUNCTION public.seed_accounts() TO anon, authenticated;

SELECT public.seed_accounts();
