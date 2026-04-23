import { Fragment, useMemo, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge, STATUS_LABELS } from "@/components/StatusBadge";
import { Mono } from "@/components/Mono";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { formatAUD, formatSignedAUD, formatNumber } from "@/lib/currency";
import { downloadCsv } from "@/lib/csv";
import { Download, Search, Info, AlertTriangle, Clock, FileWarning } from "lucide-react";
import type { ReconResult, ReconStatus } from "@/types";

function StatusFilter({
  value,
  onChange,
}: {
  value: ReconStatus | "all";
  onChange: (v: ReconStatus | "all") => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ReconStatus | "all")}>
      <SelectTrigger className="h-8 w-[160px] text-xs">
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        {(Object.keys(STATUS_LABELS) as ReconStatus[]).map((k) => (
          <SelectItem key={k} value={k}>
            {STATUS_LABELS[k].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function useFilteredResults(): {
  search: string;
  setSearch: (v: string) => void;
  filter: ReconStatus | "all";
  setFilter: (v: ReconStatus | "all") => void;
  filtered: ReconResult[];
} {
  const results = useAppStore((s) => s.results);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReconStatus | "all">("all");
  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.pbsPaymentId.includes(q) &&
          !(r.bankReferenceSummary ?? "").includes(q) &&
          !(r.bankReferenceAdvice ?? "").includes(q)
        )
          return false;
      }
      return true;
    });
  }, [results, search, filter]);
  return { search, setSearch, filter, setFilter, filtered };
}

function exportRowsForResults(rows: ReconResult[]) {
  return rows.map((r) => ({
    pbsPaymentId: r.pbsPaymentId,
    status: STATUS_LABELS[r.status].label,
    claimPeriodSummary: r.claimPeriodFromSummary ?? "",
    claimPeriodAdvice: r.claimPeriodFromAdvice ?? "",
    bankReferenceSummary: r.bankReferenceSummary ?? "",
    bankReferenceAdvice: r.bankReferenceAdvice ?? "",
    summarySubtotal: r.summarySubtotal ?? "",
    adviceComparable: r.adviceComparableTotal ?? "",
    acssTotal: r.acssTotal ?? "",
    bankedTotal: r.bankedTotal ?? "",
    difference: r.difference ?? "",
    issueFlags: r.issueFlags.join("|"),
    notes: r.notes.join("|"),
  }));
}

