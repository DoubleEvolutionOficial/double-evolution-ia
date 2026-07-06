export type PatternRankLabel =
  | "Elite"
  | "Excellent"
  | "Good"
  | "Average"
  | "Weak"
  | "Discarded";

export type RankedPattern = {
  id: string;
  pattern: string;
  rank: PatternRankLabel;
  global_score: number;
  confidence_score: number;
  historical_accuracy: number;
  recent_accuracy: number;
  trend_score: number;
  risk_score: number;
  stability_score: number;
  learning_score: number;
  final_rank: number;
  occurrences: number;
  confidence: number;
  accuracy: number;
  last_seen: string | null;
  status: "active" | "discarded";
};

export type PatternRankingResult = {
  ranked_patterns: RankedPattern[];
  scanned_at: string;
};