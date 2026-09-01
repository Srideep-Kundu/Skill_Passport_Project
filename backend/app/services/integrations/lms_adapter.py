"""LMS / MOOC Integration Adapter Interface.

Provides a pluggable adapter protocol for syncing coursework and completions from
external learning platforms (e.g. Canvas, Moodle, Coursera, NPTEL/SWAYAM).
"""
from abc import ABC, abstractmethod

from pydantic import BaseModel


class LMSCourseCompletion(BaseModel):
    external_course_id: str
    course_name: str
    provider: str
    completion_percentage: float
    grade: str | None = None
    completed_at: str
    skills_covered: list[str] = []


class BaseLMSAdapter(ABC):
    @abstractmethod
    async def fetch_student_completions(self, external_user_id: str) -> list[LMSCourseCompletion]:
        """Fetch completed courses from the provider."""
        raise NotImplementedError


class MockLMSAdapter(BaseLMSAdapter):
    """Reference adapter implementation for demonstrations & testing."""

    async def fetch_student_completions(self, external_user_id: str) -> list[LMSCourseCompletion]:
        return [
            LMSCourseCompletion(
                external_course_id="SWAYAM-CS-2025",
                course_name="Data Structures and Algorithms in C++",
                provider="NPTEL / SWAYAM",
                completion_percentage=100.0,
                grade="Elite + Gold (92%)",
                completed_at="2026-02-15T10:00:00Z",
                skills_covered=["Data Structures", "Algorithms", "C++"],
            ),
            LMSCourseCompletion(
                external_course_id="COURSERA-CLOUD-401",
                course_name="Cloud Computing & Kubernetes Architecture",
                provider="Coursera",
                completion_percentage=100.0,
                grade="Pass with Honors",
                completed_at="2026-04-10T14:30:00Z",
                skills_covered=["Kubernetes", "Docker", "Cloud Computing"],
            ),
        ]
