"""Supported display locales. Locale is personalization only, never a matching input."""

SUPPORTED_LOCALE_CODES = (
    "en", "as", "bn", "brx", "doi", "gu", "hi", "kn", "kok", "mai",
    "ml", "mni", "mr", "ne", "or", "pa", "sa", "sat", "ta", "te",
)


def normalize_locale(value: str | None) -> str:
    """Return a supported base locale, falling back deterministically to English."""
    if not value:
        return "en"
    candidate = value.strip().lower().replace("_", "-").split("-", 1)[0]
    return candidate if candidate in SUPPORTED_LOCALE_CODES else "en"


def is_supported_locale(value: str) -> bool:
    return value in SUPPORTED_LOCALE_CODES
