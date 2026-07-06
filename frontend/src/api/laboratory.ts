import {
  LaboratoryAnalyzeRequest,
  LaboratoryAnalyzeResponse,
} from "../types/laboratory";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export async function analyzeLaboratory(
  payload: LaboratoryAnalyzeRequest
): Promise<LaboratoryAnalyzeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/laboratory/analyze`, {
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