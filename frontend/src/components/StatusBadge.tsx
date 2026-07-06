type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  let tone = "warning";
  if (normalized === "online" || normalized === "sucesso" || normalized === "success") {
    tone = "success";
  } else if (normalized === "offline" || normalized === "erro" || normalized === "error") {
    tone = "danger";
  } else if (normalized === "loading") {
    tone = "info";
  }

  return (
    <span className={`status-badge status-badge-${tone}`}>
      {status.toUpperCase()}
    </span>
  );
}