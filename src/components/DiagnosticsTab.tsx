import { useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import { Card } from "@/components/ui/card";
import { Mono } from "@/components/Mono";
import { StatusBadge, STATUS_LABELS } from "@/components/StatusBadge";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  ShieldCheck,
  HelpCircle,
  Boxes,
  Cpu,
  Database,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentType, ReconStatus } from "@/types";

const DOC_LABEL: Record<DocumentType, string> = {
  summary: "Summary Reconciliation Report",
  advice: "PBS Payment Advice",
  safetyNet: "Safety Net Statement",
  unknown: "Unknown / unrecognised",
};

const DOC_ICON: Record<DocumentType, typeof FileText> = {
  summary: FileText,
  advice: FileText,
  safetyNet: ShieldCheck,
  unknown: HelpCircle,
};

interface DocStatus {
  type: DocumentType;
  required: boolean;
  enables: string;
  nextStep: string;
}

const DOC_REQUIREMENTS: DocStatus[] = [
  {
    type: "summary",
    required: true,
    enables: "Provides the source-of-truth list of PBS Payment IDs and subtotals.",
    nextStep: "Upload a Summary Reconciliation Report PDF from Z Dispense.",
  },
  {
    type: "advice",
    required: true,
    enables: "Provides Medicare-side totals for matching against summary subtotals.",
    nextStep: "Upload one or more PBS Payment Advice PDFs from Services Australia.",
  },
  {
    type: "safetyNet",
    required: false,
    enables: "Optional: lets the Safety Net tab show card-issuance assessments.",
    nextStep: "Optional. Upload a PBS Safety Net Statement PDF if you have one.",
  },
];

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Info;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5 text-xs last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function DiagnosticsTab() {
  const files = useAppStore((s) => s.files);
  const summaries = useAppStore((s) => s.summaries);
  const advices = useAppStore((s) => s.advices);
  const safetyNet = useAppStore((s) => s.safetyNet);
  const results = useAppStore((s) => s.results);

  // Document type presence
  const presentTypes = useMemo(() => {
    const set = new Set<DocumentType>();
    files.forEach((f) => set.add(f.detectedType));
    return set;
  }, [files]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = {} as Record<ReconStatus, number>;
    (Object.keys(STATUS_LABELS) as ReconStatus[]).forEach((k) => (counts[k] = 0));
    results.forEach((r) => counts[r.status]++);
    return counts;
  }, [results]);

  // Reconciliation input stats
  const totalWarnings = useMemo(
    () => files.reduce((sum, f) => sum + f.warnings.length, 0),
    [files],
  );
  const avgConfidence = useMemo(() => {
    const withConf = files.filter((f) => f.detectedType !== "unknown");
    if (!withConf.length) return null;
    return withConf.reduce((s, f) => s + f.parseConfidence, 0) / withConf.length;
  }, [files]);

  // Loaded module list (parsers + reconcile engine)
  const modules: Array<{ name: string; path: string; purpose: string }> = [
    {
      name: "extractTextFromAny",
      path: "src/lib/pdfText.ts",
      purpose: "Extracts text from PDF and TXT uploads",
    },
    {
      name: "detectDocumentType",
      path: "src/parsers/detectType.ts",
      purpose: "Classifies uploads as Summary / Advice / Safety Net",
    },
    {
      name: "parseSummaryReport",
      path: "src/parsers/summaryReportParser.ts",
      purpose: "Parses Z Dispense Summary Reconciliation Reports",
    },
    {
      name: "parsePaymentAdvice",
      path: "src/parsers/paymentAdviceParser.ts",
      purpose: "Parses Medicare PBS Payment Advice PDFs",
    },
    {
      name: "parseSafetyNet",
      path: "src/parsers/safetyNetParser.ts",
      purpose: "Parses PBS Safety Net Statements",
    },
    {
      name: "reconcile",
      path: "src/lib/reconcile.ts",
      purpose: "Matches summary records to advice totals and assigns statuses",
    },
  ];

  // Build info
  const buildInfo = {
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    nodeEnv: typeof process !== "undefined" ? process.env?.NODE_ENV : "n/a",
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "n/a",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Document coverage */}
      <Section
        icon={Database}
        title="Document coverage"
        subtitle="Which document types are loaded, and what's missing."
      >
        <ul className="space-y-2">
          {DOC_REQUIREMENTS.map((req) => {
            const present = presentTypes.has(req.type);
            const count = files.filter((f) => f.detectedType === req.type).length;
            const Icon = DOC_ICON[req.type];
            return (
              <li
                key={req.type}
                className={cn(
                  "rounded-md border p-2.5",
                  present
                    ? "border-success/30 bg-success/5"
                    : req.required
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-muted/30",
                )}
              >
                <div className="flex items-start gap-2">
                  {present ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : req.required ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {DOC_LABEL[req.type]}
                      {present && (
                        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                          {count} file{count === 1 ? "" : "s"}
                        </span>
                      )}
                      {!present && !req.required && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          optional
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{req.enables}</p>
                    {!present && (
                      <p className="mt-1 text-[11px] font-medium text-foreground">
                        Next step: {req.nextStep}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Reconciliation run inputs */}
      <Section
        icon={Cpu}
        title="Reconciliation run inputs"
        subtitle="What the matching engine has to work with right now."
      >
        <div className="space-y-0.5">
          <Row label="Files uploaded" value={files.length} />
          <Row label="Summary records" value={summaries.length} />
          <Row label="Payment advice records" value={advices.length} />
          <Row label="Safety Net records" value={safetyNet.length} />
          <Row label="Reconciliation results" value={results.length} />
          <Row
            label="Total parse warnings"
            value={
              totalWarnings === 0 ? (
                "0"
              ) : (
                <span className="inline-flex items-center gap-1 text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {totalWarnings}
                </span>
              )
            }
          />
          <Row
            label="Average parse confidence"
            value={avgConfidence === null ? "—" : `${Math.round(avgConfidence * 100)}%`}
          />
        </div>

        {results.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Status breakdown
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(statusCounts) as ReconStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-1 text-[11px]">
                  <StatusBadge status={s} />
                  <Mono className="font-semibold">{statusCounts[s]}</Mono>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Loaded modules */}
      <Section
        icon={Boxes}
        title="Loaded modules"
        subtitle="Parsers and engines bundled into this build."
      >
        <ul className="space-y-1.5">
          {modules.map((m) => (
            <li
              key={m.name}
              className="rounded-md border border-border/60 bg-muted/30 p-2 text-xs"
            >
              <div className="flex items-baseline justify-between gap-2">
                <Mono className="font-semibold">{m.name}</Mono>
                <Mono className="text-[10px] text-muted-foreground">{m.path}</Mono>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{m.purpose}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Build / environment */}
      <Section
        icon={Info}
        title="Build & environment"
        subtitle="Runtime details for bug reports."
      >
        <div className="space-y-0.5">
          <Row label="Build mode" value={<Mono>{buildInfo.mode}</Mono>} />
          <Row label="Dev server" value={buildInfo.dev ? "yes" : "no"} />
          <Row label="NODE_ENV" value={<Mono>{String(buildInfo.nodeEnv)}</Mono>} />
          <Row
            label="User agent"
            value={<Mono className="text-[10px]">{buildInfo.userAgent}</Mono>}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Per-file parse stats
            </div>
            <div className="space-y-1">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded border border-border/60 bg-muted/20 px-2 py-1 text-[11px]"
                >
                  <span className="truncate font-medium" title={f.name}>
                    {f.name}
                  </span>
                  <span className="ml-auto shrink-0 text-muted-foreground">
                    {DOC_LABEL[f.detectedType]}
                  </span>
                  <span className="shrink-0 font-mono">{f.recordCount} rec</span>
                  <span
                    className={cn(
                      "shrink-0 font-mono",
                      f.parseConfidence >= 0.8
                        ? "text-success"
                        : f.parseConfidence >= 0.6
                          ? "text-warning"
                          : "text-destructive",
                    )}
                  >
                    {Math.round(f.parseConfidence * 100)}%
                  </span>
                  {f.warnings.length > 0 && (
                    <span className="inline-flex shrink-0 items-center text-warning">
                      <AlertTriangle className="mr-0.5 h-3 w-3" />
                      {f.warnings.length}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
