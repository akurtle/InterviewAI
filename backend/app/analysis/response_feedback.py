from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional, Tuple


WORD_RE = re.compile(r"[a-zA-Z0-9']+")

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
    "can",
    "describe",
    "did",
    "do",
    "for",
    "from",
    "had",
    "has",
    "have",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "of",
    "on",
    "or",
    "should",
    "tell",
    "that",
    "the",
    "through",
    "to",
    "walk",
    "what",
    "where",
    "who",
    "why",
    "with",
    "would",
    "you",
    "your",
}

DETAIL_MARKERS = {
    "because",
    "example",
    "impact",
    "improved",
    "increased",
    "launched",
    "metric",
    "outcome",
    "reduced",
    "result",
    "shipped",
}

TRANSITION_MARKERS = {
    "after",
    "because",
    "before",
    "finally",
    "first",
    "next",
    "result",
    "so",
    "then",
}

BEHAVIORAL_MARKERS = {
    "challenge",
    "learned",
    "managed",
    "owned",
    "resolved",
    "result",
    "situation",
    "task",
}

SYSTEM_DESIGN_MARKERS = {
    "api",
    "cache",
    "database",
    "latency",
    "queue",
    "retry",
    "scaling",
    "throughput",
    "tradeoff",
}

SALES_MARKERS = {
    "budget",
    "customer",
    "objection",
    "pain",
    "stakeholder",
    "timeline",
    "value",
    "workflow",
}

PRESENTATION_MARKERS = {
    "audience",
    "goal",
    "message",
    "objection",
    "story",
    "takeaway",
}

DEFAULT_WORD_RANGES = {
    "behavioral": (55, 190),
    "system_design": (70, 240),
    "technical": (55, 200),
    "sales": (45, 170),
    "presentation": (45, 170),
    "context": (35, 140),
    "general": (45, 170),
}


def _tokenize(text: str) -> List[str]:
    return WORD_RE.findall(text.lower())


def _normalize_category(category: Optional[str], question: str) -> str:
    normalized = (category or "").strip().lower().replace(" ", "_")
    question_lower = question.lower()

    if normalized:
        if "behavior" in normalized:
            return "behavioral"
        if "system" in normalized or "design" in normalized:
            return "system_design"
        if "sales" in normalized:
            return "sales"
        if "presentation" in normalized or "pitch" in normalized:
            return "presentation"
        if normalized in DEFAULT_WORD_RANGES:
            return normalized
        if "technical" in normalized:
            return "technical"

    if "tell me about a time" in question_lower or "describe a situation" in question_lower:
        return "behavioral"
    if question_lower.startswith("design ") or "design a " in question_lower:
        return "system_design"
    if any(marker in question_lower for marker in ["workflow", "budget", "decision-making", "pain point"]):
        return "sales"
    if any(marker in question_lower for marker in ["presentation", "pitch", "audience", "takeaway"]):
        return "presentation"
    if "why are you interested" in question_lower:
        return "context"
    return "technical"


def _extract_question_keywords(question: str) -> List[str]:
    tokens = _tokenize(question)
    keywords: List[str] = []
    seen = set()
    for token in tokens:
        if token in STOPWORDS or len(token) < 4:
            continue
        if token not in seen:
            seen.add(token)
            keywords.append(token)
        if len(keywords) >= 6:
            break
    return keywords


def _score_completeness(word_count: int, expected_min: int, expected_max: int) -> float:
    if word_count <= 0:
        return 0.0
    if word_count < expected_min:
        return max(20.0, 100.0 * (word_count / expected_min))
    if word_count <= expected_max:
        return 100.0

    overflow = word_count - expected_max
    penalty_window = max(expected_max - expected_min, 40)
    penalty_ratio = min(overflow / penalty_window, 1.0)
    return max(55.0, 100.0 - penalty_ratio * 45.0)


def _sentence_count(answer_text: str) -> int:
    chunks = re.split(r"[.!?]+", answer_text)
    return len([chunk for chunk in chunks if chunk.strip()])


def _count_matches(tokens: List[str], vocabulary: set[str]) -> int:
    return sum(1 for token in tokens if token in vocabulary)


def _score_specificity(answer_text: str, tokens: List[str]) -> Tuple[float, Dict[str, Any]]:
    total_words = len(tokens)
    unique_ratio = (len(set(tokens)) / total_words) if total_words else 0.0
    long_word_ratio = (
        len([token for token in tokens if len(token) >= 7]) / total_words if total_words else 0.0
    )
    numeric_mentions = len(re.findall(r"\b\d+(?:\.\d+)?%?\b", answer_text))
    detail_hits = _count_matches(tokens, DETAIL_MARKERS)

    score = (
        32.0
        + min(unique_ratio / 0.72, 1.0) * 28.0
        + min(long_word_ratio / 0.18, 1.0) * 16.0
        + min(numeric_mentions, 3) * 8.0
        + min(detail_hits, 3) * 7.0
    )

    return min(score, 100.0), {
        "unique_word_ratio": round(unique_ratio, 4),
        "long_word_ratio": round(long_word_ratio, 4),
        "numeric_mentions": numeric_mentions,
        "detail_markers": detail_hits,
    }


