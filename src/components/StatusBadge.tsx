import type { ReconStatus } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<ReconStatus, { label: string; cls: string }> = {
  balanced: { label: "Balanced", cls: "bg-success text-success-foreground" },
  minor: { label: "Minor diff", cls: "bg-warning text-warning-foreground" },
  mismatch: { label: "Mismatch", cls: "bg-destructive text-destructive-foreground" },
  pending: { label: "Pending advice", cls: "bg-info text-info-foreground" },
  adviceOnly: { label: "Advice only", cls: "bg-info/70 text-info-foreground" },
  adjustment: { label: "Adjustment", cls: "bg-neutral text-neutral-foreground" },
  parseIssue: { label: "Parse issue", cls: "bg-warning/70 text-warning-foreground" },
};

export function StatusBadge({ status, className }: { status: ReconStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tracking-tight",
        meta.cls,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export const STATUS_LABELS = STATUS_META;