// ---------- OVERVIEW ----------
export function OverviewTab() {
  const summaries = useAppStore((s) => s.summaries);
  const advices = useAppStore((s) => s.advices);
  const results = useAppStore((s) => s.results);
  const select = useAppStore((s) => s.selectPbs);

  const counts = useMemo(() => {
    const c: Record<ReconStatus, number> = {
      balanced: 0, minor: 0, mismatch: 0, pending: 0,
      adviceOnly: 0, adjustment: 0, parseIssue: 0,
    };
    for (const r of results) c[r.status]++;
    return c;
  }, [results]);

  const totals = useMemo(() => {
    const sumExpected = results.reduce((s, r) => s + (r.summarySubtotal ?? 0), 0);
    const sumAdvice = results.reduce((s, r) => s + (r.adviceComparableTotal ?? 0), 0);
    const sumBanked = results.reduce((s, r) => s + (r.bankedTotal ?? 0), 0);
    return { sumExpected, sumAdvice, sumBanked };
  }, [results]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard title="Summary records" value={formatNumber(summaries.length)} />
        <KpiCard title="Advice records" value={formatNumber(advices.length)} />
        <KpiCard title="Balanced" value={formatNumber(counts.balanced)} tone="success" />
        <KpiCard title="Mismatches" value={formatNumber(counts.mismatch)} tone="destructive" />
        <KpiCard title="Pending advice" value={formatNumber(counts.pending)} tone="info" />
        <KpiCard title="Parse issues" value={formatNumber(counts.parseIssue)} tone="warning" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard title="Expected subtotal (Summary)" value={formatAUD(totals.sumExpected)} />
        <KpiCard title="Comparable advice total" value={formatAUD(totals.sumAdvice)} hint="Total PBS + RPBS where present" />
        <KpiCard title="Banked total (incl. ACSS)" value={formatAUD(totals.sumBanked)} tone="info" />
      </div>

      {counts.mismatch > 0 && (
        <Banner tone="destructive" icon={<AlertTriangle className="h-4 w-4" />}>
          <strong>{counts.mismatch}</strong> reconciliation mismatch(es) detected. Review the Matched tab.
        </Banner>
      )}
      {counts.pending > 0 && (
        <Banner tone="info" icon={<Clock className="h-4 w-4" />}>
          <strong>{counts.pending}</strong> PBS payment ID(s) awaiting Medicare advice. This is normal for very recent claim periods.
        </Banner>
      )}
      {counts.parseIssue > 0 && (
        <Banner tone="warning" icon={<FileWarning className="h-4 w-4" />}>
          <strong>{counts.parseIssue}</strong> record(s) parsed with low confidence. Review the Parse Warnings tab.
        </Banner>
      )}

      <Card className="overflow-hidden border-border/60">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
          <div className="text-sm font-semibold">Reconciliation overview</div>
          <Button variant="outline" size="sm" onClick={() => downloadCsv("pbs_recon_overview.csv", exportRowsForResults(results))}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
        <ResultsTable rows={results} onSelect={select} />
      </Card>

      <Card className="border-border/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Info className="h-4 w-4 text-info" />
          How reconciliation works
        </div>
        <ul className="ml-5 list-disc space-y-1 text-xs text-muted-foreground">
          <li>Records are matched by <Mono>PBS payment ID</Mono>.</li>
          <li>The summary <em>subtotal</em> is compared to the advice <em>Total PBS</em> (or <em>Total PBS + RPBS</em> when present).</li>
          <li>ACSS dispensing fees are added by Medicare on top — they're excluded from the core subtotal match but included in the banked total.</li>
          <li>Differences under <Mono>$0.02</Mono> are Balanced. Under <Mono>$1.00</Mono> are Minor (often General Under-Co split). Above that is a Mismatch.</li>
          <li>Older-period or negative entries are flagged as Adjustments.</li>
          <li>Safety Net statements live in their own tab and are not mixed into PBS claim totals.</li>
        </ul>
      </Card>
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "destructive" | "warning" | "info";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls = {
    destructive: "border-destructive/30 bg-destructive/10 text-destructive",
    warning: "border-warning/40 bg-warning/10 text-warning",
    info: "border-info/40 bg-info/10 text-info",
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${cls}`}>
      <span className="mt-0.5">{icon}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function ResultsTable({ rows, onSelect }: { rows: ReconResult[]; onSelect: (id: string) => void }) {
  if (rows.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">No records to display.</div>;
  }
  return (
    <div className="max-h-[60vh] overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
          <tr className="text-left uppercase tracking-wide text-muted-foreground [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
            <th>PBS Payment ID</th>
            <th>Period</th>
            <th>Bank ref</th>
            <th className="text-right">Summary subtotal</th>
            <th className="text-right">Advice comparable</th>
            <th className="text-right">Difference</th>
            <th className="text-right">Banked total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr
              key={r.pbsPaymentId}
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => onSelect(r.pbsPaymentId)}
            >
              <td className="px-3 py-1.5"><Mono>{r.pbsPaymentId}</Mono></td>
              <td className="px-3 py-1.5"><Mono>{r.claimPeriodFromSummary || r.claimPeriodFromAdvice || "—"}</Mono></td>
              <td className="px-3 py-1.5"><Mono>{r.bankReferenceSummary || r.bankReferenceAdvice || "—"}</Mono></td>
              <td className="px-3 py-1.5 text-right tabular-nums">{r.summarySubtotal !== undefined ? formatAUD(r.summarySubtotal) : "—"}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{r.adviceComparableTotal !== undefined ? formatAUD(r.adviceComparableTotal) : "—"}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${
                r.difference !== undefined && Math.abs(r.difference) >= 1 ? "text-destructive font-semibold" : ""
              }`}>
                {r.difference !== undefined ? formatSignedAUD(r.difference) : "—"}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{r.bankedTotal !== undefined ? formatAUD(r.bankedTotal) : "—"}</td>
              <td className="px-3 py-1.5"><StatusBadge status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- MATCHED ----------
export function MatchedTab() {
  const select = useAppStore((s) => s.selectPbs);
  const { search, setSearch, filter, setFilter, filtered } = useFilteredResults();
  const matched = filtered.filter(
    (r) => r.summaryRecord && r.adviceRecord,
  );
  return (
    <div className="space-y-3">
      <Toolbar
        search={search}
        setSearch={setSearch}
        filter={filter}
        setFilter={setFilter}
        onExport={() => downloadCsv("pbs_recon_matched.csv", exportRowsForResults(matched))}
        exportLabel="Export matched"
      />
      <Card className="overflow-hidden border-border/60">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <tr className="text-left uppercase tracking-wide text-muted-foreground [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium">
                <th>PBS ID</th>
                <th>Period S</th>
                <th>Period A</th>
                <th className="text-right">Gen</th>
                <th className="text-right">Con</th>
                <th className="text-right">Ent</th>
                <th className="text-right">Repat</th>
                <th className="text-right">Sum sub</th>
                <th className="text-right">PBS</th>
                <th className="text-right">PBS+RPBS</th>
                <th className="text-right">ACSS</th>
                <th className="text-right">Banked</th>
                <th className="text-right">Diff</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {matched.map((r) => (
                <tr key={r.pbsPaymentId} className="cursor-pointer hover:bg-muted/40" onClick={() => select(r.pbsPaymentId)}>
                  <td className="px-2 py-1.5"><Mono>{r.pbsPaymentId}</Mono></td>
                  <td className="px-2 py-1.5"><Mono>{r.claimPeriodFromSummary ?? "—"}</Mono></td>
                  <td className="px-2 py-1.5"><Mono>{r.claimPeriodFromAdvice ?? "—"}</Mono></td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatAUD(r.summaryRecord?.generalBenefits)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatAUD(r.summaryRecord?.concessionalBenefits)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatAUD(r.summaryRecord?.entitlementBenefits)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatAUD(r.summaryRecord?.repatriationBenefits)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">{formatAUD(r.summarySubtotal)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatAUD(r.adviceTotalPBS)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.adviceTotalPBSPlusRPBS !== undefined ? formatAUD(r.adviceTotalPBSPlusRPBS) : "—"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{formatAUD(r.acssTotal)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatAUD(r.bankedTotal)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${r.difference !== undefined && Math.abs(r.difference) >= 1 ? "text-destructive font-semibold" : ""}`}>
                    {r.difference !== undefined ? formatSignedAUD(r.difference) : "—"}
                  </td>
                  <td className="px-2 py-1.5"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {matched.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No matched records.</div>
        )}
      </Card>
    </div>
  );
}

function Toolbar({
  search, setSearch, filter, setFilter, onExport, exportLabel,
}: {
  search: string;
  setSearch: (v: string) => void;
  filter: ReconStatus | "all";
  setFilter: (v: ReconStatus | "all") => void;
  onExport: () => void;
  exportLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PBS ID or bank ref"
          className="h-8 w-[260px] pl-7 text-xs"
        />
      </div>
      <StatusFilter value={filter} onChange={setFilter} />
      <div className="flex-1" />
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {exportLabel}
      </Button>
    </div>
  );
}

// ---------- UNMATCHED ----------
export function UnmatchedTab() {
  const results = useAppStore((s) => s.results);
  const select = useAppStore((s) => s.selectPbs);
  const inSummaryOnly = results.filter((r) => r.summaryRecord && !r.adviceRecord);
  const inAdviceOnly = results.filter((r) => !r.summaryRecord && r.adviceRecord);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/60">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
          <div className="text-sm font-semibold">In Summary only ({inSummaryOnly.length})</div>
          <Button variant="outline" size="sm" onClick={() => downloadCsv("pbs_summary_only.csv", exportRowsForResults(inSummaryOnly))}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
          </Button>
        </div>
        {inSummaryOnly.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">All summary IDs have matching advice. ✓</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                <th>PBS ID</th><th>Period</th><th>Bank ref</th><th className="text-right">Rx</th><th className="text-right">Amt paid</th><th className="text-right">Subtotal</th><th>Likely reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inSummaryOnly.map((r) => (
                <tr key={r.pbsPaymentId} className="cursor-pointer hover:bg-muted/40" onClick={() => select(r.pbsPaymentId)}>
                  <td className="px-3 py-1.5"><Mono>{r.pbsPaymentId}</Mono></td>
                  <td className="px-3 py-1.5"><Mono>{r.claimPeriodFromSummary ?? "—"}</Mono></td>
                  <td className="px-3 py-1.5"><Mono>{r.bankReferenceSummary ?? "—"}</Mono></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(r.summaryRecord?.rxTransactions)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatAUD(r.summaryRecord?.amountPaid)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatAUD(r.summarySubtotal)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">Awaiting Medicare advice</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-hidden border-border/60">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
          <div className="text-sm font-semibold">In Advice only ({inAdviceOnly.length})</div>
          <Button variant="outline" size="sm" onClick={() => downloadCsv("pbs_advice_only.csv", exportRowsForResults(inAdviceOnly))}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
          </Button>
        </div>
        {inAdviceOnly.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">All advice IDs are present in the summary. ✓</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                <th>PBS ID</th><th>Period</th><th>Bank ref</th><th className="text-right">Comparable</th><th className="text-right">Banked</th><th>Likely reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inAdviceOnly.map((r) => (
                <tr key={r.pbsPaymentId} className="cursor-pointer hover:bg-muted/40" onClick={() => select(r.pbsPaymentId)}>
                  <td className="px-3 py-1.5"><Mono>{r.pbsPaymentId}</Mono></td>
                  <td className="px-3 py-1.5"><Mono>{r.claimPeriodFromAdvice ?? "—"}</Mono></td>
                  <td className="px-3 py-1.5"><Mono>{r.bankReferenceAdvice ?? "—"}</Mono></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatAUD(r.adviceComparableTotal)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatAUD(r.bankedTotal)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {r.status === "adjustment" ? "Older-period adjustment / reversal" : "Genuinely unmatched — investigate"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ---------- BANK DEPOSITS ----------
export function BankDepositsTab() {
  const results = useAppStore((s) => s.results);
  const advices = useAppStore((s) => s.advices);
  const select = useAppStore((s) => s.selectPbs);

  const groups = useMemo(() => {
    const map = new Map<string, { results: ReconResult[]; paymentDates: Set<string>; files: Set<string> }>();
    for (const r of results) {
      const key = r.bankReferenceAdvice || r.bankReferenceSummary || "—";
      if (!map.has(key)) map.set(key, { results: [], paymentDates: new Set(), files: new Set() });
      map.get(key)!.results.push(r);
      if (r.adviceRecord?.paymentDate) map.get(key)!.paymentDates.add(r.adviceRecord.paymentDate);
      if (r.adviceRecord?.sourceFileName) map.get(key)!.files.add(r.adviceRecord.sourceFileName);
    }
    return [...map.entries()];
  }, [results]);

  const exportRows = useMemo(() => {
    return groups.flatMap(([bank, g]) =>
      g.results.map((r) => ({
        bankReference: bank,
        pbsPaymentId: r.pbsPaymentId,
        claimPeriod: r.claimPeriodFromAdvice || r.claimPeriodFromSummary || "",
        comparable: r.adviceComparableTotal ?? "",
        acss: r.acssTotal ?? "",
        banked: r.bankedTotal ?? "",
        status: STATUS_LABELS[r.status].label,
      })),
    );
  }, [groups]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {groups.length} bank deposit group(s) · {advices.length} advice record(s)
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadCsv("pbs_bank_deposits.csv", exportRows)}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Export bank deposits
        </Button>
      </div>
      {groups.map(([bank, g]) => {
        const sumComp = g.results.reduce((s, r) => s + (r.adviceComparableTotal ?? 0), 0);
        const sumAcss = g.results.reduce((s, r) => s + (r.acssTotal ?? 0), 0);
        const sumBanked = g.results.reduce((s, r) => s + (r.bankedTotal ?? 0), 0);
        return (
          <Card key={bank} className="overflow-hidden border-border/60">
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Bank ref</span>
                <Mono className="text-sm font-semibold">{bank}</Mono>
              </div>
              <div className="text-muted-foreground">
                {[...g.paymentDates].join(", ") || "—"} · {g.results.length} ID(s)
              </div>
              <div className="ml-auto flex items-center gap-4 tabular-nums">
                <span>Comparable <strong>{formatAUD(sumComp)}</strong></span>
                <span className="text-muted-foreground">ACSS <strong>{formatAUD(sumAcss)}</strong></span>
                <span>Banked <strong className="text-info">{formatAUD(sumBanked)}</strong></span>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-left uppercase tracking-wide text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-1.5 [&>th]:font-medium">
                  <th>PBS ID</th><th>Period</th><th className="text-right">Comparable</th><th className="text-right">ACSS</th><th className="text-right">Banked</th><th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {g.results.map((r) => (
                  <tr key={r.pbsPaymentId} className="cursor-pointer hover:bg-muted/40" onClick={() => select(r.pbsPaymentId)}>
                    <td className="px-3 py-1.5"><Mono>{r.pbsPaymentId}</Mono></td>
                    <td className="px-3 py-1.5"><Mono>{r.claimPeriodFromAdvice || r.claimPeriodFromSummary || "—"}</Mono></td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatAUD(r.adviceComparableTotal)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{formatAUD(r.acssTotal)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatAUD(r.bankedTotal)}</td>
                    <td className="px-3 py-1.5"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}
      {groups.length === 0 && (
        <Card className="border-border/60 p-6 text-center text-sm text-muted-foreground">No bank deposit groups.</Card>
      )}
    </div>
  );
}

// ---------- FILES ----------
export function FilesTab() {
  const files = useAppStore((s) => s.files);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const copyText = (text: string) => {
    void navigator.clipboard?.writeText(text);
  };
  return (
    <Card className="overflow-hidden border-border/60">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
            <th></th><th>File</th><th>Type</th><th>Supplier</th><th>Date</th><th>Bank refs</th><th className="text-right">Records</th><th className="text-right">Confidence</th><th className="text-right">Warnings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {files.map((f) => (
            <Fragment key={f.id}>
              <tr key={f.id}>
                <td className="px-2 py-1.5">
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => toggle(f.id)}>
                    {expanded.has(f.id) ? "▼" : "▶"}
                  </Button>
                </td>
                <td className="px-3 py-1.5"><span className="font-medium">{f.name}</span></td>
                <td className="px-3 py-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">{f.detectedType}</span>
                </td>
                <td className="px-3 py-1.5"><Mono>{f.supplierNumber || "—"}</Mono></td>
                <td className="px-3 py-1.5">{f.paymentDate || f.reportDate || "—"}</td>
                <td className="px-3 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {(f.bankReferences ?? []).map((b) => (
                      <Mono key={b} className="rounded bg-muted px-1 py-0.5 text-[10px]">{b}</Mono>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{f.recordCount}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{Math.round(f.parseConfidence * 100)}%</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${f.warnings.length ? "text-warning" : "text-muted-foreground"}`}>{f.warnings.length}</td>
              </tr>
              {expanded.has(f.id) && (
                <tr key={`${f.id}-raw`} className="bg-muted/20">
                  <td colSpan={9} className="px-3 py-2">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Raw extracted text (pdfjs-dist)
                      </div>
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => copyText(f.rawText ?? "")}>
                        Copy raw text
                      </Button>
                    </div>
                    <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-background p-2 font-mono text-[10px] leading-snug">
{f.rawText || "(no text extracted)"}
                    </pre>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {files.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">No files uploaded yet.</div>
      )}
    </Card>
  );
}

// ---------- SAFETY NET ----------
export function SafetyNetTab() {
  const safetyNet = useAppStore((s) => s.safetyNet);
  return (
    <div className="space-y-3">
      <Banner tone="info" icon={<Info className="h-4 w-4" />}>
        Safety Net statements use a different reference style and are <strong>not</strong> mixed into the standard PBS claim payment reconciliation totals.
      </Banner>
      <Card className="overflow-hidden border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>Print date</th><th>PBS ID</th><th>Claim ref</th><th>Card issued</th><th>Card holder</th><th>Result</th><th>Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {safetyNet.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-1.5">{r.printDate || "—"}</td>
                <td className="px-3 py-1.5"><Mono>{r.pbsPaymentId || "—"}</Mono></td>
                <td className="px-3 py-1.5"><Mono>{r.claimReference || "—"}</Mono></td>
                <td className="px-3 py-1.5">{r.cardIssued || "—"}</td>
                <td className="px-3 py-1.5">{r.cardHolder || "—"}</td>
                <td className="px-3 py-1.5">{r.result || "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.assessmentReason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {safetyNet.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No Safety Net statements uploaded.</div>
        )}
      </Card>
    </div>
  );
}

// ---------- WARNINGS ----------
export function WarningsTab() {
  const files = useAppStore((s) => s.files);
  const summaries = useAppStore((s) => s.summaries);
  const [showDiag, setShowDiag] = useState(false);
  const items = files.flatMap((f) =>
    f.warnings.map((w) => ({ file: f.name, ...w })),
  );
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
              <th>Severity</th><th>File</th><th>Type</th><th>Affected ID</th><th>Message</th><th>Snippet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((w, i) => (
              <tr key={i}>
                <td className="px-3 py-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    w.severity === "error" ? "bg-destructive text-destructive-foreground"
                    : w.severity === "warning" ? "bg-warning text-warning-foreground"
                    : "bg-muted text-muted-foreground"
                  }`}>{w.severity}</span>
                </td>
                <td className="px-3 py-1.5">{w.file}</td>
                <td className="px-3 py-1.5"><Mono>{w.type}</Mono></td>
                <td className="px-3 py-1.5"><Mono>{w.pbsPaymentId || "—"}</Mono></td>
                <td className="px-3 py-1.5">{w.message}</td>
                <td className="px-3 py-1.5 max-w-[280px] truncate font-mono text-[10px] text-muted-foreground">{w.textSnippet || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No parse warnings. Everything looks clean. ✓</div>
        )}
      </Card>

      <Card className="overflow-hidden border-border/60">
        <button
          type="button"
          onClick={() => setShowDiag((v) => !v)}
          className="flex w-full items-center justify-between border-b border-border bg-muted/30 px-3 py-2 text-left text-sm font-semibold hover:bg-muted/50"
        >
          <span>Summary Report Parser Diagnostics (debug)</span>
          <span className="text-xs text-muted-foreground">
            {showDiag ? "▼ Hide" : "▶ Show"} · {summaries.length} record(s)
          </span>
        </button>
        {showDiag && (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full font-mono text-[10px]">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr className="text-left uppercase tracking-wide text-muted-foreground [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium">
                  <th>PBS ID</th>
                  <th className="min-w-[260px]">Raw block (first 300)</th>
                  <th>Amt.Paid found</th>
                  <th className="text-right">Amt.Paid value</th>
                  <th className="min-w-[220px]">Amounts array (raw)</th>
                  <th className="text-right">amounts[5]</th>
                  <th className="text-right">Last value</th>
                  <th className="text-right">Subtotal assigned</th>
                  <th className="text-right">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border align-top">
                {summaries.map((s) => {
                  const d = s._debug;
                  return (
                    <tr key={s.id}>
                      <td className="px-2 py-1.5">{s.pbsPaymentId}</td>
                      <td className="px-2 py-1.5 whitespace-pre-wrap break-words text-muted-foreground">
                        {d?.rawBlockPreview ?? (s.rawTextBlock ?? "").slice(0, 300)}
                      </td>
                      <td className="px-2 py-1.5">{d ? (d.amtPaidFound ? "yes" : "no") : "—"}</td>
                      <td className="px-2 py-1.5 text-right">{d ? d.amtPaidValue : "—"}</td>
                      <td className="px-2 py-1.5 whitespace-pre-wrap break-words">
                        {d ? JSON.stringify(d.amountsArrayRaw) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right">{d ? d.amountsPosition5 : "—"}</td>
                      <td className="px-2 py-1.5 text-right">{d ? d.amountsLastValue : "—"}</td>
                      <td className="px-2 py-1.5 text-right">
                        {s.subtotal ?? "—"}
                        {d?.subtotalFallbackUsed ? " (fallback)" : ""}
                      </td>
                      <td className="px-2 py-1.5 text-right">{Math.round(s.parseConfidence * 100)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {summaries.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No summary records parsed.</div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
