import { useMemo, useState } from "react";
import type { TranscriptItem } from "../../types/interview";

type SpeechTopicId = "career" | "product" | "leadership" | "customer" | "daily";

type SpeechTopic = {
  id: SpeechTopicId;
  label: string;
};

type PracticeSpeech = {
  id: string;
  topicId: SpeechTopicId;
  title: string;
  text: string;
};

type WordMatchStatus = "correct" | "missed" | "pending";

type AlignedWord = {
  display: string;
  normalized: string;
  status: WordMatchStatus;
};

type Props = {
  transcripts: TranscriptItem[];
  isLive: boolean;
};

const TOPICS: SpeechTopic[] = [
  { id: "career", label: "Career story" },
  { id: "product", label: "Product pitch" },
  { id: "leadership", label: "Leadership" },
  { id: "customer", label: "Customer problem" },
  { id: "daily", label: "Daily update" },
];

const SPEECHES: PracticeSpeech[] = [
  {
    id: "career-growth",
    topicId: "career",
    title: "Career growth",
    text:
      "My career has grown through curiosity, steady practice, and direct feedback. I started by solving small problems, then learned how to explain my decisions clearly. Each project taught me to listen first, ask better questions, and turn uncertainty into a practical next step.",
  },
  {
    id: "career-change",
    topicId: "career",
    title: "Changing direction",
    text:
      "A meaningful career change starts with honest reflection. I look for the skills that still matter, the gaps I need to close, and the people who can give useful perspective. Progress becomes easier when the next step is specific, measurable, and small enough to begin today.",
  },
  {
    id: "product-focus",
    topicId: "product",
    title: "Focused product pitch",
    text:
      "This product helps busy teams turn scattered interview notes into clear hiring decisions. It captures practice answers, organizes feedback, and shows where communication can improve. The goal is simple: make preparation feel focused, repeatable, and easier to trust.",
  },
  {
    id: "product-launch",
    topicId: "product",
    title: "Launch plan",
    text:
      "A strong launch needs one clear promise, a narrow audience, and fast learning loops. We should start with the users who feel the problem most often, measure what changes after onboarding, and use those signals to improve the message before expanding.",
  },
  {
    id: "leadership-trust",
    topicId: "leadership",
    title: "Building trust",
    text:
      "Trust grows when leaders are consistent under pressure. I try to set clear expectations, explain tradeoffs early, and make room for concerns before decisions harden. A team moves faster when people understand the goal and feel safe naming risks.",
  },
  {
    id: "leadership-feedback",
    topicId: "leadership",
    title: "Useful feedback",
    text:
      "Useful feedback is specific, timely, and connected to a shared goal. I focus on the behavior, explain the impact, and agree on the next action. That approach keeps the conversation practical and makes improvement feel possible instead of personal.",
  },
  {
    id: "customer-support",
    topicId: "customer",
    title: "Customer support moment",
    text:
      "When a customer is frustrated, the first job is to slow the conversation down. I acknowledge the impact, restate the issue, and explain what I will check next. Clear ownership matters because people remember how the problem felt, not only how it ended.",
  },
  {
    id: "customer-discovery",
    topicId: "customer",
    title: "Discovery call",
    text:
      "A good discovery call is more about listening than presenting. I want to understand the current workflow, the moments that waste time, and the cost of leaving things unchanged. The best pitch comes after the customer has described the problem in their own words.",
  },
  {
    id: "daily-priorities",
    topicId: "daily",
    title: "Daily priorities",
    text:
      "Today I am focused on the highest impact work first. I will finish the open review, confirm the next requirement, and leave enough time to test the change properly. A clear day is not a quiet day; it is a day with fewer hidden decisions.",
  },
  {
    id: "daily-retrospective",
    topicId: "daily",
    title: "End of day reflection",
    text:
      "At the end of the day, I review what moved forward, what became blocked, and what needs a cleaner handoff. This habit helps me notice patterns instead of reacting to every task. Small reflections make tomorrow easier to start.",
  },
];

const normalizeWord = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9']/g, "")
    .replace(/^'+|'+$/g, "");

