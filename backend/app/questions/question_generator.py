from __future__ import annotations

from typing import Dict, List, Tuple
import json
import urllib.request
import urllib.error
import time

from app.question_models import QuestionItem, QuestionRequest
from app.config import get_settings


INTERVIEW_BEHAVIORAL_QUESTIONS = [
    "Tell me about a time you had to handle conflicting priorities.",
    "Describe a situation where you disagreed with a teammate. What did you do?",
    "What’s a project you’re most proud of and why?",
    "Tell me about a time you made a mistake and how you handled it.",
    "Describe a time you had to learn something quickly to deliver a result.",
]

INTERVIEW_SYSTEM_DESIGN_QUESTIONS = [
    "Design a URL shortening service. What are the key components?",
    "Design an event-driven analytics pipeline for real-time metrics.",
    "How would you design a scalable notification system?",
    "Design a file upload service with resumable uploads and virus scanning.",
]

INTERVIEW_ROLE_TECHNICAL_QUESTIONS: Dict[str, List[str]] = {
    "backend": [
        "How do you design APIs for backward compatibility?",
        "Explain how you would model data for a multi-tenant system.",
        "What are common bottlenecks in web services and how do you address them?",
        "How do you handle idempotency in distributed systems?",
    ],
    "frontend": [
        "How do you optimize rendering performance in a large React app?",
        "Explain how you would manage global state in a complex UI.",
        "What are common causes of layout shift and how do you prevent them?",
        "How would you design an accessible component library?",
    ],
    "ml": [
        "How do you evaluate and monitor model drift in production?",
        "Explain a time you improved a model by changing the data pipeline.",
        "How do you balance precision and recall for a business goal?",
        "Describe how you would debug a model that performs well offline but poorly in production.",
    ],
    "data": [
        "How do you design a data model for analytics queries?",
        "Describe your approach to data quality checks in pipelines.",
        "How do you handle late-arriving data in batch systems?",
        "Explain how you would design a feature store.",
    ],
    "devops": [
        "How do you design CI/CD for safe, fast releases?",
        "Explain your approach to infrastructure monitoring and alerting.",
        "How do you handle secrets management across environments?",
        "Describe how you would implement blue/green deployments.",
    ],
    "general": [
        "Walk me through a project you shipped end-to-end.",
        "How do you approach debugging a production issue?",
        "What technical decision are you most proud of?",
    ],
}

SALES_CALL_QUESTIONS = [
    "Can you walk me through your current workflow and pain points?",
    "What would a successful outcome look like in 3 months?",
    "What tools are you using today, and what’s missing?",
    "Who else is involved in the decision-making process?",
    "What’s your timeline for evaluating solutions?",
    "What budget or constraints should we be aware of?",
]

PRESENTATION_QUESTIONS = [
    "What is the primary goal of this presentation?",
    "Who is the audience and what do they care about most?",
    "What is the single takeaway you want them to remember?",
    "What objections or questions do you expect?",
    "What supporting data or examples should be emphasized?",
    "How will success be measured after this presentation?",
]


def _detect_role(request: QuestionRequest) -> str:
    role_text = (request.role or "").lower()
    if any(k in role_text for k in ["backend", "api", "server", "fastapi", "django"]):
        return "backend"
    if any(k in role_text for k in ["frontend", "react", "ui", "ux"]):
        return "frontend"
    if any(k in role_text for k in ["machine learning", "ml", "model", "nlp", "vision"]):
        return "ml"
    if any(k in role_text for k in ["data", "analytics", "warehouse", "etl"]):
        return "data"
    if any(k in role_text for k in ["devops", "infra", "sre", "platform"]):
        return "devops"
    if not role_text.strip():
        return "general"
    return "backend"


