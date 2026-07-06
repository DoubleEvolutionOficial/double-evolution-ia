export type LaboratoryHealth = {
  status: string;
  module: string;
};

export type LaboratoryEvent = {
  timestamp: string;
  hour: number;
  minute: number;
  side: string;
  distance: number;
  classification: string;
  confidence: number;
  score: number;
  triggered_rules: string[];
  recommendation?: string;
};

export type LaboratoryAnalyzeRequest = {
  events: LaboratoryEvent[];
};

export type LaboratoryAnalyzeResponse = {
  statistics: Record<string, unknown>;
  patterns: unknown[];
  regime: unknown[];
  trend: Record<string, unknown>;
  seasonality: Record<string, unknown>;
  correlation: Record<string, unknown>;
  probability: Record<string, unknown>;
  risk: Record<string, unknown>;
  consensus: Record<string, unknown>;
  confidence: Record<string, unknown>;
  signal: Record<string, unknown>;
  explanation: Record<string, unknown>;
};