const tokenizeDisplayWords = (text: string) =>
  text
    .split(/\s+/)
    .map((word) => ({
      display: word,
      normalized: normalizeWord(word),
    }))
    .filter((word) => word.normalized.length > 0);

const tokenizeSpokenWords = (text: string) =>
  (text.match(/[a-zA-Z0-9']+/g) ?? [])
    .map(normalizeWord)
    .filter((word) => word.length > 0);

const editDistance = (left: string, right: string) => {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + substitutionCost
      );
    }
  }

  return matrix[left.length][right.length];
};

const wordsMatch = (target: string, spoken: string) => {
  if (target === spoken) {
    return true;
  }

  if (target.length <= 3 || spoken.length <= 3) {
    return false;
  }

  const distance = editDistance(target, spoken);
  const longest = Math.max(target.length, spoken.length);
  return 1 - distance / longest >= 0.84;
};

const chooseSpeech = (topicId: SpeechTopicId, currentId?: string) => {
  const options = SPEECHES.filter((speech) => speech.topicId === topicId);
  const pool = options.length > 1 ? options.filter((speech) => speech.id !== currentId) : options;
  return pool[Math.floor(Math.random() * pool.length)] ?? options[0] ?? SPEECHES[0];
};

const alignWords = (speechText: string, spokenText: string): AlignedWord[] => {
  const targetWords = tokenizeDisplayWords(speechText);
  const spokenWords = tokenizeSpokenWords(spokenText);

  if (spokenWords.length === 0) {
    return targetWords.map((word) => ({ ...word, status: "pending" }));
  }

  const targetCount = targetWords.length;
  const spokenCount = spokenWords.length;
  const deleteCost = 0.9;
  const insertCost = 0.8;
  const replaceCost = 1.4;
  const scores = Array.from({ length: targetCount + 1 }, () =>
    Array<number>(spokenCount + 1).fill(0)
  );
  const moves = Array.from({ length: targetCount + 1 }, () =>
    Array<"diag" | "delete" | "insert" | null>(spokenCount + 1).fill(null)
  );

  for (let index = 1; index <= targetCount; index += 1) {
    scores[index][0] = scores[index - 1][0] + deleteCost;
    moves[index][0] = "delete";
  }

  for (let index = 1; index <= spokenCount; index += 1) {
    scores[0][index] = scores[0][index - 1] + insertCost;
    moves[0][index] = "insert";
  }

  for (let targetIndex = 1; targetIndex <= targetCount; targetIndex += 1) {
    for (let spokenIndex = 1; spokenIndex <= spokenCount; spokenIndex += 1) {
      const isMatch = wordsMatch(
        targetWords[targetIndex - 1].normalized,
        spokenWords[spokenIndex - 1]
      );
      const diagonalScore = scores[targetIndex - 1][spokenIndex - 1] + (isMatch ? 0 : replaceCost);
      const deleteScore = scores[targetIndex - 1][spokenIndex] + deleteCost;
      const insertScore = scores[targetIndex][spokenIndex - 1] + insertCost;
      const bestScore = Math.min(diagonalScore, deleteScore, insertScore);

      scores[targetIndex][spokenIndex] = bestScore;
      moves[targetIndex][spokenIndex] =
        bestScore === diagonalScore ? "diag" : bestScore === deleteScore ? "delete" : "insert";
    }
  }

  const events: Array<{
    targetIndex: number | null;
    spokenIndex: number | null;
    status?: WordMatchStatus;
  }> = [];
  let targetIndex = targetCount;
  let spokenIndex = spokenCount;

  while (targetIndex > 0 || spokenIndex > 0) {
    const move = moves[targetIndex][spokenIndex];

    if (move === "diag") {
      const nextTargetIndex = targetIndex - 1;
      const nextSpokenIndex = spokenIndex - 1;
      events.push({
        targetIndex: nextTargetIndex,
        spokenIndex: nextSpokenIndex,
        status: wordsMatch(targetWords[nextTargetIndex].normalized, spokenWords[nextSpokenIndex])
          ? "correct"
          : "missed",
      });
      targetIndex = nextTargetIndex;
      spokenIndex = nextSpokenIndex;
      continue;
    }

    if (move === "insert") {
      spokenIndex -= 1;
      events.push({ targetIndex: null, spokenIndex });
      continue;
    }

    targetIndex -= 1;
    events.push({ targetIndex, spokenIndex: null });
  }

  const statuses = Array<WordMatchStatus>(targetCount).fill("pending");
  let consumedSpokenWords = 0;

  for (const event of events.reverse()) {
    if (event.targetIndex === null) {
      consumedSpokenWords += 1;
      continue;
    }

    if (event.spokenIndex === null) {
      statuses[event.targetIndex] = consumedSpokenWords < spokenCount ? "missed" : "pending";
      continue;
    }

    statuses[event.targetIndex] = event.status ?? "missed";
    consumedSpokenWords += 1;
  }

  return targetWords.map((word, index) => ({
    ...word,
    status: statuses[index],
  }));
};

