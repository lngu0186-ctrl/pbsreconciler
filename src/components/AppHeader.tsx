import { FileText } from "lucide-react";

export function AppHeader() {
  return (
    <header className="border-b border-border bg-brand-navy text-brand-navy-foreground">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">PBS Claim Reconciliation</h1>
            <p className="text-xs text-brand-navy-foreground/70">
              Australian Community Pharmacy PBS Reconciliation Tool
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-brand-navy-foreground/70">
          <div>Client-side reconciliation · No data leaves this device</div>
        </div>
      </div>
    </header>
  );
}
