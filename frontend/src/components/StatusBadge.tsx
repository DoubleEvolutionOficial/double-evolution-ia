type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const tone = normalized === "online" ? "success" : "warning";

  return (
    <span className={`status-badge status-badge-${tone}`}>
      {status.toUpperCase()}
    </span>
  );
}