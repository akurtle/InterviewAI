from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any, Dict, List, Optional, Tuple


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


@dataclass
class LinearVideoFeedbackModel:
    weights: Dict[str, float]
    bias: float = 0.0

    def predict(self, features: Dict[str, float]) -> float:
        score = self.bias
        for key, weight in self.weights.items():
            score += features.get(key, 0.0) * weight
        return score


DEFAULT_VIDEO_MODEL = LinearVideoFeedbackModel(
    weights={
        "face_presence_rate": 2.0,
        "gaze_at_camera_rate": 2.5,
        "smile_rate": 1.2,
        "avg_smile_prob": 1.5,
        "head_movement_std": -0.4,
        "long_gaze_break_rate": -1.4,
        "avg_mouth_open_ratio": 3.6,
        "articulation_active_rate": 1.8,
        "avg_mouth_movement_delta": 4.5,
    },
    bias=0.1,
)


def _extract_gaze_breaks(
    frames: List[Dict[str, Any]],
    break_threshold: float,
) -> Tuple[int, int]:
    if not frames:
        return 0, 0
    frames_sorted = sorted(frames, key=lambda f: f["timestamp"])
    breaks = 0
    break_frames = 0
    in_break = False
    break_start = 0.0

    for frame in frames_sorted:
        if not frame.get("face_present", True):
            looking = False
        else:
            looking = bool(frame.get("looking_at_camera", False))
        ts = float(frame["timestamp"])

        if not looking:
            if not in_break:
                in_break = True
                break_start = ts
            break_frames += 1
        else:
            if in_break:
                if ts - break_start >= break_threshold:
                    breaks += 1
                in_break = False
    return breaks, break_frames


def extract_video_features(
    frames: List[Dict[str, Any]],
    long_gaze_break_threshold: float = 2.0,
) -> Tuple[Dict[str, float], Dict[str, Any], List[str]]:
    warnings: List[str] = []
    if not frames:
        warnings.append("No video frames provided.")
        return (
            {
                "face_presence_rate": 0.0,
                "gaze_at_camera_rate": 0.0,
                "smile_rate": 0.0,
                "avg_smile_prob": 0.0,
                "head_movement_std": 0.0,
                "long_gaze_break_rate": 0.0,
                "avg_mouth_open_ratio": 0.0,
                "articulation_active_rate": 0.0,
                "avg_mouth_movement_delta": 0.0,
            },
            {
                "frame_count": 0,
            },
            warnings,
        )

    frames_sorted = sorted(frames, key=lambda f: f["timestamp"])
    frame_count = len(frames_sorted)

    face_present = [1.0 for f in frames_sorted if f.get("face_present", True)]
    face_presence_rate = len(face_present) / frame_count if frame_count else 0.0

    looking = [
        1.0
        for f in frames_sorted
        if f.get("face_present", True) and f.get("looking_at_camera", False)
    ]
    gaze_at_camera_rate = len(looking) / frame_count if frame_count else 0.0

    smile_probs = []
    for f in frames_sorted:
        if not f.get("face_present", True):
            continue
        value = f.get("smile_prob", 0.0)
        if value is None:
            value = 0.0
        smile_probs.append(float(value))
    avg_smile_prob = _mean(smile_probs)
    smile_rate = len([p for p in smile_probs if p >= 0.6]) / frame_count if frame_count else 0.0

    yaw = []
    pitch = []
    for f in frames_sorted:
        if not f.get("face_present", True):
            continue
        yaw_value = f.get("head_yaw", 0.0)
        pitch_value = f.get("head_pitch", 0.0)
        if yaw_value is None:
            yaw_value = 0.0
        if pitch_value is None:
            pitch_value = 0.0
        yaw.append(float(yaw_value))
        pitch.append(float(pitch_value))
    head_movement_std = _mean([_stdev(yaw), _stdev(pitch)])

    long_breaks, break_frames = _extract_gaze_breaks(
        frames_sorted, break_threshold=long_gaze_break_threshold
    )
    long_gaze_break_rate = long_breaks / (frame_count / 30.0) if frame_count else 0.0

    mouth_open_ratios = []
    mouth_movement_deltas = []
    articulation_samples = []
    for f in frames_sorted:
        if not f.get("face_present", True):
            continue

        mouth_open_value = f.get("mouth_open_ratio")
        if mouth_open_value is not None:
            mouth_open_ratios.append(float(mouth_open_value))

        mouth_delta_value = f.get("mouth_movement_delta")
        if mouth_delta_value is not None:
            mouth_movement_deltas.append(float(mouth_delta_value))

        articulation_value = f.get("articulation_active")
        if articulation_value is not None:
            articulation_samples.append(1.0 if bool(articulation_value) else 0.0)

    avg_mouth_open_ratio = _mean(mouth_open_ratios)
    articulation_active_rate = _mean(articulation_samples)
    avg_mouth_movement_delta = _mean(mouth_movement_deltas)

    features = {
        "face_presence_rate": face_presence_rate,
        "gaze_at_camera_rate": gaze_at_camera_rate,
        "smile_rate": smile_rate,
        "avg_smile_prob": avg_smile_prob,
        "head_movement_std": head_movement_std,
        "long_gaze_break_rate": long_gaze_break_rate,
        "avg_mouth_open_ratio": avg_mouth_open_ratio,
        "articulation_active_rate": articulation_active_rate,
        "avg_mouth_movement_delta": avg_mouth_movement_delta,
    }

    metrics: Dict[str, Any] = {
        "frame_count": frame_count,
        "face_presence_rate": round(face_presence_rate, 4),
        "gaze_at_camera_rate": round(gaze_at_camera_rate, 4),
        "smile_rate": round(smile_rate, 4),
        "avg_smile_prob": round(avg_smile_prob, 4),
        "head_movement_std": round(head_movement_std, 4),
        "long_gaze_break_rate": round(long_gaze_break_rate, 4),
        "long_gaze_breaks": long_breaks,
        "gaze_break_frames": break_frames,
        "mouth_frame_count": len(mouth_open_ratios),
        "avg_mouth_open_ratio": round(avg_mouth_open_ratio, 4),
        "avg_mouth_movement_delta": round(avg_mouth_movement_delta, 4),
        "articulation_active_rate": round(articulation_active_rate, 4),
    }

    return features, metrics, warnings


