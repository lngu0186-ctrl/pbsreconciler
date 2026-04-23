import type { AdviceEntry, ReconResult, ReconStatus, SummaryEntry } from "@/types";

const BALANCED_THRESHOLD = 0.02;
const MINOR_THRESHOLD = 1.0;

export function adviceComparable(a: AdviceEntry): number | undefined {
  if (a.totalPBSPlusRPBS !== undefined) return a.totalPBSPlusRPBS;
  return a.totalPBS;
}

export function adviceAcssTotal(a: AdviceEntry): number {
  return (a.acssComponentOneAmount ?? 0) + (a.acssComponentTwoAmount ?? 0);
}

export function reconcile(summaries: SummaryEntry[], advices: AdviceEntry[]): ReconResult[] {
  const byIdSummary = new Map<string, SummaryEntry[]>();
  const byIdAdvice = new Map<string, AdviceEntry[]>();
  for (const s of summaries) {
    if (!byIdSummary.has(s.pbsPaymentId)) byIdSummary.set(s.pbsPaymentId, []);
    byIdSummary.get(s.pbsPaymentId)!.push(s);
  }
  for (const a of advices) {
    if (!byIdAdvice.has(a.pbsPaymentId)) byIdAdvice.set(a.pbsPaymentId, []);
    byIdAdvice.get(a.pbsPaymentId)!.push(a);
  }
  const allIds = new Set<string>([...byIdSummary.keys(), ...byIdAdvice.keys()]);
  const results: ReconResult[] = [];

  for (const id of allIds) {
    const sList = byIdSummary.get(id) ?? [];
    const aList = byIdAdvice.get(id) ?? [];

    // Summary side: sum duplicates (rare; flagged below)
    const sumSummary = sList.reduce((sum, s) => sum + (s.subtotal ?? 0), 0);

    // Advice side: separate adjustments from primary entries to avoid
    // double-counting when the same PBS Payment ID appears in multiple
    // advice files (e.g. an entry that is also a prior-period adjustment
    // in a later advice).
    const adjustments = aList.filter((a) => a.isAdjustment);
    const primaries = aList.filter((a) => !a.isAdjustment);

    // Pick a single primary entry: highest parseConfidence, tie-break by
    // most recent paymentDate. Fall back to the only adjustment if there
    // is no primary.
    const pickPrimary = (list: AdviceEntry[]): AdviceEntry | undefined => {
      if (list.length === 0) return undefined;
      const sorted = [...list].sort((a, b) => {
        if (b.parseConfidence !== a.parseConfidence) {
          return b.parseConfidence - a.parseConfidence;
        }
        const ad = a.paymentDate ?? "";
        const bd = b.paymentDate ?? "";
        return bd.localeCompare(ad);
      });
      return sorted[0];
    };
    const primary = pickPrimary(primaries) ?? pickPrimary(adjustments);

    const primaryComparable = primary ? (adviceComparable(primary) ?? 0) : 0;
    const primaryBanked = primary?.bankedTotal ?? 0;
    const primaryAcss = primary ? adviceAcssTotal(primary) : 0;
    const primaryPbs = primary?.totalPBS ?? 0;
    const primaryPbsRpbs = primary?.totalPBSPlusRPBS ?? 0;
    const adjustmentSum = adjustments
      .filter((a) => a !== primary)
      .reduce((sum, a) => sum + (adviceComparable(a) ?? 0), 0);

    const sumAdviceComparable = primaryComparable;
    const sumBanked = primaryBanked;
    const sumAcss = primaryAcss;
    const sumPbs = primaryPbs;
    const sumPbsRpbs = primaryPbsRpbs;

    const issueFlags: string[] = [];
    const notes: string[] = [];

    if (sList.length > 1) issueFlags.push("duplicate-summary");
    // Genuine duplicate: more than one non-adjustment advice entry — flag
    // for human review since totals may diverge across files.
    if (primaries.length > 1) issueFlags.push("multiple-advice");
    if (adjustmentSum !== 0) {
      notes.push(`Includes prior-period adjustment of ${adjustmentSum.toFixed(2)}`);
    }

    let status: ReconStatus;
    let difference: number | undefined;

    if (sList.length === 0) {
      // advice only
      const isAdj = aList.some((a) => a.isAdjustment) || sumAdviceComparable < 0;
      status = isAdj ? "adjustment" : "adviceOnly";
      if (isAdj) notes.push("Negative / prior-period adjustment");
      else notes.push("Appears in Payment Advice but not in Summary Reconciliation Report");
    } else if (aList.length === 0) {
      status = "pending";
      notes.push("Awaiting Medicare Payment Advice for this PBS payment ID");
    } else {
      // both present
      const lowConf =
        sList.some((s) => s.parseConfidence < 0.6) || aList.some((a) => a.parseConfidence < 0.6);
      difference = +(sumAdviceComparable - sumSummary).toFixed(2);
      const abs = Math.abs(difference);
      if (lowConf) {
        status = "parseIssue";
        issueFlags.push("low-confidence");
      } else if (abs < BALANCED_THRESHOLD) {
        status = "balanced";
      } else if (abs < MINOR_THRESHOLD) {
        status = "minor";
        notes.push("Likely General Under-Co split not broken out in summary");
      } else {
        status = "mismatch";
      }
    }

    // Claim period sanity — use the chosen primary advice entry
    const sCp = sList[0]?.claimPeriod;
    const aCp = primary?.claimPeriod ?? aList[0]?.claimPeriod;
    if (sCp && aCp && sCp !== aCp) {
      issueFlags.push("claim-period-mismatch");
      notes.push(`Claim period differs: summary=${sCp}, advice=${aCp}`);
    }

    // Bank ref sanity — use the chosen primary advice entry
    const sBank = sList[0]?.bankReferenceNumber;
    const aBank = primary?.bankReferenceNumber ?? aList[0]?.bankReferenceNumber;
    if (sBank && aBank && sBank !== aBank) {
      issueFlags.push("bank-ref-mismatch");
    }

    results.push({
      pbsPaymentId: id,
      claimPeriodFromSummary: sCp,
      claimPeriodFromAdvice: aCp,
      bankReferenceSummary: sBank,
      bankReferenceAdvice: aBank,
      summarySubtotal: sList.length ? sumSummary : undefined,
      adviceComparableTotal: aList.length ? sumAdviceComparable : undefined,
      adviceTotalPBS: aList.length ? sumPbs : undefined,
      adviceTotalPBSPlusRPBS: aList.length && sumPbsRpbs !== 0 ? sumPbsRpbs : undefined,
      acssTotal: aList.length ? sumAcss : undefined,
      bankedTotal: aList.length ? sumBanked : undefined,
      difference,
      status,
      issueFlags,
      summaryRecord: sList[0],
      adviceRecord: primary ?? aList[0],
      notes,
    });
  }

  // Sort: mismatches first, then minor, then pending, then balanced, then advice-only/adjustment
  const order: Record<ReconStatus, number> = {
    mismatch: 0,
    parseIssue: 1,
    minor: 2,
    pending: 3,
    adviceOnly: 4,
    adjustment: 5,
    balanced: 6,
  };
  results.sort(
    (a, b) => order[a.status] - order[b.status] || a.pbsPaymentId.localeCompare(b.pbsPaymentId),
  );
  return results;
}
