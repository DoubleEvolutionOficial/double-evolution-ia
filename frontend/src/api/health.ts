import { LaboratoryHealth } from "../types/laboratory";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export async function fetchHealth(): Promise<LaboratoryHealth> {
  const response = await fetch(`${API_BASE_URL}/api/v1/laboratory/health`);
  if (!response.ok) {
    throw new Error("Falha ao buscar health");
  }
  return response.json();
}
