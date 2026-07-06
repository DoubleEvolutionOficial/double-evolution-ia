export type LearningSnapshot = {
  learning_score: number;
  samples: number;
  accuracy: number;
  adaptation_level: number;
  stability: number;
  pattern_memory: Record<string, number>;
  trend_memory: {
    up: number;
    down: number;
    flat: number;
    behavior_changes: number;
    average_gap_seconds: number;
  };
};