import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
# Service-role key preferred; the publishable/anon key also works while the demo RLS policies are on.
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")
RBAC_STRICT = os.getenv("RBAC_STRICT", "false").lower() == "true"
AUTO_SEED = os.getenv("AUTO_SEED", "true").lower() == "true"

# Academic calendar defaults for the demo semester (overridable per request)
SEMESTER_START = os.getenv("SEMESTER_START", "2026-10-15")
IA1_DATE = os.getenv("IA1_DATE", "2026-11-18")
IA2_DATE = os.getenv("IA2_DATE", "2026-12-09")
HOLIDAYS = [d for d in os.getenv("HOLIDAYS", "2026-11-27").split(",") if d]
DEMO_CURRENT_SESSION = int(os.getenv("DEMO_CURRENT_SESSION", "12"))
