"""LinkedIn Profile Import Provider Abstraction.

Provides structured, compliant professional profile extraction from LinkedIn URLs
without fragile web scraping or security bypasses.
"""
import re
from abc import ABC, abstractmethod
from typing import Any
from urllib.parse import urlparse

from pydantic import Field

from app.schemas.contracts import APIModel


class ProfessionalProfile(APIModel):
    full_name: str
    headline: str
    summary: str
    current_position: str
    experiences: list[dict[str, Any]] = Field(default_factory=list)
    education: list[dict[str, Any]] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    certifications: list[dict[str, Any]] = Field(default_factory=list)
    projects: list[dict[str, Any]] = Field(default_factory=list)
    source: str = "demo_fixture"
    source_confidence: float = 0.0
    persistable: bool = False
    is_demo_fixture: bool = True
    disclaimer: str = "Simulated preview only. Upload your LinkedIn data export to add sourced evidence."


class LinkedInImportProvider(ABC):
    @abstractmethod
    async def fetch_profile(self, profile_url: str) -> ProfessionalProfile:
        """Fetch and normalize structured profile data."""
        raise NotImplementedError


class MockDemoProvider(LinkedInImportProvider):
    """Deterministic reference provider for offline demo, testing, and evaluation."""

    async def fetch_profile(self, profile_url: str) -> ProfessionalProfile:
        parsed = urlparse(profile_url.strip())
        path = parsed.path.strip("/")
        handle = path.split("/")[-1] if path else "professional"
        clean_name = re.sub(r"[-_]", " ", handle).title() if handle else "Maya Rivera"

        if "maya" in handle.lower():
            return ProfessionalProfile(
                full_name="Maya Rivera",
                headline="Software Engineer & Distributed Systems Enthusiast",
                summary="Full stack engineer specializing in Python, FastAPI, React, and resilient database architectures.",
                current_position="Software Engineering Intern at Acme Tech Labs",
                experiences=[
                    {
                        "title": "Backend Engineering Intern",
                        "company": "Acme Tech Labs",
                        "duration": "May 2025 - Aug 2025",
                        "description": "Architected low-latency microservices with FastAPI and PostgreSQL pgvector.",
                    },
                    {
                        "title": "Full Stack Contributor",
                        "company": "Open Source Guild",
                        "duration": "Jan 2025 - Present",
                        "description": "Built reactive TypeScript dashboards and Redis caching queues.",
                    },
                ],
                education=[
                    {
                        "institution": "Apex Institute of Technology",
                        "degree": "B.Tech in Computer Science and Engineering",
                        "years": "2022 - 2026",
                    }
                ],
                skills=["Python", "FastAPI", "React", "TypeScript", "PostgreSQL", "Docker", "Redis", "REST API", "Git"],
                certifications=[
                    {"name": "AWS Certified Cloud Practitioner", "issuer": "Amazon Web Services", "year": "2025"},
                    {"name": "PostgreSQL Performance Specialist", "issuer": "Postgres Enterprise", "year": "2025"},
                ],
                projects=[
                    {"title": "Distributed Task Queue", "description": "Built asynchronous Redis worker in Python."},
                    {"title": "Verifiable Skill Passport", "description": "Deterministic explainable matching platform."},
                ],
                source="demo_fixture",
            )

        return ProfessionalProfile(
            full_name=clean_name if len(clean_name) > 3 else "Alex Patel",
            headline="Full Stack Developer & Systems Designer",
            summary="Passionate engineer building scalable web applications and distributed architectures.",
            current_position="Student & Developer at Apex University",
            experiences=[
                {
                    "title": "Software Engineering Intern",
                    "company": "Tech Corp Labs",
                    "duration": "Jun 2025 - Present",
                    "description": "Developed backend REST APIs and database optimization pipelines.",
                }
            ],
            education=[
                {
                    "institution": "University School of Engineering",
                    "degree": "Bachelor of Science in Computer Science",
                    "years": "2022 - 2026",
                }
            ],
            skills=["Python", "FastAPI", "SQL", "Docker", "Git", "REST API"],
            certifications=[
                {"name": "Foundations of Cloud Computing", "issuer": "Coursera", "year": "2025"}
            ],
            projects=[
                {"title": "High-Concurrency API Proxy", "description": "FastAPI reverse proxy with Redis caching."}
            ],
            source="demo_fixture",
        )


class OfficialLinkedInOAuthProvider(LinkedInImportProvider):
    """Compliant OAuth provider for production LinkedIn member-authorized data imports."""

    async def fetch_profile(self, profile_url: str) -> ProfessionalProfile:
        raise RuntimeError("LinkedIn OAuth import is not configured")


class EnrichmentProvider(LinkedInImportProvider):
    """Third-party data enrichment adapter with strict privacy compliance."""

    async def fetch_profile(self, profile_url: str) -> ProfessionalProfile:
        raise RuntimeError("LinkedIn enrichment import is not configured")


def get_linkedin_import_provider() -> LinkedInImportProvider:
    return MockDemoProvider()
