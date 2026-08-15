from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/fairness-audit")
async def fairness_audit(principal: Annotated[Admin, Depends(require_role("admin"))], session: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, dict[str, float]]:
    """Privileged audit only; university is never a matching input."""
    rows = (await session.execute(text("""SELECT COALESCE(s.university, 'unspecified') AS university, AVG(m.final_score) AS average_score
                                         FROM matches m JOIN students s ON s.id = m.student_id
                                         GROUP BY s.university ORDER BY university"""))).mappings().all()
    return {"score_by_university": {str(row["university"]): float(row["average_score"]) for row in rows}}
