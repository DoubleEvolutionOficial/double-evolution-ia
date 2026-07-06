export type LearningSnapshot = {
  learning_score: number;
  samples: number;
  accuracy: number;
  adaptation_level: number;
  stability: number;
  last_updated_at: string | null;
  pattern_memory: Record<string, number>;
  trend_memory: {
    up: number;
    down: number;
    flat: number;
    behavior_changes: number;
    average_gap_seconds: number;
  };
};

export type LearningEngineState = {
  history: Array<{
    timestamp: string;
    color: "red" | "black" | "white";
    number: number;
    white: boolean;
    sequence: string[];
  }>;
  pattern_frequency: Record<string, number>;
  transitions: Record<string, Record<string, number>>;
  hits: number;
  prediction_count: number;
  trend_up: number;
  trend_down: number;
  trend_flat: number;
  behavior_changes: number;
  total_gap_seconds: number;
  gap_count: number;
  last_window_dominant: string | null;
  snapshot: LearningSnapshot;
};