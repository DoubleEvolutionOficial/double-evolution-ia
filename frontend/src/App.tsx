import { useEffect, useState } from "react";
import { fetchHealth, HealthStatus } from "./api/health";

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(console.error);
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Double Evolution IA</h1>
      {health ? (
        <section>
          <p>Status: {health.status}</p>
          <p>Project: {health.project}</p>
          <p>Version: {health.version}</p>
        </section>
      ) : (
        <p>Carregando status...</p>
      )}
    </main>
  );
}

export default App;
