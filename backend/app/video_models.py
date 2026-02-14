from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


class VideoFrame(BaseModel):
    timestamp: float = Field(..., description="Frame time in seconds.")
    face_present: bool = Field(True, description="Whether a face is detected.")
    looking_at_camera: bool = Field(False, description="True if gaze is at camera.")
    smile_prob: float = Field(0.0, description="Smile probability 0..1.")
    head_yaw: Optional[float] = Field(None, description="Yaw angle in degrees.")
    head_pitch: Optional[float] = Field(None, description="Pitch angle in degrees.")


class VideoSample(BaseModel):
    frames: List[VideoFrame] = Field(..., description="List of frame-level measurements.")


class VideoFeedbackResponse(BaseModel):
    score: float
    metrics: Dict[str, Any]
    feedback: List[str]
    warnings: List[str]
