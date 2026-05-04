import { useEffect, useMemo, useState } from "react";
import type { TranscriptItem } from "../types/interview";

const PACE_WINDOW_MS = 20_000;
const FILLER_WINDOW_MS = 60_000;
const MIN_WORDS_FOR_PACE = 15;
const MIN_SPAN_MS = 8_000;
const WPM_FAST = 175;
const WPM_SLOW = 105;
const FILLER_RATE_HIGH = 4; // per minute

// Ordered longest-first so two-word phrases match before their single words
const FILLER_PHRASES = [
  "you know",
  "i mean",
  "kind of",
  "sort of",
  "basically",
  "literally",
  "actually",
  "honestly",
  "um",
  "uh",
  "er",
  "ah",
  "like",
  "right",
  "so",
  "well",
];

export type PaceStatus = "fast" | "slow" | "good" | "unknown";

export type LiveSpeechMetrics = {
  wpm: number | null;
  paceStatus: PaceStatus;
  fillerCount: number;
  fillerRate: number;
  tips: Array<{ id: string; text: string; level: "warn" | "tip" | "good" }>;
};

export function useLiveSpeechMetrics(
  transcripts: TranscriptItem[],
  isLive: boolean
): LiveSpeechMetrics {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isLive]);

  return useMemo(() => {
    const now = nowMs;
    const empty: LiveSpeechMetrics = {
      wpm: null,
      paceStatus: "unknown",
      fillerCount: 0,
      fillerRate: 0,
      tips: [],
    };

    if (!isLive || transcripts.length === 0) return empty;

    // ── Pace (rolling 20-second window) ────────────────────────────────────
    const paceRecent = transcripts.filter(
      (t) => t.isFinal && now - t.ts <= PACE_WINDOW_MS
    );

    let wpm: number | null = null;
    let paceStatus: PaceStatus = "unknown";

    if (paceRecent.length >= 2) {
      const span = paceRecent[paceRecent.length - 1].ts - paceRecent[0].ts;
      if (span >= MIN_SPAN_MS) {
        const words = paceRecent.reduce(
          (n, t) => n + t.text.trim().split(/\s+/).filter(Boolean).length,
          0
        );
        if (words >= MIN_WORDS_FOR_PACE) {
          wpm = Math.round((words / span) * 60_000);
          paceStatus = wpm > WPM_FAST ? "fast" : wpm < WPM_SLOW ? "slow" : "good";
        }
      }
    }

    // ── Filler words (rolling 60-second window) ────────────────────────────
    const fillerRecent = transcripts.filter(
      (t) => t.isFinal && now - t.ts <= FILLER_WINDOW_MS
    );
    const fullText = fillerRecent.map((t) => t.text.toLowerCase()).join(" ");

    let remaining = fullText;
    let fillerCount = 0;
    for (const phrase of FILLER_PHRASES) {
      const re = new RegExp(`\\b${phrase.replace(" ", "\\s+")}\\b`, "g");
      const hits = (remaining.match(re) ?? []).length;
      fillerCount += hits;
      // mask already-counted phrases so shorter substrings don't double-count
      remaining = remaining.replace(re, " ".repeat(phrase.length));
    }

    const fillerSpanSec =
      fillerRecent.length >= 2
        ? (fillerRecent[fillerRecent.length - 1].ts - fillerRecent[0].ts) / 1000
        : 0;
    const fillerRate =
      fillerSpanSec >= 15 ? (fillerCount / fillerSpanSec) * 60 : 0;

    // ── Build tips ──────────────────────────────────────────────────────────
    const tips: LiveSpeechMetrics["tips"] = [];

    if (paceStatus === "fast" && wpm !== null) {
      tips.push({
        id: "pace-fast",
        text: `Slow down — you're at ~${wpm} wpm. Aim for 130–165.`,
        level: "warn",
      });
    } else if (paceStatus === "slow" && wpm !== null) {
      tips.push({
        id: "pace-slow",
        text: `Pick up the pace — you're at ~${wpm} wpm. Aim for 130–165.`,
        level: "tip",
      });
    } else if (paceStatus === "good" && wpm !== null) {
      tips.push({
        id: "pace-good",
        text: `Good pace — ~${wpm} wpm.`,
        level: "good",
      });
    }

    if (fillerRate > FILLER_RATE_HIGH) {
      tips.push({
        id: "fillers",
        text: `Reduce filler words (~${Math.round(fillerRate)}/min). Pause instead of saying "um" or "like".`,
        level: "warn",
      });
    } else if (fillerCount > 0 && fillerSpanSec >= 15) {
      tips.push({
        id: "fillers-ok",
        text: `Filler word usage looks controlled.`,
        level: "good",
      });
    }

    return { wpm, paceStatus, fillerCount, fillerRate, tips };
  }, [transcripts, isLive, nowMs]);
}
