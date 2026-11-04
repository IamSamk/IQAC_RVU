"""teleBOT-style RBAC. The frontend role switcher sends `X-User-Id`; roles come from the `roles` table.

Lenient by default for the demo: without the header the request runs as an inferred actor.
With RBAC_STRICT=true a missing header is rejected. A present header with too low a rank is always rejected.
"""
from fastapi import Depends, Header, HTTPException

from app.core.config import RBAC_STRICT
from app.core.db import get_db, one

ROLE_RANK = {
    "IQAC_ADMIN": 100, "DEAN": 90, "HOD": 80, "COURSE_LEAD": 70,
    "FACULTY": 60, "TA": 40, "ADMIN_STAFF": 30, "STUDENT": 10,
}


class Actor(dict):
    @property
    def user_id(self) -> str | None:
        return self.get("user_id")

    @property
    def rank(self) -> int:
        return self.get("hierarchy_rank", 0)


def get_actor(x_user_id: str | None = Header(default=None)) -> Actor:
    if not x_user_id:
        if RBAC_STRICT:
            raise HTTPException(401, "X-User-Id header required")
        return Actor(user_id=None, role_code="ANONYMOUS_DEMO", hierarchy_rank=0, inferred=True)
    user = one(get_db().table("users").select("user_id, full_name, institution_id, role_id, roles(role_code, hierarchy_rank)").eq("user_id", x_user_id))
    if not user:
        raise HTTPException(401, "Unknown user")
    role = user.pop("roles") or {}
    return Actor(**user, role_code=role.get("role_code"), hierarchy_rank=role.get("hierarchy_rank", 0), inferred=False)


def require_role(min_role: str):
    """Dependency: actor must be at least `min_role` in the hierarchy (enforced when the header is present)."""
    needed = ROLE_RANK[min_role]

    def checker(actor: Actor = Depends(get_actor)) -> Actor:
        if actor.get("inferred"):
            return actor
        if actor.rank < needed:
            raise HTTPException(403, f"{actor.get('role_code')} cannot perform this action (needs {min_role}+)")
        return actor

    return checker
