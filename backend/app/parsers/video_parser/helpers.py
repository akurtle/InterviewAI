import asyncio
import json
import logging
import math
import re
import time
from typing import Any, Dict, Iterable

from fastapi import WebSocket

from app.realtime_state import ws_clients

try:
    import mediapipe as mp
except ImportError:  # pragma: no cover - optional dependency during local setup
    mp = None


logger = logging.getLogger(__name__)

VISION_SAMPLE_INTERVAL_SECONDS = 0.45
MOUTH_LEFT_INDEX = 61
MOUTH_RIGHT_INDEX = 291
MOUTH_TOP_INDEX = 13
MOUTH_BOTTOM_INDEX = 14
LEFT_EYE_INDEX = 33
RIGHT_EYE_INDEX = 263
NOSE_TIP_INDEX = 1


async def safe_send(session_id: str, message: Dict[str, Any]):
    ws = ws_clients.get(session_id)
    if ws:
        await ws.send_text(json.dumps(message))


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _distance(point_a: Any, point_b: Any) -> float:
    return math.hypot(point_a.x - point_b.x, point_a.y - point_b.y)


def _mean(values: Iterable[float]) -> float:
    numbers = list(values)
    if not numbers:
        return 0.0
    return sum(numbers) / len(numbers)


def _build_face_metrics(face_landmarks: Any, previous_mouth_ratio: float | None) -> Dict[str, float | bool | None]:
    landmarks = face_landmarks.landmark

    mouth_left = landmarks[MOUTH_LEFT_INDEX]
    mouth_right = landmarks[MOUTH_RIGHT_INDEX]
    mouth_top = landmarks[MOUTH_TOP_INDEX]
    mouth_bottom = landmarks[MOUTH_BOTTOM_INDEX]
    left_eye = landmarks[LEFT_EYE_INDEX]
    right_eye = landmarks[RIGHT_EYE_INDEX]
    nose_tip = landmarks[NOSE_TIP_INDEX]

    mouth_width = max(_distance(mouth_left, mouth_right), 1e-6)
    mouth_open_ratio = _distance(mouth_top, mouth_bottom) / mouth_width
    mouth_movement_delta = (
        None if previous_mouth_ratio is None else abs(mouth_open_ratio - previous_mouth_ratio)
    )

    eye_center_x = _mean([left_eye.x, right_eye.x])
    eye_center_y = _mean([left_eye.y, right_eye.y])
    mouth_center_y = _mean([mouth_top.y, mouth_bottom.y])
    eye_span = max(abs(right_eye.x - left_eye.x), 1e-6)
    vertical_span = max(abs(mouth_center_y - eye_center_y), 1e-6)

    head_yaw = _clamp(((nose_tip.x - eye_center_x) / eye_span) * 55.0, -30.0, 30.0)
    pitch_center = eye_center_y + vertical_span * 0.45
    head_pitch = _clamp(((nose_tip.y - pitch_center) / vertical_span) * 65.0, -20.0, 20.0)
    looking_at_camera = abs(head_yaw) <= 12.0 and abs(head_pitch) <= 10.0

    articulation_active = mouth_open_ratio >= 0.12 or (mouth_movement_delta or 0.0) >= 0.025

    return {
        "looking_at_camera": looking_at_camera,
        "head_yaw": round(head_yaw, 4),
        "head_pitch": round(head_pitch, 4),
        "mouth_open_ratio": round(mouth_open_ratio, 4),
        "mouth_movement_delta": None
        if mouth_movement_delta is None
        else round(mouth_movement_delta, 4),
        "articulation_active": articulation_active,
    }

# async def run_audio_pipeline(session_id: str, track):
#     audio_buffer = []
#     sample_rate = 16000
#     chunk_duration = 2.0  # 2 second chunks
#     overlap = 0.5  # 0.5 second overlap
    
#     chunk_samples = int(sample_rate * chunk_duration)
#     hop_samples = int(sample_rate * (chunk_duration - overlap))  # slide by 1.5s
#     import librosa
#     while True:
#         frame = await track.recv()
#         audio_np = frame.to_ndarray().flatten().astype(np.float32)
#         audio_16k = librosa.resample(audio_np, orig_sr=frame.sample_rate, target_sr=sample_rate)
        
#         audio_buffer.extend(audio_16k)
        
#         # Process when we have enough for a chunk
#         if len(audio_buffer) >= chunk_samples:
#             chunk = np.array(audio_buffer[:chunk_samples])
            
#             # Slide window by hop_samples instead of chunk_samples
#             audio_buffer = audio_buffer[hop_samples:]
            
#             # Skip if silent
#             rms = np.sqrt(np.mean(chunk**2))
#             if rms < 0.001:
#                 continue
            
#             # Transcribe with optimized settings
#             segments, info = await asyncio.to_thread(
#                 model.transcribe, 
#                 chunk,
#                 language="en",
#                 vad_filter=False,
#                 beam_size=1,
#                 best_of=1,     # disable sampling for speed
#                 temperature=0  # greedy decoding
#             )
            
