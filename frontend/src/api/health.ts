import { LaboratoryHealth } from "../types/laboratory";
import { buildApiUrl } from "./config";

export async function fetchHealth(): Promise<LaboratoryHealth> {
  const response = await fetch(buildApiUrl("/api/v1/laboratory/health"));
  if (!response.ok) {
    throw new Error("Falha ao buscar health");
  }
  return response.json();
}
