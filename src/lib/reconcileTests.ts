import { reconcile } from "@/lib/reconcile";
import { buildDemoData } from "@/lib/demoData";
import type { ReconResult, ReconStatus } from "@/types";

export interface ReconTestExpectation {
  name: string;
  description: string;
  expected: {
    statusCounts: Partial<Record<ReconStatus, number>>;
    /**
     * Per-PBS-ID expectations. For each ID, a subset of fields can be
     * asserted: the resulting status, required issueFlags, and an optional
     * expected difference (rounded to 2 dp).
     */
    perRecord: Array<{
      pbsPaymentId: string;
      status?: ReconStatus;
      issueFlagsInclude?: string[];
      difference?: number;
      noteIncludes?: string;
    }>;
  };
}

export interface ReconTestCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface ReconTestRun {
  name: string;
  description: string;
  passed: boolean;
  results: ReconResult[];
  actualStatusCounts: Record<ReconStatus, number>;
  checks: ReconTestCheck[];
  durationMs: number;
}

/**
 * Sample PDF expectation: replays the seeded demo dataset (which mirrors
 * the structure of real Z-Dispense + Medicare PDFs) and verifies that
 * reconcile() produces the documented outcome.
 *
 * The demo dataset deliberately includes:
 *   - 11 perfectly balanced records
 *   - 1 mismatch (100355010008, +$15.12 advice over summary)
 *   - 2 pending (100355010013, 100355010014 — no advice received)
 *   - 1 prior-period adjustment (100355099001 — advice only, negative)
 */
const DEMO_EXPECTATION: ReconTestExpectation = {
  name: "Demo dataset (Z Dispense + 4 Medicare advices)",
  description:
    "Replays the built-in May 2026 sample: 14 summary records across 4 deposits + 4 advice files including one prior-period adjustment.",
  expected: {
    statusCounts: {
      balanced: 11,
      mismatch: 1,
      pending: 2,
      adjustment: 1,
      minor: 0,
      parseIssue: 0,
      adviceOnly: 0,
    },
    perRecord: [
      { pbsPaymentId: "100355010001", status: "balanced", difference: 0 },
      { pbsPaymentId: "100355010002", status: "balanced", difference: 0 },
      { pbsPaymentId: "100355010003", status: "balanced", difference: 0 },
      { pbsPaymentId: "100355010004", status: "balanced", difference: 0 },
      { pbsPaymentId: "100355010005", status: "balanced", difference: 0 },
      { pbsPaymentId: "100355010006", status: "balanced", difference: 0 },
      { pbsPaymentId: "100355010007", status: "balanced", difference: 0 },
      { pbsPaymentId: "100355010008", status: "mismatch", difference: 15.12 },
      { pbsPaymentId: "100355010009", status: "balanced", difference: 0 },
      { pbsPaymentId: "100355010010", status: "balanced", difference: 0 },
      { pbsPaymentId: "100355010011", status: "balanced", difference: 0 },
      { pbsPaymentId: "100355010012", status: "balanced", difference: 0 },
      { pbsPaymentId: "100355010013", status: "pending" },
      { pbsPaymentId: "100355010014", status: "pending" },
      { pbsPaymentId: "100355099001", status: "adjustment" },
    ],
  },
};

const ALL_STATUSES: ReconStatus[] = [
  "balanced",
  "minor",
  "mismatch",
  "pending",
  "adviceOnly",
  "adjustment",
  "parseIssue",
];

function countByStatus(results: ReconResult[]): Record<ReconStatus, number> {
  const counts = {} as Record<ReconStatus, number>;
  for (const s of ALL_STATUSES) counts[s] = 0;
  for (const r of results) counts[r.status]++;
  return counts;
}

function runExpectation(exp: ReconTestExpectation): ReconTestRun {
  const t0 = performance.now();
  const { summaries, advices } = buildDemoData();
  const results = reconcile(summaries, advices);
  const actual = countByStatus(results);
  const checks: ReconTestCheck[] = [];

  // Status count checks
  for (const [status, expectedCount] of Object.entries(exp.expected.statusCounts) as Array<
    [ReconStatus, number]
  >) {
    const got = actual[status] ?? 0;
    checks.push({
      label: `Count of "${status}" === ${expectedCount}`,
      passed: got === expectedCount,
      detail: got === expectedCount ? undefined : `got ${got}`,
    });
  }

  // Per-record checks
  const byId = new Map(results.map((r) => [r.pbsPaymentId, r]));
  for (const rec of exp.expected.perRecord) {
    const r = byId.get(rec.pbsPaymentId);
    if (!r) {
      checks.push({
        label: `Record ${rec.pbsPaymentId} present`,
        passed: false,
        detail: "missing from results",
      });
      continue;
    }
    if (rec.status !== undefined) {
      checks.push({
        label: `${rec.pbsPaymentId} status === "${rec.status}"`,
        passed: r.status === rec.status,
        detail: r.status === rec.status ? undefined : `got "${r.status}"`,
      });
    }
    if (rec.difference !== undefined) {
      const diff = r.difference ?? 0;
      const ok = Math.abs(diff - rec.difference) < 0.005;
      checks.push({
        label: `${rec.pbsPaymentId} difference ≈ ${rec.difference.toFixed(2)}`,
        passed: ok,
        detail: ok ? undefined : `got ${diff.toFixed(2)}`,
      });
    }
    if (rec.issueFlagsInclude) {
      for (const flag of rec.issueFlagsInclude) {
        const has = r.issueFlags.includes(flag);
        checks.push({
          label: `${rec.pbsPaymentId} has issueFlag "${flag}"`,
          passed: has,
          detail: has ? undefined : `flags: [${r.issueFlags.join(", ") || "none"}]`,
        });
      }
    }
    if (rec.noteIncludes) {
      const has = r.notes.some((n) => n.includes(rec.noteIncludes!));
      checks.push({
        label: `${rec.pbsPaymentId} note contains "${rec.noteIncludes}"`,
        passed: has,
        detail: has ? undefined : `notes: ${r.notes.join(" | ") || "none"}`,
      });
    }
  }

  return {
    name: exp.name,
    description: exp.description,
    results,
    actualStatusCounts: actual,
    checks,
    passed: checks.every((c) => c.passed),
    durationMs: performance.now() - t0,
  };
}

export function runReconciliationTests(): ReconTestRun[] {
  return [runExpectation(DEMO_EXPECTATION)];
}