def _score_structure(style: str, answer_text: str, tokens: List[str]) -> Tuple[float, Dict[str, Any]]:
    sentences = _sentence_count(answer_text)
    transition_hits = _count_matches(tokens, TRANSITION_MARKERS)
    marker_hits = 0

    if style == "behavioral":
        marker_hits = _count_matches(tokens, BEHAVIORAL_MARKERS)
    elif style == "system_design":
        marker_hits = _count_matches(tokens, SYSTEM_DESIGN_MARKERS)
    elif style == "sales":
        marker_hits = _count_matches(tokens, SALES_MARKERS)
    elif style == "presentation":
        marker_hits = _count_matches(tokens, PRESENTATION_MARKERS)

    sentence_score = 100.0 if 2 <= sentences <= 5 else 65.0 if sentences == 1 else 78.0
    score = min(
        100.0,
        sentence_score + min(transition_hits, 3) * 7.0 + min(marker_hits, 3) * 6.0,
    )

    return score, {
        "sentence_count": sentences,
        "transition_markers": transition_hits,
        "structure_markers": marker_hits,
    }


def _score_relevance(style: str, question: str, answer_text: str, tokens: List[str]) -> Tuple[float, Dict[str, Any]]:
    question_keywords = _extract_question_keywords(question)
    answer_token_set = set(tokens)
    keyword_matches = len([token for token in question_keywords if token in answer_token_set])
    keyword_overlap = (
        keyword_matches / len(question_keywords) if question_keywords else 0.0
    )
    example_signal = 1.0 if re.search(r"\b(for example|for instance|when i|i once|on one project)\b", answer_text.lower()) else 0.0

    if style == "behavioral":
        base = 38.0 + keyword_overlap * 32.0 + example_signal * 20.0
    elif style == "system_design":
        architecture_hits = _count_matches(tokens, SYSTEM_DESIGN_MARKERS)
        base = 30.0 + keyword_overlap * 52.0 + min(architecture_hits, 3) * 5.0
    elif style == "sales":
        discovery_hits = _count_matches(tokens, SALES_MARKERS)
        base = 34.0 + keyword_overlap * 46.0 + min(discovery_hits, 3) * 5.0
    elif style == "presentation":
        presentation_hits = _count_matches(tokens, PRESENTATION_MARKERS)
        base = 34.0 + keyword_overlap * 46.0 + min(presentation_hits, 3) * 5.0
    else:
        base = 32.0 + keyword_overlap * 55.0

    if len(tokens) < 12:
        base = min(base, 58.0)

    return min(base, 100.0), {
        "question_keywords": question_keywords,
        "matched_question_keywords": keyword_matches,
        "keyword_overlap": round(keyword_overlap, 4),
    }


def _summarize_review(score: float, style: str) -> str:
    if score >= 85:
        return "Strong answer that addresses the question directly and adds useful detail."
    if score >= 70:
        return "Solid answer with a clear point, but it could be sharper or more concrete."
    if score >= 55:
        return "Partially effective answer, but it needs more depth or tighter alignment to the prompt."
    if style == "behavioral":
        return "The answer is too thin for a behavioral question and needs a clearer example plus outcome."
    return "The answer does not yet address the prompt clearly enough to feel convincing."


def _feedback_for_style(style: str, dimension: str) -> str:
    if dimension == "completeness":
        if style == "behavioral":
            return "Add the situation, the action you took, and the result to make the story complete."
        if style == "system_design":
            return "Cover the main components, tradeoffs, and scaling constraints in more depth."
        if style in {"sales", "presentation"}:
            return "Add the audience need, your approach, and the expected outcome."
        return "Expand the answer with one concrete example or decision so it feels complete."
    if dimension == "specificity":
        return "Add concrete details such as metrics, tools, constraints, or measurable outcomes."
    if dimension == "structure":
        if style == "behavioral":
            return "Use a clearer sequence so the listener can follow the situation, action, and result."
        return "Open with a direct answer, then support it with a short example or tradeoff."
    return "Answer the prompt more directly and reuse the key topic from the question."


def _build_review_feedback(
    style: str,
    completeness: float,
    specificity: float,
    structure: float,
    relevance: float,
) -> Tuple[List[str], List[str]]:
    strengths: List[str] = []
    improvements: List[str] = []

    if relevance >= 75:
        strengths.append("You addressed the prompt directly instead of circling around it.")
    if completeness >= 80:
        strengths.append("The answer had enough depth to feel substantive.")
    if specificity >= 78:
        strengths.append("Concrete detail made the answer more believable.")
    if structure >= 78:
        strengths.append("The answer followed a clear flow that is easy to follow.")

    if relevance < 65:
        improvements.append(_feedback_for_style(style, "relevance"))
    if completeness < 65:
        improvements.append(_feedback_for_style(style, "completeness"))
    if specificity < 65:
        improvements.append(_feedback_for_style(style, "specificity"))
    if structure < 65:
        improvements.append(_feedback_for_style(style, "structure"))

    if not strengths:
        strengths.append("The answer gives you a usable starting point to refine further.")
    if not improvements:
        improvements.append("Keep the same structure, but tighten phrasing and add one more concrete detail.")

    return strengths[:2], improvements[:2]


