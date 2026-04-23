import type { SummaryEntry, ParseWarning } from "@/types";
import { parseMoney, parseInt0 } from "@/lib/parseMoney";
import { uid } from "@/lib/ids";

const PBS_ID_RE = /\b(1\d{11})\b/;
const BANK_REF_LINE_RE = /Bank\s*Ref(?:erence)?\.?\s*(?:Number|No\.?|Group)?[^\d]*([0-9]{10,15})/i;
const CLAIM_PERIOD_RE = /\b(?:claim\s*period|period)[:\s#]*?(\d{3,4})\b/i;
const SUBTOTAL_LINE_RE = /Sub\s*Total/i;
const AMT_PAID_RE = /Amt\.?\s*Paid/i;
const DECIMAL_NUM_RE = /-?\$?\s*[0-9][0-9,]*\.[0-9]{2}/g;

export interface SummaryParseResult {
  entries: SummaryEntry[];
  warnings: ParseWarning[];
  reportDate?: string;
  bankReferences: string[];
}

interface IdAnchor {
  lineIdx: number;
  pbsPaymentId: string;
  rxOnSameLine?: number;
}

/**
 * Defensive multi-line block parser for Z Dispense "Summary Reconciliation Report".
 *
 * Strategy:
 *   1. Walk the lines, tracking the most recent "Bank Ref. Number" context.
 *   2. For each 12-digit PBS Payment ID line, collect every line up to (but
 *      not including) the next PBS ID, the next "Bank Ref. Number" line, or
 *      a new "Sub Total" group line.
 *   3. Within that block, locate Amt. Paid, the totals line, and assign
 *      decimal values positionally (Gen, Con, Ent, Repat, DBF).
 */
export function parseSummaryReport(
  text: string,
  sourceFileId: string,
  sourceFileName: string,
): SummaryParseResult {
  const warnings: ParseWarning[] = [];
  const entries: SummaryEntry[] = [];
  const lines = text.split(/\r?\n/);
  const bankReferences = new Set<string>();

  // Report date
  let reportDate: string | undefined;
  const dateMatch =
    text.match(/Report\s*Date[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i) ||
    text.match(/\b([0-9]{1,2}\s+[A-Za-z]{3,}\s+20\d{2})\b/);
  if (dateMatch) reportDate = dateMatch[1];

  // Pre-pass: build line-index → bank ref context (carry-forward)
  const bankRefAtLine: (string | undefined)[] = new Array(lines.length).fill(undefined);
  let currentBank: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(BANK_REF_LINE_RE);
    if (m) {
      currentBank = m[1];
      bankReferences.add(currentBank);
    }
    bankRefAtLine[i] = currentBank;
  }

  // Pre-pass: claim period context
  const claimPeriodAtLine: (string | undefined)[] = new Array(lines.length).fill(undefined);
  let currentCp: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(CLAIM_PERIOD_RE);
    if (m) currentCp = m[1];
    claimPeriodAtLine[i] = currentCp;
  }

  // Find PBS ID anchors
  const anchors: IdAnchor[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(PBS_ID_RE);
    if (!m) continue;
    if (!m[1].startsWith("100")) continue;
    // Try to capture an "Rx Trans <n>" on the same line
    const rxMatch = lines[i].match(/Rx\s*Trans[^\d]*(\d+)/i);
    anchors.push({
      lineIdx: i,
      pbsPaymentId: m[1],
      rxOnSameLine: rxMatch ? parseInt0(rxMatch[1]) : undefined,
    });
  }

  for (let a = 0; a < anchors.length; a++) {
    const anchor = anchors[a];
    const startLine = anchor.lineIdx;

    // Determine block end: next anchor, or next bank-ref line, or end of file
    let endLine = lines.length;
    if (a + 1 < anchors.length) endLine = anchors[a + 1].lineIdx;
    for (let j = startLine + 1; j < endLine; j++) {
      if (BANK_REF_LINE_RE.test(lines[j])) {
        endLine = j;
        break;
      }
    }

    const blockLines = lines.slice(startLine, endLine);
    const blockText = blockLines.join("\n");

    // Amt. Paid: look for label, then a number on same line or the next 1-2 lines
    let amountPaid: number | undefined;
    for (let k = 0; k < blockLines.length; k++) {
      if (!AMT_PAID_RE.test(blockLines[k])) continue;
      const candidates = blockLines
        .slice(k, Math.min(blockLines.length, k + 3))
        .join(" ");
      const m = candidates.match(DECIMAL_NUM_RE);
      if (m && m.length > 0) {
        amountPaid = parseMoney(m[0]);
        break;
      }
    }

    // Find the "totals line" — line with the most decimal numbers (typically
    // contains Gen, Con, Ent, Repat, [DBag], [DBF], SubTotal, [Inc], [Total]).
    // Skip the header anchor line itself if it has no decimals.
    let totalsLineIdx = -1;
    let maxDecCount = 0;
    for (let k = 0; k < blockLines.length; k++) {
      if (AMT_PAID_RE.test(blockLines[k])) continue;
      const decs = blockLines[k].match(DECIMAL_NUM_RE);
      const count = decs ? decs.length : 0;
      if (count > maxDecCount) {
        maxDecCount = count;
        totalsLineIdx = k;
      }
    }

    let generalBenefits: number | undefined;
    let concessionalBenefits: number | undefined;
    let entitlementBenefits: number | undefined;
    let repatriationBenefits: number | undefined;
    let doctorsBagBenefits: number | undefined;
    let dbfAmount: number | undefined;
    let subtotal: number | undefined;
    let incentives: number | undefined;
    let total: number | undefined;

    let decsOnTotals: number[] = [];
    if (totalsLineIdx >= 0) {
      const rawDecs = blockLines[totalsLineIdx].match(DECIMAL_NUM_RE) ?? [];
      decsOnTotals = rawDecs
        .map((t) => parseMoney(t))
        .filter((v): v is number => v !== undefined);

      // Positional mapping. Z Dispense column order:
      //   Gen | Con | Ent | Repat | (DBag) | (DBF) | SubTotal | (Incentives) | (Total)
      generalBenefits = decsOnTotals[0];
      concessionalBenefits = decsOnTotals[1];
      entitlementBenefits = decsOnTotals[2];
      repatriationBenefits = decsOnTotals[3];

      // SubTotal: prefer a value equal to gen+con+ent+repat that is >= 100 and
      // appears later in the line. Otherwise fall back to the LAST value >= 100.
      const expected =
        (generalBenefits ?? 0) +
        (concessionalBenefits ?? 0) +
        (entitlementBenefits ?? 0) +
        (repatriationBenefits ?? 0);

      let subIdx = -1;
      for (let k = 4; k < decsOnTotals.length; k++) {
        if (Math.abs(decsOnTotals[k] - expected) < 0.05) {
          subIdx = k;
          break;
        }
      }
      if (subIdx === -1) {
        // Fall back: the last value >= 100 on the line
        for (let k = decsOnTotals.length - 1; k >= 4; k--) {
          if (decsOnTotals[k] >= 100) {
            subIdx = k;
            break;
          }
        }
      }
      if (subIdx >= 0) {
        subtotal = decsOnTotals[subIdx];
        // Anything between position 4 and subIdx is DBag / DBF (rare)
        if (subIdx >= 5) doctorsBagBenefits = decsOnTotals[4];
        if (subIdx >= 6) dbfAmount = decsOnTotals[5];
        incentives = decsOnTotals[subIdx + 1];
        total = decsOnTotals[subIdx + 2];
      } else {
        subtotal = expected > 0 ? +expected.toFixed(2) : undefined;
      }
    }

    const localWarnings: ParseWarning[] = [];
    let confidence = 1;
    if (decsOnTotals.length < 4) {
      confidence = 0.4;
      localWarnings.push({
        type: "incomplete-row",
        severity: "warning",
        message: `Only ${decsOnTotals.length} decimal values detected for ${anchor.pbsPaymentId}`,
        pbsPaymentId: anchor.pbsPaymentId,
        textSnippet: blockText.slice(0, 240),
      });
    }
    const ctxBank = bankRefAtLine[startLine];
    if (!ctxBank) {
      localWarnings.push({
        type: "missing-bank-ref",
        severity: "info",
        message: `No bank reference context for ${anchor.pbsPaymentId}`,
        pbsPaymentId: anchor.pbsPaymentId,
      });
      confidence = Math.min(confidence, 0.7);
    }
    if (subtotal === undefined) {
      confidence = Math.min(confidence, 0.5);
      localWarnings.push({
        type: "missing-subtotal",
        severity: "warning",
        message: `Could not determine Sub Total for ${anchor.pbsPaymentId}`,
        pbsPaymentId: anchor.pbsPaymentId,
      });
    }

    entries.push({
      id: uid("se_"),
      sourceFileId,
      sourceFileName,
      reportDate,
      claimPeriod: claimPeriodAtLine[startLine],
      bankReferenceNumber: ctxBank,
      pbsPaymentId: anchor.pbsPaymentId,
      rxTransactions: anchor.rxOnSameLine,
      amountPaid,
      generalBenefits,
      concessionalBenefits,
      entitlementBenefits,
      repatriationBenefits,
      doctorsBagBenefits,
      dbfAmount,
      subtotal,
      incentives,
      total,
      rawTextBlock: blockText,
      parseConfidence: confidence,
      parseWarnings: localWarnings,
    });
    warnings.push(...localWarnings);
  }

  if (entries.length === 0) {
    warnings.push({
      type: "no-records",
      severity: "error",
      message: "No PBS payment IDs detected in summary report",
    });
  }

  // Suppress SUBTOTAL_LINE_RE unused warning — kept for future grouping logic
  void SUBTOTAL_LINE_RE;

  return {
    entries,
    warnings,
    reportDate,
    bankReferences: [...bankReferences],
  };
}
