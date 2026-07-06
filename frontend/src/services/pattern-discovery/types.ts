export type DiscoveredPattern = {
  id: string;
  pattern: string;
  category:
    | "sequencias"
    | "combinacoes"
    | "repeticoes_temporais"
    | "ciclos"
    | "intervalos"
    | "tendencias"
    | "anomalias"
    | "regimes"
    | "mudancas_comportamento";
  confidence: number;
  occurrences: number;
  accuracy: number;
  average_delay: number;
  expected_probability: number;
  status: "accepted" | "discarded";
  is_new: boolean;
};

export type PatternDiscoverySummary = {
  total_patterns: number;
  new_patterns: number;
  high_confidence: number;
  discarded_patterns: number;
  discovery_progress: number;
};

export type PatternDiscoveryResult = {
  summary: PatternDiscoverySummary;
  patterns: DiscoveredPattern[];
  scanned_at: string;
};