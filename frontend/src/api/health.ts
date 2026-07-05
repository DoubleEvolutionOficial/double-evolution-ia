export type HealthStatus = {
  status: string;
  project: string;
  version: string;
};

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch("/health");
  if (!response.ok) {
    throw new Error("Falha ao buscar health");
  }
  return response.json();
}
