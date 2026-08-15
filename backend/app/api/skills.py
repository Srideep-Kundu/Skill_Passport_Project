from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import Skill
from app.schemas.contracts import SkillResponse

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("/search", response_model=list[SkillResponse])
async def search_skills(q: Annotated[str, Query(min_length=1, max_length=100)], session: Annotated[AsyncSession, Depends(get_session)]) -> list[SkillResponse]:
    rows = (await session.scalars(select(Skill).where(Skill.canonical_name.ilike(f"%{q}%")).order_by(Skill.canonical_name).limit(30))).all()
    return [SkillResponse.model_validate(item) for item in rows]
