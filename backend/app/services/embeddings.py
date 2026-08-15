import hashlib
import math


def deterministic_embedding(text: str, dimensions: int = 32) -> list[float]:
    """Stable local fallback embedding; provider embeddings never score by themselves."""
    values = [0.0] * dimensions
    for token in text.casefold().split():
        digest = hashlib.sha256(token.encode()).digest()
        values[digest[0] % dimensions] += 1.0 if digest[1] % 2 else -1.0
    norm = math.sqrt(sum(value * value for value in values))
    return [value / norm for value in values] if norm else values


def cosine_similarity(left: list[float] | None, right: list[float] | None) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    denominator = math.sqrt(sum(x * x for x in left)) * math.sqrt(sum(y * y for y in right))
    return max(-1.0, min(1.0, sum(x * y for x, y in zip(left, right)) / denominator)) if denominator else 0.0
