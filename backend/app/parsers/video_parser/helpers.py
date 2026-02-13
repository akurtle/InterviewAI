import asyncio
import json
import re
from typing import Any, Dict

import numpy as np
from fastapi import WebSocket
# Store websocket connections per session_id to push AI results

from faster_whisper import WhisperModel

from whisperlivekit import AudioProcessor, TranscriptionEngine


transcription_engine = None


#model = WhisperModel("tiny.en", device="cpu", compute_type="int8")  # or "cpu"


ws_clients: Dict[str, WebSocket] = {}


async def safe_send(session_id: str, message: Dict[str, Any]):
    ws = ws_clients.get(session_id)
    if ws:
        await ws.send_text(json.dumps(message))

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
    await safe_send(session_id, {"type": "status", "stage": "video", "message": "Video track connected"})
    while True:
        frame = await track.recv()  # video frame
        # TODO: convert frame to ndarray and run your model
        # await safe_send(session_id, {"type":"vision", "face_present": True, ...})

async def send_results(ws: WebSocket, gen):
    last_sent_end = -1.0
    last_words = []

    async for msg in gen:
        lines = getattr(msg, "lines", None)
        if not lines:
            continue

        for line in lines:
            text = (getattr(line, "text", "") or "").strip()
            end = getattr(line, "end", None)

            # skip silence / empty
            if not text or end is None:
                continue

            # reset if we moved to a new segment or the stream rewound
            if end != last_sent_end:
                last_sent_end = end
                last_words = []

            words = re.findall(r"\S+", text)
            if not words:
                continue

            # send only NEW words (suffix beyond common prefix)
            prefix_len = 0
            max_prefix = min(len(last_words), len(words))
            while prefix_len < max_prefix and last_words[prefix_len] == words[prefix_len]:
                prefix_len += 1

            new_words = words[prefix_len:]
            if not new_words:
                last_words = words
                continue

            await ws.send_text(" ".join(new_words))
            last_words = words




