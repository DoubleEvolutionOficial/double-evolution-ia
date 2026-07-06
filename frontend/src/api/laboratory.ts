import {
  LaboratoryAnalyzeRequest,
  LaboratoryAnalyzeResponse,
} from "../types/laboratory";
import { buildApiUrl } from "./config";

export async function analyzeLaboratory(
  payload: LaboratoryAnalyzeRequest
): Promise<LaboratoryAnalyzeResponse> {
  const response = await fetch(buildApiUrl("/api/v1/laboratory/analyze"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Falha ao executar análise do Laboratory");
  }

  return response.json();
}