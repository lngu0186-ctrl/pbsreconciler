import type { SummaryEntry, ParseWarning } from "@/types";
import { parseMoney, parseInt0 } from "@/lib/parseMoney";
import { uid } from "@/lib/ids";

const PBS_ID_RE = /\b(\d{12})\b/;
const BANK_REF_RE = /\b(\d{11,15})\b/;
const CLAIM_PERIOD_RE = /\b(?:claim\s*period|period)[:\s#]*?(\d{3,4})\b/i;

export interface SummaryParseResult {
  entries: SummaryEntry[];
  warnings: ParseWarning[];
  reportDate?: string;
  bankReferences: string[];
}

/**
 * Defensive line-based parser for Z Dispense "Summary Reconciliation Report".
 * Strategy: scan lines for 12-digit PBS payment IDs, then collect numeric tokens
 * on the same/adjacent lines and map them positionally.
 */
export function parseSummaryReport(
  text: string,
  sourceFileId: string,
  sourceFileName: string,
): SummaryParseResult {
  const warnings: ParseWarning[] = [];
  const entries: SummaryEntry[] = [];
  const lines = text.split(/\r?\n/);

  let currentBankRef: string | undefined;
  let currentClaimPeriod: string | undefined;
  let reportDate: string | undefined;
  const bankReferences = new Set<string>();

  // Look for report date
  const dateMatch = text.match(/Report\s*Date[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i)
    || text.match(/\b([0-9]{1,2}\s+[A-Za-z]{3,}\s+20\d{2})\b/);
  if (dateMatch) reportDate = dateMatch[1];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track context: bank reference markers
    const bankCtx = line.match(/Bank\s*(?:Ref(?:erence)?|Group)[^\d]*([0-9]{10,15})/i);
    if (bankCtx) {
      currentBankRef = bankCtx[1];
      bankReferences.add(currentBankRef);
    }
    const cpCtx = line.match(CLAIM_PERIOD_RE);
    if (cpCtx) currentClaimPeriod = cpCtx[1];

    const idMatch = line.match(PBS_ID_RE);
    if (!idMatch) continue;
    // Heuristic: payment IDs start with "1003"
    if (!idMatch[1].startsWith("100")) continue;

    const pbsPaymentId = idMatch[1];
    // Build context block: this line + a few neighbours to capture wrapped values
    const ctxBlock = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 4)).join(" ");

    // Extract numeric tokens on the same line (after the ID), tolerant of $ and commas
    const afterId = line.slice((idMatch.index ?? 0) + idMatch[0].length);
    const numTokens = [...afterId.matchAll(/-?\$?\s*[0-9][0-9,]*\.[0-9]{2}|-?\$?\s*[0-9][0-9,]*/g)]
      .map((m) => m[0].trim());
    const ints = numTokens.filter((t) => !t.includes("."));
    const decs = numTokens.filter((t) => t.includes("."));

    // Heuristic mapping for Z Dispense column order:
    // Rx | AmtPaid | Gen | Con | Ent | Repat | (DBag) | (DBF) | SubTotal | (Incentives) | (Total)
    const rxTransactions = ints.length > 0 ? parseInt0(ints[0]) : undefined;
    const decNums = decs.map((t) => parseMoney(t)).filter((v): v is number => v !== undefined);

    let amountPaid: number | undefined,
      generalBenefits: number | undefined,
      concessionalBenefits: number | undefined,
      entitlementBenefits: number | undefined,
      repatriationBenefits: number | undefined,
      subtotal: number | undefined,
      incentives: number | undefined,
      total: number | undefined;

    if (decNums.length >= 5) {
      amountPaid = decNums[0];
      generalBenefits = decNums[1];
      concessionalBenefits = decNums[2];
      entitlementBenefits = decNums[3];
      repatriationBenefits = decNums[4];
      // Subtotal: try to find a value equal to gen+con+ent+repat
      const expected = (generalBenefits ?? 0) + (concessionalBenefits ?? 0)
        + (entitlementBenefits ?? 0) + (repatriationBenefits ?? 0);
      const subIdx = decNums.findIndex((v, idx) =>
        idx >= 5 && Math.abs(v - expected) < 0.05,
      );
      if (subIdx >= 0) {
        subtotal = decNums[subIdx];
        incentives = decNums[subIdx + 1];
        total = decNums[subIdx + 2];
      } else {
        subtotal = decNums[5] ?? expected;
      }
    }

    const localWarnings: ParseWarning[] = [];
    let confidence = 1;
    if (decNums.length < 5) {
      confidence = 0.4;
      localWarnings.push({
        type: "incomplete-row",
        severity: "warning",
        message: `Only ${decNums.length} decimal values detected for ${pbsPaymentId}`,
        pbsPaymentId,
        textSnippet: line,
      });
    }
    if (!currentBankRef) {
      localWarnings.push({
        type: "missing-bank-ref",
        severity: "info",
        message: `No bank reference context for ${pbsPaymentId}`,
        pbsPaymentId,
      });
      confidence = Math.min(confidence, 0.7);
    }

    entries.push({
      id: uid("se_"),
      sourceFileId,
      sourceFileName,
      reportDate,
      claimPeriod: currentClaimPeriod,
      bankReferenceNumber: currentBankRef,
      pbsPaymentId,
      rxTransactions,
      amountPaid,
      generalBenefits,
      concessionalBenefits,
      entitlementBenefits,
      repatriationBenefits,
      subtotal,
      incentives,
      total,
      rawTextBlock: ctxBlock,
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

  return {
    entries,
    warnings,
    reportDate,
    bankReferences: [...bankReferences],
  };
}

// Suppress unused
export { BANK_REF_RE };
