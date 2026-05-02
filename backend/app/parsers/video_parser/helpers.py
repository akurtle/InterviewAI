import json
import logging
import re

from fastapi import WebSocket


logger = logging.getLogger(__name__)


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