def generate_video_feedback(
    frames: List[Dict[str, Any]],
    model: LinearVideoFeedbackModel = DEFAULT_VIDEO_MODEL,
) -> Dict[str, Any]:
    features, metrics, warnings = extract_video_features(frames=frames)
    raw_score = model.predict(features)
    score = 100.0 / (1.0 + math.exp(-raw_score))

    feedback: List[str] = []
    if metrics.get("face_presence_rate", 0.0) < 0.9:
        feedback.append("Face visibility drops often. Center yourself in the frame.")
    if metrics.get("gaze_at_camera_rate", 0.0) < 0.6:
        feedback.append("Eye contact is low. Look at the camera while speaking.")
    if metrics.get("long_gaze_breaks", 0) > 0:
        feedback.append("Long gaze breaks detected. Return to the camera more consistently.")
    if metrics.get("avg_smile_prob", 0.0) < 0.2:
        feedback.append("Facial warmth is low. Add a natural smile at key moments.")
    if metrics.get("head_movement_std", 0.0) > 12:
        feedback.append("Head movement is high. Keep posture steady for clarity.")
    if metrics.get("mouth_frame_count", 0) > 0 and metrics.get("avg_mouth_open_ratio", 0.0) < 0.12:
        feedback.append(
            "Mouth opening stays fairly small. Open a bit wider on vowels so your words look more distinct."
        )
    if metrics.get("mouth_frame_count", 0) > 0 and metrics.get("avg_mouth_movement_delta", 0.0) < 0.018:
        feedback.append(
            "Lip movement is subtle. Try slightly stronger articulation on consonants and stressed words."
        )
    if metrics.get("mouth_frame_count", 0) > 0 and metrics.get("articulation_active_rate", 0.0) < 0.35:
        feedback.append(
            "Visible articulation is limited for much of the session. Keep your jaw and lips more engaged while speaking."
        )

    if not feedback:
        feedback.append(
            "Video presence looks solid. Keep steady eye contact, posture, and clear mouth movement."
        )

    return {
        "score": round(score, 2),
        "metrics": metrics,
        "feedback": feedback,
        "warnings": warnings,
    }