#             for segment in list(segments):
#                 if segment.text.strip():  # skip empty
#                     print(f"✅ {segment.text}")
#                     await safe_send(session_id, {
#                         "type": "asr",
#                         "text": segment.text.strip()
#                     })
     

    
async def run_video_pipeline(session_id: str, track):
    await safe_send(
        session_id,
        {"type": "vision_status", "source": "server", "message": "Video track connected."},
    )

    if mp is None:
        await safe_send(
            session_id,
            {
                "type": "vision_status",
                "source": "server",
                "message": "MediaPipe is not installed, so backend mouth tracking is unavailable.",
            },
        )
        return

    face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    last_processed_at = 0.0
    previous_mouth_ratio: float | None = None

    try:
        while True:
            frame = await track.recv()
            now = time.monotonic()
            if now - last_processed_at < VISION_SAMPLE_INTERVAL_SECONDS:
                continue
            last_processed_at = now

            image = frame.to_ndarray(format="rgb24")
            results = await asyncio.to_thread(face_mesh.process, image)
            timestamp = getattr(frame, "time", None)
            frame_timestamp = float(timestamp) if isinstance(timestamp, (int, float)) else time.time()

            if not results.multi_face_landmarks:
                previous_mouth_ratio = None
                await safe_send(
                    session_id,
                    {
                        "type": "vision",
                        "source": "server",
                        "frame": {
                            "timestamp": frame_timestamp,
                            "face_present": False,
                            "looking_at_camera": False,
                            "smile_prob": None,
                            "head_yaw": None,
                            "head_pitch": None,
                            "mouth_open_ratio": None,
                            "mouth_movement_delta": None,
                            "articulation_active": None,
                        },
                    },
                )
                continue

            metrics = _build_face_metrics(
                results.multi_face_landmarks[0],
                previous_mouth_ratio=previous_mouth_ratio,
            )
            previous_mouth_ratio = (
                float(metrics["mouth_open_ratio"])
                if isinstance(metrics["mouth_open_ratio"], (int, float))
                else None
            )

            await safe_send(
                session_id,
                {
                    "type": "vision",
                    "source": "server",
                    "frame": {
                        "timestamp": frame_timestamp,
                        "face_present": True,
                        "looking_at_camera": metrics["looking_at_camera"],
                        "smile_prob": None,
                        "head_yaw": metrics["head_yaw"],
                        "head_pitch": metrics["head_pitch"],
                        "mouth_open_ratio": metrics["mouth_open_ratio"],
                        "mouth_movement_delta": metrics["mouth_movement_delta"],
                        "articulation_active": metrics["articulation_active"],
                    },
                },
            )
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Backend video pipeline crashed for session %s", session_id)
        await safe_send(
            session_id,
            {
                "type": "vision_status",
                "source": "server",
                "message": "Backend mouth tracking stopped unexpectedly.",
            },
        )
    finally:
        face_mesh.close()


async def send_results(ws: WebSocket, gen):
    last_sent_word_end = -1.0
    last_text = ""

    async for msg in gen:
        lines = getattr(msg, "lines", None)
        if not lines:
            continue

        for line in lines:
            text = (getattr(line, "text", "") or "").strip()
            end = getattr(line, "end", None)
            start = getattr(line, "start", None)

            if not text or end is None:
                continue

            words = re.findall(r"\S+", text)
            if not words:
                continue

            word_items = []

            # Prefer real word-level timestamps if available
            line_words = getattr(line, "words", None) or getattr(line, "word", None)
            if line_words:
                for w in line_words:
                    w_text = getattr(w, "word", None) or getattr(w, "text", None)
                    w_start = getattr(w, "start", None)
                    w_end = getattr(w, "end", None)
                    if w_text is None or w_start is None or w_end is None:
                        continue
                    if w_end <= last_sent_word_end:
                        continue
                    word_items.append(
                        {"word": w_text, "start": float(w_start), "end": float(w_end)}
                    )
            else:
                # Fallback: use text diff + approximate timestamps
                last_words = re.findall(r"\S+", last_text)
                prefix_len = 0
                max_prefix = min(len(last_words), len(words))
                while prefix_len < max_prefix and last_words[prefix_len] == words[prefix_len]:
                    prefix_len += 1

                new_words = words[prefix_len:]
                if not new_words:
                    last_text = text
                    continue

                if start is None:
                    for w in new_words:
                        word_items.append({"word": w, "start": None, "end": None})
                else:
                    duration = max(0.0, end - start)
                    step = duration / max(1, len(words))
                    for i in range(prefix_len, len(words)):
                        w_start = start + i * step
                        w_end = w_start + step
                        if w_end <= last_sent_word_end:
                            continue
                        word_items.append(
                            {"word": words[i], "start": w_start, "end": w_end}
                        )

            if not word_items:
                last_text = text
                continue

            numeric_ends = [w["end"] for w in word_items if isinstance(w["end"], (int, float))]
            if numeric_ends:
                last_sent_word_end = max(last_sent_word_end, max(numeric_ends))

            payload = {
                "type": "asr",
                "text": " ".join([w["word"] for w in word_items]),
                "segment_start": start,
                "segment_end": end,
                "words": word_items,
            }
            await ws.send_text(json.dumps(payload))
            last_text = text
# async def send_results(ws: WebSocket, gen):
#     last_sent_end = -1.0
#     last_words = []

#     async for msg in gen:
#         lines = getattr(msg, "lines", None)
#         if not lines:
#             continue

#         for line in lines:
#             text = (getattr(line, "text", "") or "").strip()
#             end = getattr(line, "end", None)

#             # skip silence / empty
#             if not text or end is None:
#                 continue

#             # reset if we moved to a new segment or the stream rewound
#             if end != last_sent_end:
#                 last_sent_end = end
#                 last_words = []

#             words = re.findall(r"\S+", text)
#             if not words:
#                 continue

#             # send only NEW words (suffix beyond common prefix)
#             prefix_len = 0
#             max_prefix = min(len(last_words), len(words))
#             while prefix_len < max_prefix and last_words[prefix_len] == words[prefix_len]:
#                 prefix_len += 1

#             new_words = words[prefix_len:]
#             if not new_words:
#                 last_words = words
#                 continue

#             await ws.send_text(" ".join(new_words))
#             last_words = words




