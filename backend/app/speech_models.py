from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


class WordTimestamp(BaseModel):
    word: str = Field(..., description="Recognized word token.")
    start: float = Field(..., description="Start time in seconds.")
    end: float = Field(..., description="End time in seconds.")


class SegmentTimestamp(BaseModel):
    text: str = Field(..., description="Full segment text.")
    start: float = Field(..., description="Segment start time in seconds.")
    end: float = Field(..., description="Segment end time in seconds.")


class SpeechSample(BaseModel):
    text: Optional[str] = Field(None, description="Full transcript text.")
    words: Optional[List[WordTimestamp]] = Field(
        None, description="Optional word-level timestamps."
    )
    segments: Optional[List[SegmentTimestamp]] = Field(
        None, description="Optional segment-level timestamps."
    )


class SpeechFeedbackResponse(BaseModel):
    score: float
    metrics: Dict[str, Any]
    feedback: List[str]
    warnings: List[str]
