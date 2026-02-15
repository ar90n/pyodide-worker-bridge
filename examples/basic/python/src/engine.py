"""Text analysis engine — pyodide-bridge example.

Demonstrates TypedDict (total=True / total=False), Literal, Required,
Optional, and list type mappings.
"""

from typing import TypedDict, Literal, Required, Optional
from collections import Counter
import re

# ---------------------------------------------------------------------------
# Type definitions
# ---------------------------------------------------------------------------

AnalysisMode = Literal["word_count", "char_freq", "summary"]


class AnalysisParams(TypedDict, total=False):
    """Input parameters for the analyze function."""

    text: Required[str]
    mode: AnalysisMode  # default: "word_count"


class WordFreq(TypedDict):
    """A word and its frequency count."""

    word: str
    count: int


class WordCountResult(TypedDict):
    """Result of word-count analysis."""

    total_words: int
    unique_words: int
    top_words: list[WordFreq]


class CharFreq(TypedDict):
    """A character and its frequency count."""

    char: str
    count: int


class CharFreqResult(TypedDict):
    """Result of character-frequency analysis."""

    total_chars: int
    frequencies: list[CharFreq]


class SummaryResult(TypedDict):
    """Result of summary analysis."""

    total_words: int
    total_chars: int
    avg_word_length: float
    sentence_count: int


class AnalysisResult(TypedDict):
    """Unified result returned by analyze()."""

    mode: AnalysisMode
    word_count: Optional[WordCountResult]
    char_freq: Optional[CharFreqResult]
    summary: Optional[SummaryResult]


# ---------------------------------------------------------------------------
# Bridge metadata
# ---------------------------------------------------------------------------

__bridge_exports__ = ["analyze"]
__bridge_packages__: list[str] = []

# ---------------------------------------------------------------------------
# Implementation
# ---------------------------------------------------------------------------

_WORD_RE = re.compile(r"[a-zA-Z]+(?:'[a-zA-Z]+)?")
_SENTENCE_RE = re.compile(r"[.!?]+")


def _word_count(text: str) -> WordCountResult:
    words = [w.lower() for w in _WORD_RE.findall(text)]
    counter = Counter(words)
    top = counter.most_common(10)
    return {
        "total_words": len(words),
        "unique_words": len(counter),
        "top_words": [{"word": w, "count": c} for w, c in top],
    }


def _char_freq(text: str) -> CharFreqResult:
    chars = [ch for ch in text.lower() if ch.isalpha()]
    counter = Counter(chars)
    freqs = sorted(counter.items(), key=lambda x: -x[1])[:15]
    return {
        "total_chars": len(chars),
        "frequencies": [{"char": ch, "count": c} for ch, c in freqs],
    }


def _summary(text: str) -> SummaryResult:
    words = _WORD_RE.findall(text)
    sentences = [s for s in _SENTENCE_RE.split(text) if s.strip()]
    total_words = len(words)
    total_chars = sum(len(w) for w in words)
    return {
        "total_words": total_words,
        "total_chars": total_chars,
        "avg_word_length": round(total_chars / max(total_words, 1), 2),
        "sentence_count": max(len(sentences), 1),
    }


def analyze(params: AnalysisParams) -> AnalysisResult:
    """Run text analysis in the specified mode."""
    text = params["text"]
    mode: AnalysisMode = params.get("mode", "word_count")  # type: ignore[assignment]

    result: AnalysisResult = {
        "mode": mode,
        "word_count": None,
        "char_freq": None,
        "summary": None,
    }

    if mode == "word_count":
        result["word_count"] = _word_count(text)
    elif mode == "char_freq":
        result["char_freq"] = _char_freq(text)
    elif mode == "summary":
        result["summary"] = _summary(text)

    return result
