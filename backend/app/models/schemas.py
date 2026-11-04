from pydantic import BaseModel, Field


class PacingRequest(BaseModel):
    pedagogical_system_prompt: str | None = None
    persona_parameters: dict | None = None
    start_date: str | None = None
    ia_dates: list[str] | None = None
    preserve_completed: bool = True
    save_persona: bool = True


class VoteIn(BaseModel):
    student_id: str
    minute_of_class: int = Field(ge=0, le=180)
    reported_focus_score: int = Field(ge=1, le=9)
    preferred_split_min: int | None = 18


class TranscriptIn(BaseModel):
    text: str
    confidence: float = Field(ge=0, le=1)
    words_per_minute: float | None = None


class CheckpointIn(BaseModel):
    slide_number: int | None = None
    chunk_id: str | None = None
    topic: str | None = None
    minutes_elapsed: int | None = None
    reason: str = "ASR_FAILURE"


class ActivityIn(BaseModel):
    chunk_id: str | None = None
    delivery_platform: str = "IN_APP_10_SETS"  # MENTIMETER | KAHOOT | GOOGLE_CLASSROOM | IN_APP_10_SETS
    trigger_minute: int | None = None
    n_sets: int = 10
    use_ai: bool = True


class EndSessionIn(BaseModel):
    covered_chunk_ids: list[str] | None = None
    minutes_behind: int = 0
    transcript: str | None = None


class OcrCell(BaseModel):
    q: str
    marks: int
    max: int
    conf: float = Field(ge=0, le=1)


class OcrSheetIn(BaseModel):
    offering_id: str = "40000000-0000-0000-0000-000000000001"
    sample_case: str | None = None  # 'aarav_ia1' | 'total_mismatch'
    student_usn: str | None = None
    exam_name: str = "IA-1 Examination"
    written_total: int | None = None
    scanned_sheet_url: str | None = None
    cells: list[OcrCell] | None = None


class ApproveOcrIn(BaseModel):
    corrections: dict[str, int] | None = None


class CompileIn(BaseModel):
    offering_id: str
    timeline: str = "BIWEEKLY"  # WEEKLY | BIWEEKLY | MONTHLY | CUSTOM
    from_session: int | None = None
    to_session: int | None = None
    total_marks: int = 20


class ApproveTaskIn(BaseModel):
    edited_payload: dict | None = None


class PersonaIn(BaseModel):
    pedagogical_system_prompt: str | None = None
    persona_parameters: dict | None = None
