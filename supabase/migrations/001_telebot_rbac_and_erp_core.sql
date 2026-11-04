-- CampusAI ERP core schema (teleBOT RBAC + IQAC_RVU curriculum, pacing, KG, OCR, co-pilot)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;

SET search_path = public, extensions;

-- ============================================================================
-- PART A: RBAC, HIERARCHY & MEMORY LOGS
-- ============================================================================
CREATE TABLE departments (
    department_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dept_code VARCHAR(20) UNIQUE NOT NULL,
    dept_name VARCHAR(150) NOT NULL,
    dean_name VARCHAR(120),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_code VARCHAR(40) UNIQUE NOT NULL,
    hierarchy_rank INT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_uid UUID UNIQUE,
    institution_id VARCHAR(40) UNIQUE NOT NULL,
    full_name VARCHAR(140) NOT NULL,
    email VARCHAR(140) UNIQUE NOT NULL,
    phone_whatsapp VARCHAR(25),
    role_id INT REFERENCES roles(role_id) NOT NULL,
    department_id UUID REFERENCES departments(department_id),
    semester INT,
    age_years INT DEFAULT 19,
    section VARCHAR(10),
    pedagogical_system_prompt TEXT DEFAULT 'Balanced conceptual explanation with real-world engineering examples and interactive problem solving.',
    persona_parameters JSONB DEFAULT '{"theory_depth": 0.7, "activity_preference": "mentimeter", "pace_multiplier": 1.0}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rbac_audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action_type VARCHAR(80) NOT NULL,
    target_table VARCHAR(60),
    target_record_id UUID,
    payload_diff JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_memory_logs (
    memory_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    memory_scope VARCHAR(40) NOT NULL,
    memory_summary TEXT NOT NULL,
    structured_context JSONB DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART B: CURRICULUM, L:T:P & SYLLABUS CHUNKS
-- ============================================================================
CREATE TABLE courses (
    course_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_code VARCHAR(30) UNIQUE NOT NULL,
    course_title VARCHAR(180) NOT NULL,
    department_id UUID REFERENCES departments(department_id),
    semester INT NOT NULL,
    credits INT NOT NULL,
    l_ratio INT NOT NULL DEFAULT 3,
    t_ratio INT NOT NULL DEFAULT 0,
    p_ratio INT NOT NULL DEFAULT 1,
    course_stratum VARCHAR(30) DEFAULT 'APPLIED_CORE',
    total_planned_sessions INT DEFAULT 45,
    last_working_day DATE NOT NULL DEFAULT '2026-12-18',
    iqac_rubric_config JSONB NOT NULL DEFAULT '{
        "cie_weight": 50,
        "see_weight": 50,
        "outcomes": ["CO1", "CO2", "CO3", "CO4"],
        "blooms_distribution": {"understand": 25, "apply": 40, "analyze": 25, "create": 10}
    }',
    predecessor_course_id UUID REFERENCES courses(course_id),
    similarity_verified_by UUID REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE course_offerings (
    offering_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(course_id) ON DELETE CASCADE,
    faculty_id UUID REFERENCES users(user_id),
    academic_year VARCHAR(15) NOT NULL DEFAULT '2026-27',
    section VARCHAR(10) NOT NULL DEFAULT 'A',
    default_time_slot VARCHAR(20) DEFAULT 'MORNING_09AM',
    google_classroom_id VARCHAR(120),
    eval_spreadsheet_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_enrollments (
    enrollment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offering_id UUID REFERENCES course_offerings(offering_id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    enrollment_category VARCHAR(25) DEFAULT 'MAJOR',
    UNIQUE(offering_id, student_id)
);

CREATE TABLE syllabus_chunks (
    chunk_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(course_id) ON DELETE CASCADE,
    unit_number INT NOT NULL,
    sequence_order INT NOT NULL,
    topic_title VARCHAR(220) NOT NULL,
    syllabus_content TEXT NOT NULL,
    slide_range VARCHAR(30) DEFAULT 'Slides 1-15',
    ltp_type VARCHAR(15) DEFAULT 'L',
    estimated_minutes INT DEFAULT 40,
    cognitive_complexity FLOAT DEFAULT 1.2,
    co_mapping VARCHAR(15) DEFAULT 'CO1',
    bloom_level VARCHAR(25) DEFAULT 'APPLY',
    canonical_keywords TEXT[] DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART C: PACING CALENDAR, LIVE CLASS & ATTENTION
-- ============================================================================
CREATE TABLE session_plans (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offering_id UUID REFERENCES course_offerings(offering_id) ON DELETE CASCADE,
    session_number INT NOT NULL,
    scheduled_date DATE NOT NULL,
    session_type VARCHAR(25) DEFAULT 'REGULAR_CLASS',
    planned_chunk_ids UUID[] NOT NULL,
    covered_chunk_ids UUID[] DEFAULT '{}',
    session_duration_mins INT DEFAULT 60,
    predicted_dip_minute FLOAT DEFAULT 18.0,
    lecture_minutes_split INT DEFAULT 42,
    activity_minutes_split INT DEFAULT 18,
    split_source VARCHAR(30) DEFAULT 'IUCEE_STRATA_AI',
    transcription_status VARCHAR(30) DEFAULT 'PENDING',
    live_transcript_text TEXT,
    fallback_slide_checkpoint VARCHAR(120),
    generated_class_notes_md TEXT,
    pacing_delta_mins INT DEFAULT 0,
    status VARCHAR(25) DEFAULT 'SCHEDULED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(offering_id, session_number)
);

CREATE TABLE attention_telemetry_votes (
    vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES session_plans(session_id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    minute_of_class INT NOT NULL,
    reported_focus_score INT CHECK (reported_focus_score BETWEEN 1 AND 9),
    preferred_split_min INT DEFAULT 18,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE polymorphic_activities (
    activity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES session_plans(session_id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES syllabus_chunks(chunk_id) ON DELETE SET NULL,
    delivery_platform VARCHAR(30) DEFAULT 'IN_APP_10_SETS',
    trigger_minute INT NOT NULL DEFAULT 18,
    learning_goal TEXT NOT NULL,
    question_sets_json JSONB NOT NULL,
    requires_hitl_review BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART D: CLOSED-WORLD KNOWLEDGE GRAPH & PYQ ENGINE
-- ============================================================================
CREATE TABLE knowledge_graph_edges (
    edge_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_chunk_id UUID REFERENCES syllabus_chunks(chunk_id) ON DELETE CASCADE,
    target_chunk_id UUID REFERENCES syllabus_chunks(chunk_id) ON DELETE CASCADE,
    edge_type VARCHAR(35) NOT NULL,
    similarity_score FLOAT NOT NULL,
    shared_concepts TEXT[] NOT NULL,
    grounded_application_example TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pyq_question_bank (
    pyq_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin_course_id UUID REFERENCES courses(course_id) ON DELETE CASCADE,
    mapped_chunk_id UUID REFERENCES syllabus_chunks(chunk_id) ON DELETE SET NULL,
    exam_year INT NOT NULL,
    exam_type VARCHAR(20) DEFAULT 'SEE',
    question_text TEXT NOT NULL,
    marks INT NOT NULL DEFAULT 10,
    co_code VARCHAR(10),
    bloom_level VARCHAR(20),
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART E: OCR EVALUATION, DIAGNOSTICS & FACULTY CO-PILOT
-- ============================================================================
CREATE TABLE ocr_exam_evaluations (
    eval_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offering_id UUID REFERENCES course_offerings(offering_id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    exam_name VARCHAR(50) NOT NULL DEFAULT 'IA-1 Examination',
    scanned_sheet_url TEXT,
    question_marks_json JSONB NOT NULL,
    ocr_overall_confidence FLOAT NOT NULL,
    requires_faculty_hitl BOOLEAN DEFAULT TRUE,
    faculty_approved BOOLEAN DEFAULT FALSE,
    synced_to_spreadsheet BOOLEAN DEFAULT FALSE,
    ai_diagnostic_feedback TEXT,
    weak_chunk_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE faculty_copilot_tasks (
    task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    offering_id UUID REFERENCES course_offerings(offering_id) ON DELETE CASCADE,
    task_title VARCHAR(180) NOT NULL,
    due_timestamp TIMESTAMPTZ NOT NULL,
    tool_call_name VARCHAR(80) NOT NULL,
    pre_executed_draft_payload JSONB NOT NULL,
    status VARCHAR(30) DEFAULT 'AWAITING_HITL_APPROVAL',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
