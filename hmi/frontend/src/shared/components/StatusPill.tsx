export function StatusPill({
  variant = "default",
  label,
}: {
  variant?: "default" | "ok" | "sim" | "view" | "fault";
  label: string;
}) {
  const className = variant === "default" ? "pill" : `pill ${variant}`;
  return <span className={className}>{label}</span>;
}

