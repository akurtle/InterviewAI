from __future__ import annotations

from dataclasses import dataclass
import math
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple


WORD_RE = re.compile(r"[a-zA-Z']+")
SENTENCE_SPLIT_RE = re.compile(r"[.!?]+")


FILLER_WORDS = {
    "um",
    "uh",
    "erm",
    "like",
    "actually",
    "basically",
    "literally",
    "well",
    "so",
    "right",
    "okay",
    "ok",
}

FILLER_PHRASES = {
    ("you", "know"),
    ("kind", "of"),
    ("sort", "of"),
}

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "from",
    "has",
    "have",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "was",
    "we",
    "with",
    "you",
    "your",
}


def _tokenize(text: str) -> List[str]:
    return WORD_RE.findall(text.lower())


def _split_sentences(text: str) -> List[str]:
    parts = SENTENCE_SPLIT_RE.split(text)
    return [part.strip() for part in parts if part.strip()]


def _mean(values: List[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _stdev(values: List[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = _mean(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)


def _count_fillers(tokens: List[str]) -> int:
    filler_count = 0
    for token in tokens:
        if token in FILLER_WORDS:
            filler_count += 1
    if len(tokens) >= 2:
        for i in range(len(tokens) - 1):
            if (tokens[i], tokens[i + 1]) in FILLER_PHRASES:
                filler_count += 1
    return filler_count


def _most_common_non_stopwords(tokens: List[str], limit: int = 3) -> List[Tuple[str, int]]:
    counts: Dict[str, int] = {}
    for token in tokens:
        if token in STOPWORDS:
            continue
        if token in FILLER_WORDS:
            continue
        counts[token] = counts.get(token, 0) + 1
    items = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return items[:limit]


def _extract_pause_durations_from_words(
    words: List[Dict[str, Any]],
    pause_threshold: float,
) -> Tuple[List[float], Optional[float], Optional[float]]:
    if not words:
        return [], None, None
    words_sorted = sorted(words, key=lambda w: w["start"])
    pauses: List[float] = []
    total_duration = max(0.0, words_sorted[-1]["end"] - words_sorted[0]["start"])
    talking_time = 0.0

    prev_end = words_sorted[0]["end"]
    for w in words_sorted:
        start = w["start"]
        end = w["end"]
        talking_time += max(0.0, end - start)
        gap = start - prev_end
        if gap >= pause_threshold:
            pauses.append(gap)
        prev_end = max(prev_end, end)
    return pauses, total_duration, talking_time


def _extract_pause_durations_from_segments(
    segments: List[Dict[str, Any]],
    pause_threshold: float,
) -> Tuple[List[float], Optional[float]]:
    if not segments:
        return [], None
    segments_sorted = sorted(segments, key=lambda s: s["start"])
    pauses: List[float] = []
    total_duration = max(0.0, segments_sorted[-1]["end"] - segments_sorted[0]["start"])
    prev_end = segments_sorted[0]["end"]
    for seg in segments_sorted[1:]:
        gap = seg["start"] - prev_end
        if gap >= pause_threshold:
            pauses.append(gap)
        prev_end = max(prev_end, seg["end"])
    return pauses, total_duration


@dataclass
class LinearFeedbackModel:
    weights: Dict[str, float]
    bias: float = 0.0

    def predict(self, features: Dict[str, float]) -> float:
        score = self.bias
        for key, weight in self.weights.items():
            score += features.get(key, 0.0) * weight
        return score


DEFAULT_MODEL = LinearFeedbackModel(
    weights={
        "filler_rate": -3.5,
        "unique_word_ratio": 1.2,
        "avg_sentence_length": -0.03,
        "sentence_length_std": -0.02,
        "pause_rate_per_min": -0.08,
        "long_pause_ratio": -1.2,
        "speaking_rate_wpm": 0.01,
        "repetition_rate": -2.5,
    },
    bias=0.2,
)


def extract_features(
    text: str,
    word_items: Optional[List[Dict[str, Any]]] = None,
    segments: Optional[List[Dict[str, Any]]] = None,
    pause_threshold: float = 0.35,
    long_pause_threshold: float = 1.5,
) -> Tuple[Dict[str, float], Dict[str, Any], List[str]]:
    warnings: List[str] = []
    tokens = _tokenize(text)
    total_words = len(tokens)

    filler_count = _count_fillers(tokens)
    filler_rate = (filler_count / total_words) if total_words else 0.0
    unique_word_ratio = (len(set(tokens)) / total_words) if total_words else 0.0

    sentences = _split_sentences(text)
    sentence_lengths = [len(_tokenize(sentence)) for sentence in sentences if sentence]
    avg_sentence_length = _mean(sentence_lengths)
    sentence_length_std = _stdev(sentence_lengths)

    repetition_count = 0
    for i in range(1, len(tokens)):
        if tokens[i] == tokens[i - 1]:
            repetition_count += 1
    repetition_rate = (repetition_count / total_words) if total_words else 0.0

    pauses: List[float] = []
    total_duration: Optional[float] = None
    talking_time: Optional[float] = None
    if word_items:
        pauses, total_duration, talking_time = _extract_pause_durations_from_words(
            word_items,
            pause_threshold=pause_threshold,
        )
    elif segments:
        pauses, total_duration = _extract_pause_durations_from_segments(
            segments,
            pause_threshold=pause_threshold,
        )
    else:
        warnings.append("No timestamps provided; pause metrics and speaking rate are unavailable.")

    pause_count = len(pauses)
    avg_pause = _mean(pauses)
    long_pause_count = len([p for p in pauses if p >= long_pause_threshold])
    long_pause_ratio = (long_pause_count / pause_count) if pause_count else 0.0

    pause_rate_per_min = 0.0
    speaking_rate_wpm = 0.0
    if total_duration and total_duration > 0.0:
        pause_rate_per_min = pause_count / (total_duration / 60.0)
        speaking_rate_wpm = total_words / (total_duration / 60.0)
    else:
        if not warnings:
            warnings.append("Speech duration was not available to compute pace metrics.")

    features = {
        "filler_rate": filler_rate,
        "unique_word_ratio": unique_word_ratio,
        "avg_sentence_length": avg_sentence_length,
        "sentence_length_std": sentence_length_std,
        "pause_rate_per_min": pause_rate_per_min,
        "long_pause_ratio": long_pause_ratio,
        "speaking_rate_wpm": speaking_rate_wpm,
        "repetition_rate": repetition_rate,
    }

    metrics: Dict[str, Any] = {
        "total_words": total_words,
        "filler_count": filler_count,
        "filler_rate": round(filler_rate, 4),
        "unique_word_ratio": round(unique_word_ratio, 4),
        "avg_sentence_length": round(avg_sentence_length, 2),
        "sentence_length_std": round(sentence_length_std, 2),
        "repetition_rate": round(repetition_rate, 4),
        "pause_count": pause_count,
        "avg_pause_seconds": round(avg_pause, 3),
        "long_pause_ratio": round(long_pause_ratio, 4),
        "pause_rate_per_min": round(pause_rate_per_min, 3),
        "speaking_rate_wpm": round(speaking_rate_wpm, 2),
        "total_duration_seconds": round(total_duration, 3) if total_duration is not None else None,
        "talking_time_seconds": round(talking_time, 3) if talking_time is not None else None,
    }

    return features, metrics, warnings


def generate_feedback(
    text: str,
    word_items: Optional[List[Dict[str, Any]]] = None,
    segments: Optional[List[Dict[str, Any]]] = None,
    model: LinearFeedbackModel = DEFAULT_MODEL,
) -> Dict[str, Any]:
    features, metrics, warnings = extract_features(
        text=text,
        word_items=word_items,
        segments=segments,
    )

    raw_score = model.predict(features)
    score = 100.0 / (1.0 + math.exp(-raw_score))

    feedback: List[str] = []

    if metrics["filler_rate"] > 0.05:
        feedback.append(
            "Filler word usage is high. Try replacing 'um/uh/like' with brief silent pauses."
        )
    if metrics["unique_word_ratio"] < 0.45 and metrics["total_words"] >= 60:
        feedback.append(
            "Vocabulary variety is low. Rephrase key points to avoid repeating the same words."
        )
    if metrics["avg_sentence_length"] > 25:
        feedback.append(
            "Sentences are long. Break them into shorter, clearer statements."
        )
    if 0 < metrics["avg_sentence_length"] < 8:
        feedback.append(
            "Sentences are very short. Add a bit more detail to show depth."
        )
    if metrics["speaking_rate_wpm"] > 180:
        feedback.append(
            "Pace is fast. Slow down slightly so the interviewer can follow key points."
        )
    if 0 < metrics["speaking_rate_wpm"] < 110:
        feedback.append(
            "Pace is slow. Aim for a slightly faster delivery to sound confident."
        )
    if metrics["pause_rate_per_min"] > 18 and metrics["long_pause_ratio"] > 0.2:
        feedback.append(
            "Pauses are frequent and long. Plan the next idea before speaking to reduce long gaps."
        )
    if metrics["repetition_rate"] > 0.03:
        feedback.append(
            "Repeated words appear often. Try varying phrasing to sound more polished."
        )

    common_words = _most_common_non_stopwords(_tokenize(text))
    if common_words:
        word_list = ", ".join([f"{word} ({count})" for word, count in common_words])
        feedback.append(f"Most repeated content words: {word_list}.")

    if not feedback:
        feedback.append("Speech pattern looks solid. Keep your pace and clarity consistent.")

    return {
        "score": round(score, 2),
        "metrics": metrics,
        "feedback": feedback,
        "warnings": warnings,
    }