def generate_questions(request: QuestionRequest) -> Tuple[List[QuestionItem], List[str], List[str]]:
    warnings: List[str] = []
    used_inputs: List[str] = []

    call_type = (request.call_type or "interview").strip().lower()
    role_key = _detect_role(request)

    used_inputs.append(f"call_type:{call_type}")
    used_inputs.append(f"role:{role_key}")

    questions: List[QuestionItem] = []

    settings = get_settings()
    api_key = settings.gemini_api_key
    if api_key:
        llm_questions, llm_warnings = _generate_questions_with_gemini(
            request=request,
            api_key=api_key,
            model=settings.gemini_model,
            api_url=settings.gemini_api_url,
        )
        warnings.extend(llm_warnings)
        if llm_questions:
            return llm_questions[: request.num_questions], warnings, used_inputs
    else:
        warnings.append("GEMINI_API_KEY not set. Falling back to local templates.")

    if call_type == "sales":
        for q in SALES_CALL_QUESTIONS:
            questions.append(QuestionItem(category="sales", question=q))
    elif call_type == "presentation":
        for q in PRESENTATION_QUESTIONS:
            questions.append(QuestionItem(category="presentation", question=q))
    else:
        for q in INTERVIEW_ROLE_TECHNICAL_QUESTIONS.get(role_key, INTERVIEW_ROLE_TECHNICAL_QUESTIONS["general"]):
            questions.append(QuestionItem(category="technical", question=q))
        for q in INTERVIEW_SYSTEM_DESIGN_QUESTIONS:
            questions.append(QuestionItem(category="system_design", question=q))
        for q in INTERVIEW_BEHAVIORAL_QUESTIONS:
            questions.append(QuestionItem(category="behavioral", question=q))

    if request.company:
        used_inputs.append(f"company:{request.company}")
        questions.append(
            QuestionItem(
                category="context",
                question=f"Why are you interested in {request.company}?",
            )
        )

    if len(questions) > request.num_questions:
        questions = questions[: request.num_questions]

    if not questions:
        questions = [
            QuestionItem(
                category="general",
                question="Tell me about yourself and what you want to improve.",
            )
        ]

    return questions, warnings, used_inputs


def _generate_questions_with_gemini(
    request: QuestionRequest,
    api_key: str,
    model: str,
    api_url: str,
) -> Tuple[List[QuestionItem], List[str]]:
    warnings: List[str] = []
    base_url = api_url or (
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    )

    system_prompt = (
        "You generate interview/sales/presentation questions. "
        "Return only valid JSON with the schema: "
        "{ \"questions\": [ {\"category\": string, \"question\": string} ] }."
    )
    user_prompt = {
        "role": request.role,
        "company": request.company,
        "call_type": request.call_type,
        "num_questions": request.num_questions,
    }

    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": system_prompt}]},
            {"role": "user", "parts": [{"text": json.dumps(user_prompt)}]},
        ],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 512,
        },
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}?key={api_key}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    raw = ""
    max_attempts = 3
    backoff = 0.5
    for attempt in range(1, max_attempts + 1):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8")
            break
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < max_attempts:
                time.sleep(backoff)
                backoff *= 2
                continue
            warnings.append(f"Gemini API HTTP error: {e.code}")
            return [], warnings
        except Exception:
            if attempt < max_attempts:
                time.sleep(backoff)
                backoff *= 2
                continue
            warnings.append("Gemini API request failed.")
            return [], warnings

    try:
        response = json.loads(raw)
        text = (
            response.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        json_text = _extract_json(text)
        parsed = json.loads(json_text)
        items = parsed.get("questions", [])
        results = []
        for item in items:
            question = str(item.get("question", "")).strip()
            category = str(item.get("category", "general")).strip() or "general"
            if question:
                results.append(QuestionItem(category=category, question=question))
        return results, warnings
    except Exception:
        warnings.append("Gemini response could not be parsed as JSON.")
        return [], warnings


def _extract_json(text: str) -> str:
    trimmed = text.strip()
    if trimmed.startswith("```"):
        trimmed = trimmed.strip("`")
    # Extract first JSON object
    start = trimmed.find("{")
    end = trimmed.rfind("}")
    if start >= 0 and end > start:
        return trimmed[start : end + 1]
    return trimmed
