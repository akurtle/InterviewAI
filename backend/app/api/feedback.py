from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.analysis.response_feedback import evaluate_question_responses
from app.analysis.speech_feedback import generate_feedback
from app.analysis.video_feedback import generate_video_feedback
from app.speech_models import SpeechFeedbackResponse, SpeechSample
from app.video_models import VideoFeedbackResponse, VideoSample


router = APIRouter(tags=["feedback"])


@router.post("/speech/feedback", response_model=SpeechFeedbackResponse)
async def speech_feedback(sample: SpeechSample):
    if (
        not sample.text
        and not sample.words
        and not sample.segments
        and not sample.question_responses
    ):
        raise HTTPException(
            status_code=400,
            detail="Provide text, words, segments, or question responses.",
        )

    text = sample.text or ""
    if not text:
        if sample.words:
            text = " ".join([item.word for item in sample.words])
        elif sample.segments:
            text = " ".join([item.text for item in sample.segments])
        elif sample.question_responses:
            text = " ".join(
                [
                    item.answer_text
                    for item in sample.question_responses
                    if item.answer_text and item.answer_text.strip() and item.answer_text.strip() != "--"
                ]
            )

    word_items = None
    if sample.words:
        word_items = [
            {"word": item.word, "start": item.start, "end": item.end}
            for item in sample.words
        ]

    segment_items = None
    if sample.segments:
        segment_items = [
            {"text": item.text, "start": item.start, "end": item.end}
            for item in sample.segments
        ]

    feedback = generate_feedback(text=text, word_items=word_items, segments=segment_items)
    response_evaluation = evaluate_question_responses(
        [
            {
                "index": item.index,
                "question": item.question,
                "category": item.category,
                "answer_text": item.answer_text,
            }
            for item in (sample.question_responses or [])
        ]
    )

    return {
        **feedback,
        **response_evaluation,
    }


@router.post("/video/feedback", response_model=VideoFeedbackResponse)
async def video_feedback(sample: VideoSample):
    if not sample.frames:
        raise HTTPException(status_code=400, detail="Provide at least one frame.")

    frames = [
        {
            "timestamp": frame.timestamp,
            "face_present": frame.face_present,
            "looking_at_camera": frame.looking_at_camera,
            "smile_prob": frame.smile_prob,
            "head_yaw": frame.head_yaw,
            "head_pitch": frame.head_pitch,
            "mouth_open_ratio": frame.mouth_open_ratio,
            "mouth_movement_delta": frame.mouth_movement_delta,
            "articulation_active": frame.articulation_active,
        }
        for frame in sample.frames
    ]

    return generate_video_feedback(frames=frames)
