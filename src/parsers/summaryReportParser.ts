import type { ParseWarning, SummaryEntry } from "@/types";
import { uid } from "@/lib/ids";
import { parseInt0, parseMoney } from "@/lib/parseMoney";

const PBS_ID_RE = /\b(1\d{11})\b/;
const BANK_REF_LABEL_RE = /Bank\s*Ref(?:erence)?\.?\s*(?:Number|No\.?|Group)?/i;
const BANK_REF_VALUE_RE = /\b(\d{10,15})\b/;
const CLAIM_PERIOD_RE = /\b(?:claim\s*period|period)[:\s#-]*?(\d{3,4})\b/i;
const SUBTOTAL_GROUP_RE = /^\s*Sub\s*Total\b/i;
const AMT_PAID_LABEL_RE = /Amt\.?\s*Paid\b/i;
const MONEY_TOKEN_RE = /[\d,]+\.\d{2}/g;
// Grand-total / footer rows that must NEVER be assigned to a PBS Payment ID record
const GRAND_TOTAL_RE = /(Total\s*Rx\s*Trans|Total\s*Amt\.?\s*Paid|Grand\s*Total)/i;

export interface SummaryParseResult {
  entries: SummaryEntry[];
  warnings: ParseWarning[];
  reportDate?: string;
  bankReferences: string[];
  reportGrandTotal?: number;
}

interface IdAnchor {
  lineIdx: number;
  pbsPaymentId: string;
  rxOnSameLine?: number;
}

function extractMoneyValues(text: string): number[] {
  return (text.match(MONEY_TOKEN_RE) ?? [])
    .map((token) => parseMoney(token))
    .filter((value): value is number => value !== undefined);
}

function extractBankReference(lines: string[], lineIdx: number): string | undefined {
  const sameLine = lines[lineIdx]?.match(BANK_REF_VALUE_RE)?.[1];
  if (sameLine) return sameLine;

  for (let offset = 1; offset <= 2; offset++) {
    const nextLine = lines[lineIdx + offset];
    const nextValue = nextLine?.match(BANK_REF_VALUE_RE)?.[1];
    if (nextValue) return nextValue;
  }

  return undefined;
}

function extractClaimPeriod(line: string): string | undefined {
  return line.match(CLAIM_PERIOD_RE)?.[1];
}

export function parseSummaryReport(
  text: string,
  sourceFileId: string,
  sourceFileName: string,
): SummaryParseResult {
  const warnings: ParseWarning[] = [];
  const entries: SummaryEntry[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const bankReferences = new Set<string>();

  let reportDate: string | undefined;
  const dateMatch =
    text.match(/Report\s*Date[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i) ||
    text.match(/\b([0-9]{1,2}\s+[A-Za-z]{3,}\s+20\d{2})\b/);
  if (dateMatch) reportDate = dateMatch[1];

  const documentClaimPeriod = lines.map(extractClaimPeriod).find(Boolean);

  const bankRefAtLine: (string | undefined)[] = new Array(lines.length).fill(undefined);
  let currentBank: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    if (BANK_REF_LABEL_RE.test(lines[i])) {
      const bankReference = extractBankReference(lines, i);
      if (bankReference) {
        currentBank = bankReference;
        bankReferences.add(bankReference);
      }
    }
    bankRefAtLine[i] = currentBank;
  }

  const claimPeriodAtLine: (string | undefined)[] = new Array(lines.length).fill(documentClaimPeriod);
  let currentClaimPeriod = documentClaimPeriod;
  for (let i = 0; i < lines.length; i++) {
    const claimPeriod = extractClaimPeriod(lines[i]);
    if (claimPeriod) currentClaimPeriod = claimPeriod;
    claimPeriodAtLine[i] = currentClaimPeriod;
  }

  const anchors: IdAnchor[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(PBS_ID_RE);
    if (!match || !match[1].startsWith("100")) continue;
    // Never treat a grand-total / footer row as a PBS Payment ID record
    if (GRAND_TOTAL_RE.test(lines[i])) continue;

    anchors.push({
      lineIdx: i,
      pbsPaymentId: match[1],
      rxOnSameLine: parseInt0(lines[i].match(/Rx\s*Trans[^\d-]*(\d+)/i)?.[1]),
    });
  }

  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index];
    const startLine = anchor.lineIdx;
    let endLine = index + 1 < anchors.length ? anchors[index + 1].lineIdx : lines.length;

    for (let lineIdx = startLine + 1; lineIdx < endLine; lineIdx++) {
      if (BANK_REF_LABEL_RE.test(lines[lineIdx]) || SUBTOTAL_GROUP_RE.test(lines[lineIdx])) {
        endLine = lineIdx;
        break;
      }
    }

    const blockLines = lines.slice(startLine, endLine).filter(Boolean);
    // Join with a space so that values on continuation lines (e.g. a subtotal
    // that wraps onto the next line) are part of the same token stream.
    const blockText = blockLines.join(" ");
    const blockTextDisplay = blockLines.join("\n");
    const localWarnings: ParseWarning[] = [];
    const ctxBank = bankRefAtLine[startLine];
    const claimPeriod = claimPeriodAtLine[startLine] ?? documentClaimPeriod;

    let amountPaid: number | undefined;
    let generalBenefits: number | undefined;
    let concessionalBenefits: number | undefined;
    let entitlementBenefits: number | undefined;
    let repatriationBenefits: number | undefined;
    const doctorsBagBenefits: number | undefined = undefined;
    let dbfAmount: number | undefined;
    let subtotal: number | undefined;
    let incentives: number | undefined;
    let total: number | undefined;
    let confidence = 0.3;

    // Capture everything after the Amt. Paid label. The first decimal token
    // there IS the Amt. Paid value; everything after that is the positional
    // benefit/total stream.
    const afterAmtPaid = blockText.match(/Amt\.?\s*Paid\b([\s\S]*)/i)?.[1] ?? "";
    const amountTokens = extractMoneyValues(afterAmtPaid);

    if (amountTokens.length > 0) {
      amountPaid = amountTokens[0];
      // CRITICAL: remove Amt. Paid from the array before positional assignment.
      // Otherwise every field shifts right by one and subtotal lands at idx 6.
      const amounts = amountTokens.slice(1);

      generalBenefits = amounts[0];
      concessionalBenefits = amounts[1];
      entitlementBenefits = amounts[2];
      repatriationBenefits = amounts[3];
      dbfAmount = amounts[4];
      subtotal = amounts[5];
      incentives = amounts[6];
      total = amounts[7];

      // Validation: subtotal must be >= largest individual benefit.
      // If positional pick is wrong (or array short), fall back to last value.
      const maxBenefit = Math.max(
        generalBenefits ?? 0,
        concessionalBenefits ?? 0,
        entitlementBenefits ?? 0,
        repatriationBenefits ?? 0,
        dbfAmount ?? 0,
      );
      const lastValue = amounts.length > 0 ? amounts[amounts.length - 1] : undefined;

      if (subtotal === undefined && lastValue !== undefined) {
        subtotal = lastValue;
        confidence = 0.6;
      } else if (subtotal !== undefined && subtotal < maxBenefit && lastValue !== undefined) {
        localWarnings.push({
          type: "subtotal-validation",
          severity: "warning",
          message: `Subtotal at position 5 (${subtotal}) less than max benefit (${maxBenefit}) for ${anchor.pbsPaymentId}; using last value`,
          pbsPaymentId: anchor.pbsPaymentId,
        });
        subtotal = lastValue;
        confidence = 0.6;
      } else if (subtotal !== undefined && subtotal > 0) {
        confidence = 0.9;
      }

      if (total === undefined) {
        total = lastValue ?? subtotal;
      }

      if (amounts.length < 3) {
        confidence = 0.3;
      }
    }

    const postAmountCount = Math.max(0, amountTokens.length - 1);

    if (!AMT_PAID_LABEL_RE.test(blockText)) {
      localWarnings.push({
        type: "missing-amt-paid",
        severity: "warning",
        message: `Could not locate Amt. Paid for ${anchor.pbsPaymentId}`,
        pbsPaymentId: anchor.pbsPaymentId,
        textSnippet: blockTextDisplay.slice(0, 240),
      });
    }

    if (postAmountCount < 3) {
      localWarnings.push({
        type: "incomplete-row",
        severity: "warning",
        message: `Only ${postAmountCount} dollar values detected after Amt. Paid for ${anchor.pbsPaymentId}`,
        pbsPaymentId: anchor.pbsPaymentId,
        textSnippet: blockTextDisplay.slice(0, 240),
      });
    }

    if (!ctxBank) {
      localWarnings.push({
        type: "missing-bank-ref",
        severity: "info",
        message: `No bank reference context for ${anchor.pbsPaymentId}`,
        pbsPaymentId: anchor.pbsPaymentId,
      });
    }

    if (!claimPeriod) {
      localWarnings.push({
        type: "missing-claim-period",
        severity: "info",
        message: `No claim period context for ${anchor.pbsPaymentId}`,
        pbsPaymentId: anchor.pbsPaymentId,
      });
    }

    if (subtotal === undefined) {
      localWarnings.push({
        type: "missing-subtotal",
        severity: "warning",
        message: `Could not determine Sub Total for ${anchor.pbsPaymentId}`,
        pbsPaymentId: anchor.pbsPaymentId,
        textSnippet: blockText.slice(0, 240),
      });
    }

    entries.push({
      id: uid("se_"),
      sourceFileId,
      sourceFileName,
      reportDate,
      claimPeriod,
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

  return {
    entries,
    warnings,
    reportDate,
    bankReferences: [...bankReferences],
  };
}
