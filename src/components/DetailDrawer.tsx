import { useAppStore } from "@/store/appStore";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Mono } from "@/components/Mono";
import { formatAUD, formatSignedAUD, formatNumber } from "@/lib/currency";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

export function DetailDrawer() {
  const selectedId = useAppStore((s) => s.selectedPbsId);
  const results = useAppStore((s) => s.results);
  const select = useAppStore((s) => s.selectPbs);
  const result = results.find((r) => r.pbsPaymentId === selectedId);

  return (
    <Sheet open={!!selectedId} onOpenChange={(open) => !open && select(undefined)}>
      <SheetContent side="right" className="w-full max-w-[560px] overflow-y-auto sm:max-w-[560px]">
        {result && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <Mono className="text-base">{result.pbsPaymentId}</Mono>
                <StatusBadge status={result.status} />
              </SheetTitle>
              <div className="text-xs text-muted-foreground">
                Claim period{" "}
                <Mono>{result.claimPeriodFromSummary || result.claimPeriodFromAdvice || "—"}</Mono>{" "}
                · Bank ref{" "}
                <Mono>{result.bankReferenceSummary || result.bankReferenceAdvice || "—"}</Mono>
              </div>
            </SheetHeader>

            {result.notes.length > 0 && (
              <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                {result.notes.map((n, i) => (
                  <div key={i}>• {n}</div>
                ))}
              </div>
            )}

            <section className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Comparison
              </h3>
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                      <th className="px-3 py-2 text-right font-medium">Summary</th>
                      <th className="px-3 py-2 text-right font-medium">Advice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border [&>tr>td]:px-3 [&>tr>td]:py-1.5">
                    <Row
                      label="General benefits"
                      s={result.summaryRecord?.generalBenefits}
                      a={result.adviceRecord?.generalBenefits}
                    />
                    <Row
                      label="General under-co"
                      s={undefined}
                      a={result.adviceRecord?.generalUnderCoBenefits}
                    />
                    <Row
                      label="Concessional benefits"
                      s={result.summaryRecord?.concessionalBenefits}
                      a={result.adviceRecord?.concessionalBenefits}
                    />
                    <Row
                      label="Entitlement / free"
                      s={result.summaryRecord?.entitlementBenefits}
                      a={result.adviceRecord?.entitlementBenefits}
                    />
                    <Row
                      label="Repatriation (RPBS)"
                      s={result.summaryRecord?.repatriationBenefits}
                      a={result.adviceRecord?.repatriationBenefits}
                    />
                    <Row
                      label="Doctor's Bag"
                      s={result.summaryRecord?.doctorsBagBenefits}
                      a={result.adviceRecord?.doctorsBagBenefits}
                    />
                    <tr className="bg-muted/30 font-semibold">
                      <td>Subtotal / Total PBS</td>
                      <td className="text-right tabular-nums">
                        {formatAUD(result.summarySubtotal)}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatAUD(result.adviceTotalPBS)}
                      </td>
                    </tr>
                    <Row
                      label="Total (PBS + RPBS)"
                      s={undefined}
                      a={result.adviceTotalPBSPlusRPBS}
                    />
                    <tr>
                      <td className="text-muted-foreground">ACSS component 1</td>
                      <td></td>
                      <td className="text-right tabular-nums">
                        {formatAUD(result.adviceRecord?.acssComponentOneAmount)}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted-foreground">ACSS component 2</td>
                      <td></td>
                      <td className="text-right tabular-nums">
                        {formatAUD(result.adviceRecord?.acssComponentTwoAmount)}
                      </td>
                    </tr>
                    <tr className="font-medium">
                      <td>Total ACSS fees</td>
                      <td></td>
                      <td className="text-right tabular-nums">{formatAUD(result.acssTotal)}</td>
                    </tr>
                    <tr className="bg-muted/30 font-semibold">
                      <td>Banked total</td>
                      <td></td>
                      <td className="text-right tabular-nums">{formatAUD(result.bankedTotal)}</td>
                    </tr>
                    <tr
                      className={
                        result.difference !== undefined && Math.abs(result.difference) >= 1
                          ? "bg-destructive/10 font-semibold text-destructive"
                          : "bg-success/10 font-semibold text-success"
                      }
                    >
                      <td>Difference (Advice − Summary)</td>
                      <td></td>
                      <td className="text-right tabular-nums">
                        {formatSignedAUD(result.difference)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <Meta
                label="Rx transactions"
                value={formatNumber(result.summaryRecord?.rxTransactions)}
              />
              <Meta label="Amount paid" value={formatAUD(result.summaryRecord?.amountPaid)} />
              <Meta label="Advice date" value={result.adviceRecord?.adviceDate || "—"} />
              <Meta label="Payment date" value={result.adviceRecord?.paymentDate || "—"} />
              <Meta label="Summary file" value={result.summaryRecord?.sourceFileName || "—"} />
              <Meta label="Advice file" value={result.adviceRecord?.sourceFileName || "—"} />
              <Meta
                label="Parse confidence"
                value={`${Math.round((((result.summaryRecord?.parseConfidence ?? 1) + (result.adviceRecord?.parseConfidence ?? 1)) / 2) * 100)}%`}
              />
              <Meta label="Issue flags" value={result.issueFlags.join(", ") || "—"} />
            </section>

            {(result.summaryRecord?.rawTextBlock || result.adviceRecord?.rawTextBlock) && (
              <section className="mt-4 space-y-2">
                {result.summaryRecord?.rawTextBlock && (
                  <RawBlock
                    title="Summary extracted text"
                    text={result.summaryRecord.rawTextBlock}
                  />
                )}
                {result.adviceRecord?.rawTextBlock && (
                  <RawBlock title="Advice extracted text" text={result.adviceRecord.rawTextBlock} />
                )}
              </section>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, s, a }: { label: string; s?: number; a?: number }) {
  return (
    <tr>
      <td className="text-muted-foreground">{label}</td>
      <td className="text-right tabular-nums">{s !== undefined ? formatAUD(s) : "—"}</td>
      <td className="text-right tabular-nums">{a !== undefined ? formatAUD(a) : "—"}</td>
    </tr>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function RawBlock({ title, text }: { title: string; text: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium hover:bg-muted/50">
        {title}
        <ChevronDown className="h-3.5 w-3.5" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-1 max-h-48 overflow-auto rounded-md border border-border bg-card p-2 font-mono text-[10px] leading-snug text-muted-foreground">
          {text}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
