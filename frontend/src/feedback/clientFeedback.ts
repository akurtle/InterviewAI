import type { VisionFrame } from "../types/interview";

type WordTimestamp = {
  word: string;
  start: number;
  end: number;
};

type SegmentTimestamp = {
  text: string;
  start: number;
  end: number;
};

export type QuestionResponsePayload = {
  index: number;
  question: string;
  category: string | null;
  answer_text: string;
};

type QuestionResponseReview = {
  index: number;
  question: string;
  category: string | null;
  answer_text: string;
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  metrics: Record<string, unknown>;
  dimension_scores: {
    relevance: number;
    completeness: number;
    specificity: number;
    structure: number;
  };
};

type ResponseEvaluation = {
  response_score: number | null;
  response_metrics: Record<string, unknown>;
  response_feedback: string[];
  question_reviews: QuestionResponseReview[];
};

export type SpeechFeedbackResult = {
  score: number;
  metrics: Record<string, unknown>;
  feedback: string[];
  warnings: string[];
} & ResponseEvaluation;

export type VideoFeedbackResult = {
  score: number;
  metrics: Record<string, unknown>;
  feedback: string[];
  warnings: string[];
};

const SPEECH_WORD_RE = /[a-zA-Z']+/g;
const RESPONSE_WORD_RE = /[a-zA-Z0-9']+/g;
const SENTENCE_SPLIT_RE = /[.!?]+/;

const FILLER_WORDS = new Set([
  "um",
  "uh",
  "erm",
  "like",
  "actually",
  "basically",
  "literally",
  "well",
  "so",
  "right",
  "okay",
  "ok",
]);

const FILLER_PHRASES = new Set(["you know", "kind of", "sort of"]);

const SPEECH_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "we",
  "with",
  "you",
  "your",
]);

const RESPONSE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "describe",
  "did",
  "do",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "of",
  "on",
  "or",
  "should",
  "tell",
  "that",
  "the",
  "through",
  "to",
  "walk",
  "what",
  "where",
  "who",
  "why",
  "with",
  "would",
  "you",
  "your",
]);

const DETAIL_MARKERS = new Set([
  "because",
  "example",
  "impact",
  "improved",
  "increased",
  "launched",
  "metric",
  "outcome",
  "reduced",
  "result",
  "shipped",
]);

const TRANSITION_MARKERS = new Set([
  "after",
  "because",
  "before",
  "finally",
  "first",
  "next",
  "result",
  "so",
  "then",
]);

const BEHAVIORAL_MARKERS = new Set([
  "challenge",
  "learned",
  "managed",
  "owned",
  "resolved",
  "result",
  "situation",
  "task",
]);

const SYSTEM_DESIGN_MARKERS = new Set([
  "api",
  "cache",
  "database",
  "latency",
  "queue",
  "retry",
  "scaling",
  "throughput",
  "tradeoff",
]);

const SALES_MARKERS = new Set([
  "budget",
  "customer",
  "objection",
  "pain",
  "stakeholder",
  "timeline",
  "value",
  "workflow",
]);

const PRESENTATION_MARKERS = new Set([
  "audience",
  "goal",
  "message",
  "objection",
  "story",
  "takeaway",
]);

const DEFAULT_WORD_RANGES: Record<string, [number, number]> = {
  behavioral: [55, 190],
  system_design: [70, 240],
  technical: [55, 200],
  sales: [45, 170],
  presentation: [45, 170],
  context: [35, 140],
  general: [45, 170],
};

const SPEECH_MODEL_WEIGHTS: Record<string, number> = {
  filler_rate: -3.5,
  unique_word_ratio: 1.2,
  avg_sentence_length: -0.03,
  sentence_length_std: -0.02,
  pause_rate_per_min: -0.08,
  long_pause_ratio: -1.2,
  speaking_rate_wpm: 0.01,
  repetition_rate: -2.5,
};

const VIDEO_MODEL_WEIGHTS: Record<string, number> = {
  face_presence_rate: 2.0,
  gaze_at_camera_rate: 2.5,
  smile_rate: 1.2,
  avg_smile_prob: 1.5,
  head_movement_std: -0.4,
  long_gaze_break_rate: -1.4,
  avg_mouth_open_ratio: 3.6,
  articulation_active_rate: 1.8,
  avg_mouth_movement_delta: 4.5,
};