const wordClassName = (status: WordMatchStatus) => {
  if (status === "correct") {
    return "border-emerald-400/45 bg-emerald-500/15 text-emerald-200";
  }

  if (status === "missed") {
    return "border-red-400/45 bg-red-500/15 text-red-200";
  }

  return "border-transparent text-[var(--txt2)]";
};

const FreeTalkSpeechPractice = ({ transcripts, isLive }: Props) => {
  const [selectedTopicId, setSelectedTopicId] = useState<SpeechTopicId>("career");
  const [speech, setSpeech] = useState<PracticeSpeech>(() => chooseSpeech("career"));
  const [practiceTranscriptStart, setPracticeTranscriptStart] = useState(() => transcripts.length);
  const practiceTranscript = useMemo(
    () =>
      transcripts
        .slice(practiceTranscriptStart)
        .map((item) => item.text)
        .join(" "),
    [practiceTranscriptStart, transcripts]
  );
  const alignedWords = useMemo(
    () => alignWords(speech.text, practiceTranscript),
    [practiceTranscript, speech.text]
  );
  const correctCount = alignedWords.filter((word) => word.status === "correct").length;
  const missedCount = alignedWords.filter((word) => word.status === "missed").length;
  const attemptedCount = correctCount + missedCount;

  const selectTopic = (topicId: SpeechTopicId) => {
    setSelectedTopicId(topicId);
    setSpeech(chooseSpeech(topicId));
    setPracticeTranscriptStart(transcripts.length);
  };

  const chooseAnotherSpeech = () => {
    setSpeech(chooseSpeech(selectedTopicId, speech.id));
    setPracticeTranscriptStart(transcripts.length);
  };

  const resetPractice = () => {
    setPracticeTranscriptStart(transcripts.length);
  };

  return (
    <div className="theme-panel rounded-2xl p-5 backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="theme-text-primary text-base font-semibold">Speech practice</p>
          <p className="theme-text-muted mt-1 text-sm">{speech.title}</p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            isLive ? "border-emerald-500/30 text-emerald-300" : "border-[var(--border)] text-[var(--txt3)]"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-[var(--txt3)]"}`} />
          {isLive ? "Listening" : "Ready"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TOPICS.map((topic) => (
          <button
            key={topic.id}
            type="button"
            onClick={() => selectTopic(topic.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              selectedTopicId === topic.id
                ? "theme-choice-active theme-text-primary"
                : "theme-button-secondary"
            }`}
          >
            {topic.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
        <div className="flex flex-wrap gap-x-1.5 gap-y-2 text-sm leading-8">
          {alignedWords.map((word, index) => (
            <span
              key={`${word.display}-${index}`}
              className={`rounded-md border px-1.5 py-0.5 ${wordClassName(word.status)}`}
              title={word.status === "correct" ? "Matched" : word.status === "missed" ? "Needs another pass" : "Not reached yet"}
            >
              {word.display}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
            Matched {correctCount}
          </span>
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-red-200">
            Needs work {missedCount}
          </span>
          <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[var(--txt3)]">
            Attempted {attemptedCount}/{alignedWords.length}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetPractice}
            className="theme-button-secondary rounded-lg px-3 py-2 text-xs font-semibold"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={chooseAnotherSpeech}
            className="theme-button-primary rounded-lg px-3 py-2 text-xs font-semibold"
          >
            Random speech
          </button>
        </div>
      </div>
    </div>
  );
};

export default FreeTalkSpeechPractice;
