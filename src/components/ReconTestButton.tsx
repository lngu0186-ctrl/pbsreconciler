import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Beaker, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { runReconciliationTests, type ReconTestRun } from "@/lib/reconcileTests";
import { cn } from "@/lib/utils";

export function ReconTestButton() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<ReconTestRun[]>([]);

  const handleRun = () => {
    setRunning(true);
    setOpen(true);
    // Defer to next tick so the dialog opens with the spinner first.
    setTimeout(() => {
      try {
        const result = runReconciliationTests();
        setRuns(result);
      } finally {
        setRunning(false);
      }
    }, 0);
  };

  const allPassed = runs.length > 0 && runs.every((r) => r.passed);

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleRun} className="w-full">
        <Beaker className="mr-1.5 h-3.5 w-3.5" />
        Run reconciliation test
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : allPassed ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              Reconciliation self-test
            </DialogTitle>
            <DialogDescription>
              Replays the built-in sample dataset and verifies the reconciliation engine produces
              the expected Balanced/Mismatch/Pending counts and issue flags.
            </DialogDescription>
          </DialogHeader>

          {running && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running tests…
            </div>
          )}

          {!running && runs.length > 0 && (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-4">
                {runs.map((run) => {
                  const passedCount = run.checks.filter((c) => c.passed).length;
                  return (
                    <div
                      key={run.name}
                      className={cn(
                        "rounded-md border p-3",
                        run.passed
                          ? "border-success/30 bg-success/5"
                          : "border-destructive/30 bg-destructive/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            {run.passed ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                            )}
                            {run.name}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{run.description}</p>
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-foreground">
                          <div className="font-medium text-foreground">
                            {passedCount}/{run.checks.length} checks
                          </div>
                          <div>{run.durationMs.toFixed(1)} ms</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                        {Object.entries(run.actualStatusCounts).map(([status, count]) => (
                          <span
                            key={status}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono"
                          >
                            {status}: <span className="font-semibold">{count}</span>
                          </span>
                        ))}
                      </div>

                      <ul className="mt-3 space-y-1 text-xs">
                        {run.checks.map((c, i) => (
                          <li
                            key={i}
                            className={cn(
                              "flex items-start gap-2 rounded px-2 py-1",
                              c.passed ? "text-foreground" : "bg-destructive/10 text-destructive",
                            )}
                          >
                            {c.passed ? (
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                            ) : (
                              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                            )}
                            <span className="min-w-0 flex-1">
                              {c.label}
                              {c.detail && (
                                <span className="ml-1 text-muted-foreground">— {c.detail}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
