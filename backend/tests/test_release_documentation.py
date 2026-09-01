from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_active_release_documentation_uses_current_migration() -> None:
    active_documents = [
        REPOSITORY_ROOT / "README.md",
        REPOSITORY_ROOT / "DEMO.md",
        REPOSITORY_ROOT / "docs" / "local-development.md",
        REPOSITORY_ROOT / "docs" / "judge-demo.md",
        REPOSITORY_ROOT / "docs" / "manual-demo-matrix.md",
    ]
    combined = "\n".join(path.read_text(encoding="utf-8") for path in active_documents)

    assert "0022_hybrid_extraction_pipeline" not in combined
    assert "0031_institution_imports" in combined
