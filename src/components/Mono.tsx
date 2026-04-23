export function Mono({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`font-mono text-[0.85em] tracking-tight ${className}`}>{children}</span>;
}