const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const stdev = (values: number[]) => {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const tokenizeWith = (text: string, regex: RegExp) => text.toLowerCase().match(regex) ?? [];

const splitSentences = (text: string) =>
  text
    .split(SENTENCE_SPLIT_RE)
    .map((part) => part.trim())
    .filter(Boolean);

const logisticScore = (rawScore: number) => 100 / (1 + Math.exp(-rawScore));

const predictLinear = (features: Record<string, number>, weights: Record<string, number>, bias: number) =>
  Object.entries(weights).reduce((score, [key, weight]) => score + (features[key] ?? 0) * weight, bias);

const countFillers = (tokens: string[]) => {
  let fillerCount = tokens.filter((token) => FILLER_WORDS.has(token)).length;

  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (FILLER_PHRASES.has(`${tokens[index]} ${tokens[index + 1]}`)) {
      fillerCount += 1;
    }
  }

  return fillerCount;
};

const mostCommonNonStopwords = (tokens: string[], limit = 3) => {
  const counts = new Map<string, number>();

  tokens.forEach((token) => {
    if (SPEECH_STOPWORDS.has(token) || FILLER_WORDS.has(token)) return;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort(([wordA, countA], [wordB, countB]) => countB - countA || wordA.localeCompare(wordB))
    .slice(0, limit);
};

const extractPauseDurationsFromWords = (
  words: WordTimestamp[],
  pauseThreshold: number
): {
  pauses: number[];
  totalDuration: number | null;
  talkingTime: number | null;
} => {
  if (words.length === 0) {
    return { pauses: [], totalDuration: null, talkingTime: null };
  }

  const wordsSorted = [...words].sort((left, right) => left.start - right.start);
  const totalDuration = Math.max(0, wordsSorted[wordsSorted.length - 1].end - wordsSorted[0].start);
  const pauses: number[] = [];
  let talkingTime = 0;
  let previousEnd = wordsSorted[0].end;

  wordsSorted.forEach((word) => {
    talkingTime += Math.max(0, word.end - word.start);
    const gap = word.start - previousEnd;
    if (gap >= pauseThreshold) {
      pauses.push(gap);
    }
    previousEnd = Math.max(previousEnd, word.end);
  });

  return { pauses, totalDuration, talkingTime };
};

const extractPauseDurationsFromSegments = (
  segments: SegmentTimestamp[],
  pauseThreshold: number
): {
  pauses: number[];
  totalDuration: number | null;
} => {
  if (segments.length === 0) {
    return { pauses: [], totalDuration: null };
  }

  const segmentsSorted = [...segments].sort((left, right) => left.start - right.start);
  const totalDuration = Math.max(
    0,
    segmentsSorted[segmentsSorted.length - 1].end - segmentsSorted[0].start
  );
  const pauses: number[] = [];
  let previousEnd = segmentsSorted[0].end;

  segmentsSorted.slice(1).forEach((segment) => {
    const gap = segment.start - previousEnd;
    if (gap >= pauseThreshold) {
      pauses.push(gap);
    }
    previousEnd = Math.max(previousEnd, segment.end);
  });

  return { pauses, totalDuration };
};

const extractSpeechFeatures = ({
  text,
  words,
  segments,
  pauseThreshold = 0.35,
  longPauseThreshold = 1.5,
}: {
  text: string;
  words?: WordTimestamp[];
  segments?: SegmentTimestamp[];
  pauseThreshold?: number;
  longPauseThreshold?: number;
}) => {
  const warnings: string[] = [];
  const tokens = tokenizeWith(text, SPEECH_WORD_RE);
  const totalWords = tokens.length;
  const fillerCount = countFillers(tokens);
  const fillerRate = totalWords ? fillerCount / totalWords : 0;
  const uniqueWordRatio = totalWords ? new Set(tokens).size / totalWords : 0;
  const sentenceLengths = splitSentences(text).map((sentence) => tokenizeWith(sentence, SPEECH_WORD_RE).length);
  const avgSentenceLength = mean(sentenceLengths);
  const sentenceLengthStd = stdev(sentenceLengths);
  const repetitionCount = tokens.reduce(
    (count, token, index) => (index > 0 && token === tokens[index - 1] ? count + 1 : count),
    0
  );
  const repetitionRate = totalWords ? repetitionCount / totalWords : 0;

  let pauses: number[] = [];
  let totalDuration: number | null = null;
  let talkingTime: number | null = null;

  if (words && words.length > 0) {
    const result = extractPauseDurationsFromWords(words, pauseThreshold);
    pauses = result.pauses;
    totalDuration = result.totalDuration;
    talkingTime = result.talkingTime;
  } else if (segments && segments.length > 0) {
    const result = extractPauseDurationsFromSegments(segments, pauseThreshold);
    pauses = result.pauses;
    totalDuration = result.totalDuration;
  } else {
    warnings.push("No timestamps provided; pause metrics and speaking rate are unavailable.");
  }

  const pauseCount = pauses.length;
  const avgPause = mean(pauses);
  const longPauseCount = pauses.filter((pause) => pause >= longPauseThreshold).length;
  const longPauseRatio = pauseCount ? longPauseCount / pauseCount : 0;

  let pauseRatePerMin = 0;
  let speakingRateWpm = 0;
  if (totalDuration !== null && totalDuration > 0) {
    pauseRatePerMin = pauseCount / (totalDuration / 60);
    speakingRateWpm = totalWords / (totalDuration / 60);
  } else if (warnings.length === 0) {
    warnings.push("Speech duration was not available to compute pace metrics.");
  }

  const features = {
    filler_rate: fillerRate,
    unique_word_ratio: uniqueWordRatio,
    avg_sentence_length: avgSentenceLength,
    sentence_length_std: sentenceLengthStd,
    pause_rate_per_min: pauseRatePerMin,
    long_pause_ratio: longPauseRatio,
    speaking_rate_wpm: speakingRateWpm,
    repetition_rate: repetitionRate,
  };

  const metrics = {
    total_words: totalWords,
    filler_count: fillerCount,
    filler_rate: round(fillerRate, 4),
    unique_word_ratio: round(uniqueWordRatio, 4),
    avg_sentence_length: round(avgSentenceLength, 2),
    sentence_length_std: round(sentenceLengthStd, 2),
    repetition_rate: round(repetitionRate, 4),
    pause_count: pauseCount,
    avg_pause_seconds: round(avgPause, 3),
    long_pause_ratio: round(longPauseRatio, 4),
    pause_rate_per_min: round(pauseRatePerMin, 3),
    speaking_rate_wpm: round(speakingRateWpm, 2),
    total_duration_seconds: totalDuration === null ? null : round(totalDuration, 3),
    talking_time_seconds: talkingTime === null ? null : round(talkingTime, 3),
  };

  return { features, metrics, warnings };
};

const scoreCompleteness = (wordCount: number, expectedMin: number, expectedMax: number) => {
  if (wordCount <= 0) return 0;
  if (wordCount < expectedMin) return Math.max(20, 100 * (wordCount / expectedMin));
  if (wordCount <= expectedMax) return 100;

  const overflow = wordCount - expectedMax;
  const penaltyWindow = Math.max(expectedMax - expectedMin, 40);
  const penaltyRatio = Math.min(overflow / penaltyWindow, 1);
  return Math.max(55, 100 - penaltyRatio * 45);
};

const sentenceCount = (answerText: string) => splitSentences(answerText).length;

const countMatches = (tokens: string[], vocabulary: Set<string>) =>
  tokens.filter((token) => vocabulary.has(token)).length;

const normalizeCategory = (category: string | null, question: string) => {
  const normalized = (category ?? "").trim().toLowerCase().replaceAll(" ", "_");
  const questionLower = question.toLowerCase();

  if (normalized) {
    if (normalized.includes("behavior")) return "behavioral";
    if (normalized.includes("system") || normalized.includes("design")) return "system_design";
    if (normalized.includes("sales")) return "sales";
    if (normalized.includes("presentation") || normalized.includes("pitch")) return "presentation";
    if (normalized in DEFAULT_WORD_RANGES) return normalized;
    if (normalized.includes("technical")) return "technical";
  }

  if (questionLower.includes("tell me about a time") || questionLower.includes("describe a situation")) {
    return "behavioral";
  }
  if (questionLower.startsWith("design ") || questionLower.includes("design a ")) {
    return "system_design";
  }
  if (
    ["workflow", "budget", "decision-making", "pain point"].some((marker) =>
      questionLower.includes(marker)
    )
  ) {
    return "sales";
  }
  if (
    ["presentation", "pitch", "audience", "takeaway"].some((marker) =>
      questionLower.includes(marker)
    )
  ) {
    return "presentation";
  }
  if (questionLower.includes("why are you interested")) {
    return "context";
  }

  return "technical";
};

const extractQuestionKeywords = (question: string) => {
  const tokens = tokenizeWith(question, RESPONSE_WORD_RE);
  const keywords: string[] = [];
  const seen = new Set<string>();

  tokens.forEach((token) => {
    if (keywords.length >= 6 || RESPONSE_STOPWORDS.has(token) || token.length < 4 || seen.has(token)) {
      return;
    }

    seen.add(token);
    keywords.push(token);
  });

  return keywords;
};

const scoreSpecificity = (answerText: string, tokens: string[]) => {
  const totalWords = tokens.length;
  const uniqueRatio = totalWords ? new Set(tokens).size / totalWords : 0;
  const longWordRatio = totalWords
    ? tokens.filter((token) => token.length >= 7).length / totalWords
    : 0;
  const numericMentions = answerText.match(/\b\d+(?:\.\d+)?%?\b/g)?.length ?? 0;
  const detailHits = countMatches(tokens, DETAIL_MARKERS);
  const score =
    32 +
    Math.min(uniqueRatio / 0.72, 1) * 28 +
    Math.min(longWordRatio / 0.18, 1) * 16 +
    Math.min(numericMentions, 3) * 8 +
    Math.min(detailHits, 3) * 7;

  return {
    score: Math.min(score, 100),
    metrics: {
      unique_word_ratio: round(uniqueRatio, 4),
      long_word_ratio: round(longWordRatio, 4),
      numeric_mentions: numericMentions,
      detail_markers: detailHits,
    },
  };
};

const scoreStructure = (style: string, answerText: string, tokens: string[]) => {
  const sentences = sentenceCount(answerText);
  const transitionHits = countMatches(tokens, TRANSITION_MARKERS);
  let markerHits = 0;

  if (style === "behavioral") {
    markerHits = countMatches(tokens, BEHAVIORAL_MARKERS);
  } else if (style === "system_design") {
    markerHits = countMatches(tokens, SYSTEM_DESIGN_MARKERS);
  } else if (style === "sales") {
    markerHits = countMatches(tokens, SALES_MARKERS);
  } else if (style === "presentation") {
    markerHits = countMatches(tokens, PRESENTATION_MARKERS);
  }

  const sentenceScore = sentences >= 2 && sentences <= 5 ? 100 : sentences === 1 ? 65 : 78;
  const score = Math.min(100, sentenceScore + Math.min(transitionHits, 3) * 7 + Math.min(markerHits, 3) * 6);

  return {
    score,
    metrics: {
      sentence_count: sentences,
      transition_markers: transitionHits,
      structure_markers: markerHits,
    },
  };
};

const scoreRelevance = (style: string, question: string, answerText: string, tokens: string[]) => {
  const questionKeywords = extractQuestionKeywords(question);
  const answerTokenSet = new Set(tokens);
  const keywordMatches = questionKeywords.filter((token) => answerTokenSet.has(token)).length;
  const keywordOverlap = questionKeywords.length ? keywordMatches / questionKeywords.length : 0;
  const exampleSignal = /\b(for example|for instance|when i|i once|on one project)\b/.test(
    answerText.toLowerCase()
  )
    ? 1
    : 0;

  let base: number;
  if (style === "behavioral") {
    base = 38 + keywordOverlap * 32 + exampleSignal * 20;
  } else if (style === "system_design") {
    const architectureHits = countMatches(tokens, SYSTEM_DESIGN_MARKERS);
    base = 30 + keywordOverlap * 52 + Math.min(architectureHits, 3) * 5;
  } else if (style === "sales") {
    const discoveryHits = countMatches(tokens, SALES_MARKERS);
    base = 34 + keywordOverlap * 46 + Math.min(discoveryHits, 3) * 5;
  } else if (style === "presentation") {
    const presentationHits = countMatches(tokens, PRESENTATION_MARKERS);
    base = 34 + keywordOverlap * 46 + Math.min(presentationHits, 3) * 5;
  } else {
    base = 32 + keywordOverlap * 55;
  }

  if (tokens.length < 12) {
    base = Math.min(base, 58);
  }

  return {
    score: Math.min(base, 100),
    metrics: {
      question_keywords: questionKeywords,
      matched_question_keywords: keywordMatches,
      keyword_overlap: round(keywordOverlap, 4),
    },
  };
};

const summarizeReview = (score: number, style: string) => {
  if (score >= 85) return "Strong answer that addresses the question directly and adds useful detail.";
  if (score >= 70) return "Solid answer with a clear point, but it could be sharper or more concrete.";
  if (score >= 55) return "Partially effective answer, but it needs more depth or tighter alignment to the prompt.";
  if (style === "behavioral") {
    return "The answer is too thin for a behavioral question and needs a clearer example plus outcome.";
  }
  return "The answer does not yet address the prompt clearly enough to feel convincing.";
};

const feedbackForStyle = (style: string, dimension: string) => {
  if (dimension === "completeness") {
    if (style === "behavioral") {
      return "Add the situation, the action you took, and the result to make the story complete.";
    }
    if (style === "system_design") {
      return "Cover the main components, tradeoffs, and scaling constraints in more depth.";
    }
    if (style === "sales" || style === "presentation") {
      return "Add the audience need, your approach, and the expected outcome.";
    }
    return "Expand the answer with one concrete example or decision so it feels complete.";
  }

  if (dimension === "specificity") {
    return "Add concrete details such as metrics, tools, constraints, or measurable outcomes.";
  }

  if (dimension === "structure") {
    if (style === "behavioral") {
      return "Use a clearer sequence so the listener can follow the situation, action, and result.";
    }
    return "Open with a direct answer, then support it with a short example or tradeoff.";
  }

  return "Answer the prompt more directly and reuse the key topic from the question.";
};

const buildReviewFeedback = ({
  style,
  completeness,
  specificity,
  structure,
  relevance,
}: {
  style: string;
  completeness: number;
  specificity: number;
  structure: number;
  relevance: number;
}) => {
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (relevance >= 75) strengths.push("You addressed the prompt directly instead of circling around it.");
  if (completeness >= 80) strengths.push("The answer had enough depth to feel substantive.");
  if (specificity >= 78) strengths.push("Concrete detail made the answer more believable.");
  if (structure >= 78) strengths.push("The answer followed a clear flow that is easy to follow.");

  if (relevance < 65) improvements.push(feedbackForStyle(style, "relevance"));
  if (completeness < 65) improvements.push(feedbackForStyle(style, "completeness"));
  if (specificity < 65) improvements.push(feedbackForStyle(style, "specificity"));
  if (structure < 65) improvements.push(feedbackForStyle(style, "structure"));

  if (strengths.length === 0) {
    strengths.push("The answer gives you a usable starting point to refine further.");
  }
  if (improvements.length === 0) {
    improvements.push("Keep the same structure, but tighten phrasing and add one more concrete detail.");
  }

  return {
    strengths: strengths.slice(0, 2),
    improvements: improvements.slice(0, 2),
  };
};

const evaluateQuestionResponses = (
  questionResponses: QuestionResponsePayload[] | undefined
): ResponseEvaluation => {
  if (!questionResponses || questionResponses.length === 0) {
    return {
      response_score: null,
      response_metrics: {},
      response_feedback: [],
      question_reviews: [],
    };
  }

  const questionReviews: QuestionResponseReview[] = [];
  const dimensionTotals = {
    relevance: 0,
    completeness: 0,
    specificity: 0,
    structure: 0,
  };
  const wordCounts: number[] = [];

  questionResponses.forEach((item) => {
    const answerText = String(item.answer_text ?? "").trim();
    const question = String(item.question ?? "").trim();

    if (!question || !answerText || answerText === "--") {
      return;
    }

    const style = normalizeCategory(item.category, question);
    const [expectedMin, expectedMax] = DEFAULT_WORD_RANGES[style] ?? DEFAULT_WORD_RANGES.general;
    const tokens = tokenizeWith(answerText, RESPONSE_WORD_RE);
    const wordCount = tokens.length;
    wordCounts.push(wordCount);

    const completeness = scoreCompleteness(wordCount, expectedMin, expectedMax);
    const specificity = scoreSpecificity(answerText, tokens);
    const structure = scoreStructure(style, answerText, tokens);
    const relevance = scoreRelevance(style, question, answerText, tokens);
    const score = Math.max(
      0,
      Math.min(
        100,
        relevance.score * 0.35 +
          completeness * 0.25 +
          specificity.score * 0.25 +
          structure.score * 0.15
      )
    );
    const { strengths, improvements } = buildReviewFeedback({
      style,
      completeness,
      specificity: specificity.score,
      structure: structure.score,
      relevance: relevance.score,
    });

    const dimensionScores = {
      relevance: round(relevance.score, 2),
      completeness: round(completeness, 2),
      specificity: round(specificity.score, 2),
      structure: round(structure.score, 2),
    };

    Object.entries(dimensionScores).forEach(([key, value]) => {
      dimensionTotals[key as keyof typeof dimensionTotals] += value;
    });

    questionReviews.push({
      index: item.index ?? questionReviews.length,
      question,
      category: item.category,
      answer_text: answerText,
      score: round(score, 2),
      summary: summarizeReview(score, style),
      strengths,
      improvements,
      metrics: {
        style,
        word_count: wordCount,
        expected_min_words: expectedMin,
        expected_max_words: expectedMax,
        ...specificity.metrics,
        ...structure.metrics,
        ...relevance.metrics,
      },
      dimension_scores: dimensionScores,
    });
  });

  if (questionReviews.length === 0) {
    return {
      response_score: null,
      response_metrics: {},
      response_feedback: [],
      question_reviews: [],
    };
  }

  const reviewCount = questionReviews.length;
  const responseScore = round(mean(questionReviews.map((review) => review.score)), 2);
  const averagedDimensions = {
    relevance: round(dimensionTotals.relevance / reviewCount, 2),
    completeness: round(dimensionTotals.completeness / reviewCount, 2),
    specificity: round(dimensionTotals.specificity / reviewCount, 2),
    structure: round(dimensionTotals.structure / reviewCount, 2),
  };
  const responseFeedback: string[] = [];

  if (averagedDimensions.relevance < 70) {
    responseFeedback.push(
      "Several answers drift away from the exact prompt. Lead with a direct answer before expanding."
    );
  }
  if (averagedDimensions.specificity < 70) {
    responseFeedback.push(
      "Across answers, add more evidence such as metrics, concrete constraints, or named tools."
    );
  }
  if (averagedDimensions.structure < 70) {
    responseFeedback.push(
      "Your answer flow is inconsistent. Use a predictable structure so each response lands faster."
    );
  }
  if (averagedDimensions.completeness < 70) {
    responseFeedback.push(
      "Some answers end too early. Add one more layer of detail so each response feels complete."
    );
  }
  if (responseFeedback.length === 0) {
    responseFeedback.push(
      "Your responses are generally well aligned to the questions and have solid depth."
    );
  }

  return {
    response_score: responseScore,
    response_metrics: {
      reviewed_questions: reviewCount,
      avg_answer_word_count: round(mean(wordCounts), 1),
      avg_relevance: averagedDimensions.relevance,
      avg_completeness: averagedDimensions.completeness,
      avg_specificity: averagedDimensions.specificity,
      avg_structure: averagedDimensions.structure,
      score_stddev: round(
        Math.sqrt(
          mean(questionReviews.map((review) => (review.score - responseScore) ** 2))
        ),
        2
      ),
    },
    response_feedback: responseFeedback,
    question_reviews: [...questionReviews].sort((left, right) => left.index - right.index),
  };
};

export const generateSpeechFeedback = ({
  text,
  words,
  segments,
  questionResponses,
}: {
  text: string;
  words?: WordTimestamp[];
  segments?: SegmentTimestamp[];
  questionResponses?: QuestionResponsePayload[];
}): SpeechFeedbackResult => {
  const { features, metrics, warnings } = extractSpeechFeatures({
    text,
    words,
    segments,
  });
  const rawScore = predictLinear(features, SPEECH_MODEL_WEIGHTS, 0.2);
  const score = logisticScore(rawScore);
  const feedback: string[] = [];

  if (Number(metrics.filler_rate) > 0.05) {
    feedback.push("Filler word usage is high. Try replacing 'um/uh/like' with brief silent pauses.");
  }
  if (Number(metrics.unique_word_ratio) < 0.45 && Number(metrics.total_words) >= 60) {
    feedback.push("Vocabulary variety is low. Rephrase key points to avoid repeating the same words.");
  }
  if (Number(metrics.avg_sentence_length) > 25) {
    feedback.push("Sentences are long. Break them into shorter, clearer statements.");
  }
  if (Number(metrics.avg_sentence_length) > 0 && Number(metrics.avg_sentence_length) < 8) {
    feedback.push("Sentences are very short. Add a bit more detail to show depth.");
  }
  if (Number(metrics.speaking_rate_wpm) > 180) {
    feedback.push("Pace is fast. Slow down slightly so the interviewer can follow key points.");
  }
  if (Number(metrics.speaking_rate_wpm) > 0 && Number(metrics.speaking_rate_wpm) < 110) {
    feedback.push("Pace is slow. Aim for a slightly faster delivery to sound confident.");
  }
  if (Number(metrics.pause_rate_per_min) > 18 && Number(metrics.long_pause_ratio) > 0.2) {
    feedback.push("Pauses are frequent and long. Plan the next idea before speaking to reduce long gaps.");
  }
  if (Number(metrics.repetition_rate) > 0.03) {
    feedback.push("Repeated words appear often. Try varying phrasing to sound more polished.");
  }

  const commonWords = mostCommonNonStopwords(tokenizeWith(text, SPEECH_WORD_RE));
  if (commonWords.length > 0) {
    const wordList = commonWords.map(([word, count]) => `${word} (${count})`).join(", ");
    feedback.push(`Most repeated content words: ${wordList}.`);
  }

  if (feedback.length === 0) {
    feedback.push("Speech pattern looks solid. Keep your pace and clarity consistent.");
  }

  return {
    score: round(score, 2),
    metrics,
    feedback,
    warnings,
    ...evaluateQuestionResponses(questionResponses),
  };
};

const extractGazeBreaks = (frames: VisionFrame[], breakThreshold: number) => {
  if (frames.length === 0) {
    return { breaks: 0, breakFrames: 0 };
  }

  const framesSorted = [...frames].sort((left, right) => left.timestamp - right.timestamp);
  let breaks = 0;
  let breakFrames = 0;
  let inBreak = false;
  let breakStart = 0;

  framesSorted.forEach((frame) => {
    const looking = frame.face_present ? Boolean(frame.looking_at_camera) : false;
    const timestamp = frame.timestamp;

    if (!looking) {
      if (!inBreak) {
        inBreak = true;
        breakStart = timestamp;
      }
      breakFrames += 1;
      return;
    }

    if (inBreak) {
      if (timestamp - breakStart >= breakThreshold) {
        breaks += 1;
      }
      inBreak = false;
    }
  });

  return { breaks, breakFrames };
};

const extractVideoFeatures = (frames: VisionFrame[], longGazeBreakThreshold = 2) => {
  const warnings: string[] = [];

  if (frames.length === 0) {
    warnings.push("No video frames provided.");
    return {
      features: {
        face_presence_rate: 0,
        gaze_at_camera_rate: 0,
        smile_rate: 0,
        avg_smile_prob: 0,
        head_movement_std: 0,
        long_gaze_break_rate: 0,
        avg_mouth_open_ratio: 0,
        articulation_active_rate: 0,
        avg_mouth_movement_delta: 0,
      },
      metrics: {
        frame_count: 0,
        face_presence_rate: 0,
        gaze_at_camera_rate: 0,
        smile_rate: 0,
        avg_smile_prob: 0,
        head_movement_std: 0,
        long_gaze_break_rate: 0,
        long_gaze_breaks: 0,
        gaze_break_frames: 0,
        mouth_frame_count: 0,
        avg_mouth_open_ratio: 0,
        avg_mouth_movement_delta: 0,
        articulation_active_rate: 0,
      },
      warnings,
    };
  }

  const framesSorted = [...frames].sort((left, right) => left.timestamp - right.timestamp);
  const frameCount = framesSorted.length;
  const facePresenceRate = framesSorted.filter((frame) => frame.face_present).length / frameCount;
  const gazeAtCameraRate =
    framesSorted.filter((frame) => frame.face_present && frame.looking_at_camera).length / frameCount;
  const smileProbs = framesSorted
    .filter((frame) => frame.face_present)
    .map((frame) => frame.smile_prob ?? 0);
  const avgSmileProb = mean(smileProbs);
  const smileRate = smileProbs.filter((probability) => probability >= 0.6).length / frameCount;
  const yaw = framesSorted
    .filter((frame) => frame.face_present)
    .map((frame) => frame.head_yaw ?? 0);
  const pitch = framesSorted
    .filter((frame) => frame.face_present)
    .map((frame) => frame.head_pitch ?? 0);
  const headMovementStd = mean([stdev(yaw), stdev(pitch)]);
  const gazeBreaks = extractGazeBreaks(framesSorted, longGazeBreakThreshold);
  const longGazeBreakRate = gazeBreaks.breaks / (frameCount / 30);
  const mouthOpenRatios: number[] = [];
  const mouthMovementDeltas: number[] = [];
  const articulationSamples: number[] = [];

  framesSorted.forEach((frame) => {
    if (!frame.face_present) return;

    if (typeof frame.mouth_open_ratio === "number") {
      mouthOpenRatios.push(frame.mouth_open_ratio);
    }
    if (typeof frame.mouth_movement_delta === "number") {
      mouthMovementDeltas.push(frame.mouth_movement_delta);
    }
    if (typeof frame.articulation_active === "boolean") {
      articulationSamples.push(frame.articulation_active ? 1 : 0);
    }
  });

  const avgMouthOpenRatio = mean(mouthOpenRatios);
  const articulationActiveRate = mean(articulationSamples);
  const avgMouthMovementDelta = mean(mouthMovementDeltas);
  const features = {
    face_presence_rate: facePresenceRate,
    gaze_at_camera_rate: gazeAtCameraRate,
    smile_rate: smileRate,
    avg_smile_prob: avgSmileProb,
    head_movement_std: headMovementStd,
    long_gaze_break_rate: longGazeBreakRate,
    avg_mouth_open_ratio: avgMouthOpenRatio,
    articulation_active_rate: articulationActiveRate,
    avg_mouth_movement_delta: avgMouthMovementDelta,
  };
  const metrics = {
    frame_count: frameCount,
    face_presence_rate: round(facePresenceRate, 4),
    gaze_at_camera_rate: round(gazeAtCameraRate, 4),
    smile_rate: round(smileRate, 4),
    avg_smile_prob: round(avgSmileProb, 4),
    head_movement_std: round(headMovementStd, 4),
    long_gaze_break_rate: round(longGazeBreakRate, 4),
    long_gaze_breaks: gazeBreaks.breaks,
    gaze_break_frames: gazeBreaks.breakFrames,
    mouth_frame_count: mouthOpenRatios.length,
    avg_mouth_open_ratio: round(avgMouthOpenRatio, 4),
    avg_mouth_movement_delta: round(avgMouthMovementDelta, 4),
    articulation_active_rate: round(articulationActiveRate, 4),
  };

  return { features, metrics, warnings };
};

export const generateVideoFeedback = (frames: VisionFrame[]): VideoFeedbackResult => {
  const { features, metrics, warnings } = extractVideoFeatures(frames);
  const rawScore = predictLinear(features, VIDEO_MODEL_WEIGHTS, 0.1);
  const score = logisticScore(rawScore);
  const feedback: string[] = [];

  if ((metrics.face_presence_rate ?? 0) < 0.9) {
    feedback.push("Face visibility drops often. Center yourself in the frame.");
  }
  if ((metrics.gaze_at_camera_rate ?? 0) < 0.6) {
    feedback.push("Eye contact is low. Look at the camera while speaking.");
  }
  if ((metrics.long_gaze_breaks ?? 0) > 0) {
    feedback.push("Long gaze breaks detected. Return to the camera more consistently.");
  }
  if ((metrics.avg_smile_prob ?? 0) < 0.2) {
    feedback.push("Facial warmth is low. Add a natural smile at key moments.");
  }
  if ((metrics.head_movement_std ?? 0) > 12) {
    feedback.push("Head movement is high. Keep posture steady for clarity.");
  }
  if ((metrics.mouth_frame_count ?? 0) > 0 && (metrics.avg_mouth_open_ratio ?? 0) < 0.12) {
    feedback.push(
      "Mouth opening stays fairly small. Open a bit wider on vowels so your words look more distinct."
    );
  }
  if ((metrics.mouth_frame_count ?? 0) > 0 && (metrics.avg_mouth_movement_delta ?? 0) < 0.018) {
    feedback.push(
      "Lip movement is subtle. Try slightly stronger articulation on consonants and stressed words."
    );
  }
  if ((metrics.mouth_frame_count ?? 0) > 0 && (metrics.articulation_active_rate ?? 0) < 0.35) {
    feedback.push(
      "Visible articulation is limited for much of the session. Keep your jaw and lips more engaged while speaking."
    );
  }

  if (feedback.length === 0) {
    feedback.push("Video presence looks solid. Keep steady eye contact, posture, and clear mouth movement.");
  }

  return {
    score: round(score, 2),
    metrics,
    feedback,
    warnings,
  };
};
