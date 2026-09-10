"""Generate checked-in UI catalogs. Never imported or called by the shipped app."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import translators as translators_api


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "src" / "localization" / "generated" / "source-phrases.json"
OUTPUT_DIR = SOURCE_PATH.parent
LANGUAGE_CODES = {
    "as": "as", "bn": "bn", "brx": "brx", "doi": "doi", "gu": "gu", "hi": "hi",
    "kn": "kn", "kok": "gom", "mai": "mai", "ml": "ml",
    "mr": "mr", "ne": "ne", "or": "or", "pa": "pa", "sa": "sa",
    "ta": "ta", "te": "te",
}
MAX_BATCH_CHARACTERS = 800


def batches(phrases: list[str]) -> list[list[str]]:
    result: list[list[str]] = []
    current: list[str] = []
    length = 0
    for phrase in phrases:
        addition = len(phrase) + (1 if current else 0)
        if current and length + addition > MAX_BATCH_CHARACTERS:
            result.append(current)
            current, length = [], 0
        current.append(phrase)
        length += addition
    if current:
        result.append(current)
    return result


def translate_batch(lines: list[str], target: str) -> list[str]:
    separator = " ␞ "
    for attempt in range(5):
        try:
            result = translators_api.translate_text(
                separator.join(lines),
                translator="bing",
                from_language="en",
                to_language=target,
                timeout=60,
            )
            break
        except Exception:
            if attempt == 4:
                raise
            time.sleep(3 * (attempt + 1))
    translated = [value.strip() for value in str(result).split("␞")]
    if len(translated) != len(lines):
        if len(lines) == 1:
            raise RuntimeError(f"Translation separator was lost for a single phrase: {lines[0]!r}")
        midpoint = len(lines) // 2
        return translate_batch(lines[:midpoint], target) + translate_batch(lines[midpoint:], target)
    return translated


def main() -> None:
    requested = [value.strip() for value in os.getenv("TRANSLATION_LOCALES", "").split(",") if value.strip()]
    if not requested:
        raise RuntimeError("Set TRANSLATION_LOCALES to an explicit comma-separated locale list")
    unknown = set(requested).difference(LANGUAGE_CODES)
    if unknown:
        raise RuntimeError(f"Unsupported requested locales: {sorted(unknown)}")

    phrases: list[str] = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    phrase_batches = batches(phrases)
    for locale in requested:
        target = LANGUAGE_CODES[locale]
        output_path = OUTPUT_DIR / f"{locale}.json"
        existing: dict[str, str] = (
            json.loads(output_path.read_text(encoding="utf-8")) if output_path.exists() else {}
        )
        pending_phrases = [
            phrase for phrase in phrases if not str(existing.get(phrase, "")).strip()
        ]
        phrase_batches = batches(pending_phrases)
        if not pending_phrases:
            print(f"{locale}: catalog is current", flush=True)
            continue
        partial_path = OUTPUT_DIR / f"{locale}.partial.json"
        translated_phrases: list[str] = (
            json.loads(partial_path.read_text(encoding="utf-8")) if partial_path.exists() else []
        )
        completed_batches = 0
        completed_phrases = 0
        for batch in phrase_batches:
            if completed_phrases + len(batch) <= len(translated_phrases):
                completed_batches += 1
                completed_phrases += len(batch)
            else:
                break
        translated_phrases = translated_phrases[:completed_phrases]
        for index, batch in enumerate(phrase_batches[completed_batches:], start=completed_batches + 1):
            translated_phrases.extend(translate_batch(batch, target))
            partial_path.write_text(json.dumps(translated_phrases, ensure_ascii=False), encoding="utf-8")
            print(f"{locale}: batch {index}/{len(phrase_batches)}", flush=True)
        existing.update(dict(zip(pending_phrases, translated_phrases, strict=True)))
        output_path.write_text(
            json.dumps({phrase: existing[phrase] for phrase in phrases}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        partial_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
