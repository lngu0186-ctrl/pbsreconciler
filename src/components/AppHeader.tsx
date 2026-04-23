export function AppHeader() {
  return (
    <header className="border-b border-border bg-brand-navy text-brand-navy-foreground">
      <div className="flex items-center justify-between px-5 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Hugh's PBS Claim Reconciliation App
          </h1>
          <p className="text-xs text-brand-navy-foreground/70">
            Blackshaws Road Pharmacy — Supplier 25374L
          </p>
        </div>
        <div className="text-right text-xs text-brand-navy-foreground/70">
          <div>Client-side reconciliation · No data leaves this device</div>
        </div>
      </div>
    </header>
  );
}
