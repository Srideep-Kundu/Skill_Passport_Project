"""LMS / MOOC Integration Adapter Interface.

Provides a pluggable adapter protocol for syncing coursework and completions from
external learning platforms (e.g. Canvas, Moodle, Coursera, NPTEL/SWAYAM).
"""
from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class LMSCourseCompletion(BaseModel):
    external_course_id: str
    course_name: str
    provider: str
    completion_percentage: float
    grade: str | None = None
    completed_at: str
    skills_covered: list[str] = Field(default_factory=list)


class BaseLMSAdapter(ABC):
    provider_name: str
    credentialed: bool = False

    @abstractmethod
    async def fetch_student_completions(self, external_user_id: str) -> list[LMSCourseCompletion]:
        """Fetch completed courses from the provider."""
        raise NotImplementedError
