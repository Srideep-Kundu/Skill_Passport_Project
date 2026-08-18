import asyncio

from sqlalchemy import select

from app.core.db import SessionLocal
from app.models import Skill

TAXONOMY: dict[str, list[str]] = {
    "Programming Language": ["Python", "Java", "JavaScript", "TypeScript", "C", "C++", "C#", "Go", "Rust", "Kotlin", "Swift", "Ruby", "PHP", "R", "Scala", "Racket", "MATLAB", "SQL", "Bash", "PowerShell", "HTML", "CSS"],
    "Frontend": ["React", "Vue", "Angular", "Svelte", "Vite", "Tailwind", "Bootstrap", "Redux", "Next.js", "Webpack", "Jest", "Cypress", "Playwright", "D3.js", "Recharts", "Accessibility", "Responsive", "Design"],
    "Backend": ["FastAPI", "Django", "Flask", "Express", "NestJS", "Spring", "Boot", ".NET", "GraphQL", "REST", "gRPC", "OpenAPI", "Pydantic", "SQLAlchemy", "Alembic", "Celery", "Redis", "RabbitMQ"],
    "Data": ["PostgreSQL", "MySQL", "SQLite", "MongoDB", "Elasticsearch", "Kafka", "Spark", "Hadoop", "Airflow", "dbt", "Pandas", "NumPy", "Polars", "scikit-learn", "Tableau", "Power", "BI", "Excel"],
    "Cloud & DevOps": ["Docker", "Kubernetes", "Terraform", "Ansible", "Git", "GitHub", "Actions", "GitLab", "CI", "Jenkins", "AWS", "Azure", "GCP", "Linux", "Nginx", "Prometheus", "Grafana", "Sentry"],
    "AI & ML": ["TensorFlow", "Keras", "PyTorch", "Hugging", "Face", "LangChain", "Gemini", "OpenAI", "Computer", "Vision", "NLP", "Transformers", "Embeddings", "RAG", "Vector", "Database", "MLOps"],
    "Security": ["OAuth", "JWT", "OWASP", "Encryption", "Cryptography", "RBAC", "IAM", "Penetration", "Testing", "Network", "Security", "Secure", "Coding", "Threat", "Modeling"],
    "Engineering": ["Agile", "Scrum", "System", "Design", "Microservices", "Testing", "TDD", "CI/CD", "Design", "Patterns", "Algorithms", "Data", "Structures", "Operating", "Systems", "Networking"],
    "Product & Collaboration": ["Figma", "UX Research", "Product Management", "Technical Writing", "Jira", "Confluence", "Kanban", "Code Review", "Pair Programming", "Debugging", "Performance Optimization", "Distributed Systems", "Event-Driven Architecture", "Domain-Driven Design", "Unit Testing", "Integration Testing", "Load Testing", "Incident Response", "Observability", "Feature Flags"],
}

ALIASES = {"Python": ["python3", "py"], "JavaScript": ["js"], "TypeScript": ["ts"], "PostgreSQL": ["postgres", "postgresql"], "React": ["react.js"], "GitHub Actions": ["github actions"]}


async def seed_skills() -> int:
    inserted = 0
    async with SessionLocal() as session:
        existing = set((await session.scalars(select(Skill.canonical_name))).all())
        for category, names in TAXONOMY.items():
            for name in names:
                if name not in existing:
                    session.add(Skill(canonical_name=name, category=category, aliases=ALIASES.get(name, [])))
                    existing.add(name)
                    inserted += 1
        await session.commit()
    return inserted


if __name__ == "__main__":
    print(asyncio.run(seed_skills()))