def evaluate_question_responses(
    question_responses: Optional[List[Dict[str, Any]]],
) -> Dict[str, Any]:
    if not question_responses:
        return {
            "response_score": None,
            "response_metrics": {},
            "response_feedback": [],
            "question_reviews": [],
        }

    question_reviews: List[Dict[str, Any]] = []
    dimension_totals = {
        "relevance": 0.0,
        "completeness": 0.0,
        "specificity": 0.0,
        "structure": 0.0,
    }
    word_counts: List[int] = []

    for item in question_responses:
        answer_text = str(item.get("answer_text", "")).strip()
        question = str(item.get("question", "")).strip()
        if not question or not answer_text or answer_text == "--":
            continue

        category = item.get("category")
        style = _normalize_category(str(category) if category is not None else None, question)
        expected_min, expected_max = DEFAULT_WORD_RANGES.get(style, DEFAULT_WORD_RANGES["general"])
        tokens = _tokenize(answer_text)
        word_count = len(tokens)
        word_counts.append(word_count)

        completeness = _score_completeness(word_count, expected_min, expected_max)
        specificity, specificity_metrics = _score_specificity(answer_text, tokens)
        structure, structure_metrics = _score_structure(style, answer_text, tokens)
        relevance, relevance_metrics = _score_relevance(style, question, answer_text, tokens)

        score = (
            relevance * 0.35
            + completeness * 0.25
            + specificity * 0.25
            + structure * 0.15
        )
        score = max(0.0, min(100.0, score))

        strengths, improvements = _build_review_feedback(
            style=style,
            completeness=completeness,
            specificity=specificity,
            structure=structure,
            relevance=relevance,
        )

        metrics: Dict[str, Any] = {
            "style": style,
            "word_count": word_count,
            "expected_min_words": expected_min,
            "expected_max_words": expected_max,
        }
        metrics.update(specificity_metrics)
        metrics.update(structure_metrics)
        metrics.update(relevance_metrics)

        dimension_scores = {
            "relevance": round(relevance, 2),
            "completeness": round(completeness, 2),
            "specificity": round(specificity, 2),
            "structure": round(structure, 2),
        }

        for key, value in dimension_scores.items():
            dimension_totals[key] += value

        question_reviews.append(
            {
                "index": int(item.get("index", len(question_reviews))),
                "question": question,
                "category": category,
                "answer_text": answer_text,
                "score": round(score, 2),
                "summary": _summarize_review(score, style),
                "strengths": strengths,
                "improvements": improvements,
                "metrics": metrics,
                "dimension_scores": dimension_scores,
            }
        )

    if not question_reviews:
        return {
            "response_score": None,
            "response_metrics": {},
            "response_feedback": [],
            "question_reviews": [],
        }

    review_count = len(question_reviews)
    response_score = round(sum(review["score"] for review in question_reviews) / review_count, 2)
    avg_word_count = round(sum(word_counts) / len(word_counts), 1) if word_counts else 0.0
    averaged_dimensions = {
        key: round(total / review_count, 2) for key, total in dimension_totals.items()
    }

    response_feedback: List[str] = []
    if averaged_dimensions["relevance"] < 70:
        response_feedback.append(
            "Several answers drift away from the exact prompt. Lead with a direct answer before expanding."
        )
    if averaged_dimensions["specificity"] < 70:
        response_feedback.append(
            "Across answers, add more evidence such as metrics, concrete constraints, or named tools."
        )
    if averaged_dimensions["structure"] < 70:
        response_feedback.append(
            "Your answer flow is inconsistent. Use a predictable structure so each response lands faster."
        )
    if averaged_dimensions["completeness"] < 70:
        response_feedback.append(
            "Some answers end too early. Add one more layer of detail so each response feels complete."
        )
    if not response_feedback:
        response_feedback.append(
            "Your responses are generally well aligned to the questions and have solid depth."
        )

    response_metrics = {
        "reviewed_questions": review_count,
        "avg_answer_word_count": avg_word_count,
        "avg_relevance": averaged_dimensions["relevance"],
        "avg_completeness": averaged_dimensions["completeness"],
        "avg_specificity": averaged_dimensions["specificity"],
        "avg_structure": averaged_dimensions["structure"],
        "score_stddev": round(
            math.sqrt(
                sum((review["score"] - response_score) ** 2 for review in question_reviews)
                / review_count
            ),
            2,
        ),
    }

    return {
        "response_score": response_score,
        "response_metrics": response_metrics,
        "response_feedback": response_feedback,
        "question_reviews": sorted(question_reviews, key=lambda review: review["index"]),
    }
