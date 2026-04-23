import type { AdviceEntry, ParseWarning } from "@/types";
import { parseMoney, parseInt0 } from "@/lib/parseMoney";
import { uid } from "@/lib/ids";

// PBS Payment IDs issued by Services Australia ALWAYS start with "1003"
// followed by 8 more digits. This pattern is strict to avoid mistaking
// bank reference numbers (which are also 12 digits) for PBS Payment IDs.
const PBS_ID_RE = /\b(1003\d{8})\b/g;
const SUPPLIER_RE = /\b(\d{4,5}[A-Z])\b/;
const DECIMAL_NUM_RE = /-?\$?\s*[0-9][0-9,]*\.[0-9]{2}/;

// Lines that contain bank/account identifiers — any 12-digit number on such
// a line must NOT be treated as a PBS Payment ID.
const NON_PBS_CONTEXT_RE =
  /bank\s*reference\s*number|bank\s*ref(?:erence)?\.?\s*(?:number|no\.?)?|\bBSB\b|branch\s*number|account\s*number/i;

export interface AdviceParseResult {
  entries: AdviceEntry[];
  warnings: ParseWarning[];
  supplierNumber?: string;
  paymentDate?: string;
  adviceDate?: string;
  bankReferences: string[];
}

/**
 * Search a block for the FIRST line matching one of the labels and return
 * the first decimal/money value found on that line (or the next line).
 * This is strictly scoped: it never reaches outside the supplied block.
 */
function findValueAfterLabel(blockLines: string[], labels: RegExp[]): number | undefined {
  for (let i = 0; i < blockLines.length; i++) {
    const line = blockLines[i];
    for (const re of labels) {
      if (!re.test(line)) continue;
      // Try same line first
      const sameLine = line.match(/(-?\$?\s*[0-9][0-9,]*\.[0-9]{2})/);
      if (sameLine) {
        const v = parseMoney(sameLine[1]);
        if (v !== undefined) return v;
      }
      // Fall back to next non-empty line
      for (let j = i + 1; j < Math.min(blockLines.length, i + 3); j++) {
        const m = blockLines[j].match(DECIMAL_NUM_RE);
        if (m) {
          const v = parseMoney(m[0]);
          if (v !== undefined) return v;
        }
      }
    }
  }
  return undefined;
}

function findCountAndAmount(
  blockLines: string[],
  labelRe: RegExp,
): { count?: number; amount?: number } {
  for (let i = 0; i < blockLines.length; i++) {
    if (!labelRe.test(blockLines[i])) continue;
    const window = blockLines.slice(i, Math.min(blockLines.length, i + 3)).join(" ");
    // Expect: <int> ... <decimal>
    const m = window.match(/(\d+)\D+(-?\$?\s*[0-9][0-9,]*\.[0-9]{2})/);
    if (m) {
      return {
        count: parseInt0(m[1]),
        amount: parseMoney(m[2]),
      };
    }
  }
  return {};
}

// Label patterns
const RE_TOTAL_PBS_RPBS_FEES = /Total\s*\(?\s*PBS\s*\+\s*RPBS\s*\+\s*Fees/i;
const RE_TOTAL_PBS_FEES = /Total\s*\(?\s*PBS\s*\+\s*Fees/i;
const RE_BANKED = /Banked(?:\s*Total)?/i;
const RE_TOTAL_PBS_RPBS = /Total\s*\(?\s*PBS\s*\+\s*RPBS\s*\)?(?!\s*\+)/i;
const RE_TOTAL_PBS = /Total\s*PBS(?!\s*\+)/i;
const RE_TOTAL_PBS_PAREN = /Total\s*\(\s*PBS\s*\)/i;
const RE_GENERAL = /General\s+benefits/i;
const RE_GENERAL_UNDERCO = /General\s+under[\s-]?co/i;
const RE_CONCESSIONAL = /Concessional\s+benefits/i;
const RE_ENTITLEMENT = /(?:Entitlement|Free)\s+benefits/i;
const RE_REPAT = /(?:Repatriation|RPBS)\s+benefits/i;
const RE_DOCTORS_BAG = /Doctor'?s?\s*Bag/i;
const RE_ACSS_ONE = /ACSS\s*Component\s*1|ACSS\s*Component\s*One/i;
const RE_ACSS_TWO = /ACSS\s*Component\s*2|ACSS\s*Component\s*Two/i;

function getMostFrequentClaimPeriod(entries: AdviceEntry[]): string | undefined {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.claimPeriod) counts.set(e.claimPeriod, (counts.get(e.claimPeriod) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [cp, count] of counts) {
    if (count > bestCount) {
      best = cp;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Parse a PBS Payment Advice (incl. RCTI variant).
 *
 * Critical correctness rule: each PBS Payment ID block is parsed in strict
 * isolation. Block start = the PBS ID's exact position; block end = next
 * PBS ID's position (or EOF). NO lookbehind — any lookbehind contaminates
 * the current block with the previous block's totals lines (which appear
 * AFTER the previous PBS ID in the gap between two IDs).
 */
export function parsePaymentAdvice(
  text: string,
  sourceFileId: string,
  sourceFileName: string,
): AdviceParseResult {
  const warnings: ParseWarning[] = [];
  const entries: AdviceEntry[] = [];
  const bankReferences = new Set<string>();

  // Document-level metadata (read once, used as defaults only)
  const supplierMatch =
    text.match(/Approved\s*Supplier[^\n]*?(\d{4,5}[A-Z])/i) || text.match(SUPPLIER_RE);
  const supplierNumber = supplierMatch?.[1];

  // Payment date — Medicare PDFs use a sentence: "We made a total payment on
  // 07 April 2026 into the following account:". Fall back to legacy label.
  const paymentDateMatch =
    text.match(/total\s+payment\s+on\s+(\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i) ||
    text.match(
      /Payment\s*Date[:\s]+(\d{1,2}\s+[A-Za-z]{3,}\s+20\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    );
  const docPaymentDate = paymentDateMatch?.[1];

  // Advice date — Medicare letters print a standalone date line at the top
  // (e.g. "8 April 2026"). Fall back to a labelled "Advice Date:".
  const adviceDateMatch =
    text.match(/Advice\s*Date[:\s]+(\d{1,2}\s+[A-Za-z]{3,}\s+20\d{2})/i) ||
    text.match(/^\s*(\d{1,2}\s+[A-Za-z]+\s+20\d{2})\s*$/m);
  const docAdviceDate = adviceDateMatch?.[1];

  // Document-level bank reference number (Medicare format appears once near
  // the top of the advice and applies to every PBS Payment ID in the file).
  const docBankRefMatch = text.match(/bank\s*reference\s*number[:\s]+(\d{9,15})/i);
  const docBankReferenceNumber = docBankRefMatch?.[1];
  if (docBankReferenceNumber) bankReferences.add(docBankReferenceNumber);

  // Document-level claim period fallback: scan the full text for the first
  // 4-digit code in the 2500-2699 range. Used only if per-block extraction
  // produces nothing.
  const docClaimPeriodMatch = text.match(/\b(2[5-6]\d{2})\b/);
  const docClaimPeriodFallback = docClaimPeriodMatch?.[1];

  // Find all candidate PBS ID positions in the raw text. The regex already
  // restricts to /1003\d{8}/ but we still reject any candidate that appears
  // on a line clearly identifying a bank/account number, OR that equals the
  // document-level bank reference number itself.
  const matches: { id: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  PBS_ID_RE.lastIndex = 0;
  while ((m = PBS_ID_RE.exec(text)) !== null) {
    const id = m[1];
    if (id === docBankReferenceNumber) continue;
    const lineStart = text.lastIndexOf("\n", m.index) + 1;
    const lineEndRaw = text.indexOf("\n", m.index);
    const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
    const line = text.slice(lineStart, lineEnd);
    if (NON_PBS_CONTEXT_RE.test(line)) continue;
    matches.push({ id, index: m.index });
  }

  // De-duplicate header references that repeat the same ID right next to itself
  const dedupedPositions: { id: string; index: number }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const prev = dedupedPositions[dedupedPositions.length - 1];
    if (prev && prev.id === cur.id && cur.index - prev.index < 200) continue;
    dedupedPositions.push(cur);
  }

  // Final guard: drop any candidate that collides with a known bank reference
  // captured from this document (e.g. the document-level Medicare bank ref).
  const uniquePositions = dedupedPositions.filter((pos) => !bankReferences.has(pos.id));

  for (let i = 0; i < uniquePositions.length; i++) {
    const pbsPaymentId = uniquePositions[i].id;

    // Strict scope, NO lookbehind: block = exactly [this ID position, next ID position).
    // Any lookbehind would pull in the previous record's Total PBS / Total (PBS+RPBS)
    // lines (which sit in the gap AFTER the previous PBS ID), causing
    // findValueAfterLabel to return the previous record's totals.
    const safeStart = uniquePositions[i].index;
    const end = i + 1 < uniquePositions.length ? uniquePositions[i + 1].index : text.length;

    const block = text.slice(safeStart, end);
    const blockLines = block.split(/\r?\n/);

    // ---- Strictly local fields (reset per block) ----
    let bankReferenceNumber: string | undefined;
    let claimPeriod: string | undefined;
    let generalBenefits: number | undefined;
    let generalUnderCoBenefits: number | undefined;
    let concessionalBenefits: number | undefined;
    let entitlementBenefits: number | undefined;
    let repatriationBenefits: number | undefined;
    let doctorsBagBenefits: number | undefined;
    let totalPBS: number | undefined;
    let totalPBSPlusRPBS: number | undefined;
    let bankedTotal: number | undefined;
    let acssOneCount: number | undefined;
    let acssOneAmount: number | undefined;
    let acssTwoCount: number | undefined;
    let acssTwoAmount: number | undefined;

    // Bank reference: prefer "Bank Ref(erence)" labelled value within block,
    // matching BOTH the Z Dispense format and the Medicare format. Fall back
    // to the document-level bank reference number captured at the top of file.
    const refLabel =
      block.match(/Bank\s*reference\s*number[:\s]+(\d{9,15})/i) ||
      block.match(/Bank\s*Ref(?:erence)?\.?\s*(?:Number|No\.?)?[:\s]*?(\d{9,15})/i);
    if (refLabel && refLabel[1] !== pbsPaymentId) {
      bankReferenceNumber = refLabel[1];
    } else if (docBankReferenceNumber) {
      bankReferenceNumber = docBankReferenceNumber;
    } else {
      const nums = [...block.matchAll(/\b(\d{10,15})\b/g)]
        .map((mm) => mm[1])
        .filter((n) => n !== pbsPaymentId && !n.startsWith("1003"));
      bankReferenceNumber = nums[0];
    }
    if (bankReferenceNumber) bankReferences.add(bankReferenceNumber);

    // Claim period: in Medicare PDFs it appears as the first column on the
    // PBS ID row, e.g. "2604  100373819312  General benefits  $8,010.60".
    // Look for a 4-digit code in the 2500-2699 range either immediately
    // before or after the PBS ID.
    const pbsIdLineMatch = block.match(
      /\b(2[5-6]\d{2})\b[\s\S]{0,60}?\b1003\d{8}\b|\b1003\d{8}\b[\s\S]{0,10}?\b(2[5-6]\d{2})\b/,
    );
    claimPeriod = pbsIdLineMatch?.[1] ?? pbsIdLineMatch?.[2];

    if (!claimPeriod) {
      // Legacy labelled fallback ("Claim Period: 2604")
      const cpLabelled = block.match(/Claim\s*Period[^\n\d]*(\d{3,4})/i);
      claimPeriod = cpLabelled?.[1];
    }

    if (!claimPeriod) {
      // Last resort: scan first 200 chars of block for any 2500-2699 code.
      const head = block.slice(0, 200).match(/\b(2[5-6]\d{2})\b/);
      claimPeriod = head?.[1] ?? docClaimPeriodFallback;
    }

    // Benefit categories
    generalBenefits = findValueAfterLabel(blockLines, [RE_GENERAL]);
    generalUnderCoBenefits = findValueAfterLabel(blockLines, [RE_GENERAL_UNDERCO]);
    concessionalBenefits = findValueAfterLabel(blockLines, [RE_CONCESSIONAL]);
    entitlementBenefits = findValueAfterLabel(blockLines, [RE_ENTITLEMENT]);
    repatriationBenefits = findValueAfterLabel(blockLines, [RE_REPAT]);
    doctorsBagBenefits = findValueAfterLabel(blockLines, [RE_DOCTORS_BAG]);

    // Totals — extracted ONLY from this block, in priority order
    totalPBS = findValueAfterLabel(blockLines, [RE_TOTAL_PBS_PAREN, RE_TOTAL_PBS]);
    totalPBSPlusRPBS = findValueAfterLabel(blockLines, [RE_TOTAL_PBS_RPBS]);
    bankedTotal = findValueAfterLabel(blockLines, [
      RE_TOTAL_PBS_RPBS_FEES,
      RE_TOTAL_PBS_FEES,
      RE_BANKED,
    ]);

    // ACSS components
    const acss1 = findCountAndAmount(blockLines, RE_ACSS_ONE);
    const acss2 = findCountAndAmount(blockLines, RE_ACSS_TWO);
    acssOneCount = acss1.count;
    acssOneAmount = acss1.amount;
    acssTwoCount = acss2.count;
    acssTwoAmount = acss2.amount;

    const localWarnings: ParseWarning[] = [];
    let confidence = 1;
    if (totalPBS === undefined && totalPBSPlusRPBS === undefined) {
      confidence = 0.5;
      localWarnings.push({
        type: "missing-total",
        severity: "warning",
        message: `No total PBS / total PBS+RPBS found for ${pbsPaymentId}`,
        pbsPaymentId,
      });
    }
    if (!bankReferenceNumber) {
      confidence = Math.min(confidence, 0.7);
      localWarnings.push({
        type: "missing-bank-ref",
        severity: "info",
        message: `No bank reference detected for ${pbsPaymentId}`,
        pbsPaymentId,
      });
    }

    // First-pass isAdjustment: only based on negative totals. Prior-period
    // detection happens in the second pass once we know the document's
    // primary claim period.
    const isAdjustment =
      (totalPBS !== undefined && totalPBS < 0) ||
      (totalPBSPlusRPBS !== undefined && totalPBSPlusRPBS < 0);

    entries.push({
      id: uid("ae_"),
      sourceFileId,
      sourceFileName,
      adviceDate: docAdviceDate,
      paymentDate: docPaymentDate,
      claimPeriod,
      bankReferenceNumber,
      pbsPaymentId,
      generalBenefits,
      generalUnderCoBenefits,
      concessionalBenefits,
      entitlementBenefits,
      repatriationBenefits,
      doctorsBagBenefits,
      totalPBS,
      totalPBSPlusRPBS,
      acssComponentOneCount: acssOneCount,
      acssComponentOneAmount: acssOneAmount,
      acssComponentTwoCount: acssTwoCount,
      acssComponentTwoAmount: acssTwoAmount,
      bankedTotal,
      isAdjustment,
      rawTextBlock: block,
      parseConfidence: confidence,
      parseWarnings: localWarnings,
    });
    warnings.push(...localWarnings);
  }

  // Second pass: detect prior-period entries. Any record whose claim period
  // differs from the document's primary (most-frequent) claim period is a
  // prior-period adjustment, even if its total is positive.
  const docPrimaryClaimPeriod = getMostFrequentClaimPeriod(entries);
  if (docPrimaryClaimPeriod) {
    for (const e of entries) {
      if (
        !e.isAdjustment &&
        e.claimPeriod !== undefined &&
        e.claimPeriod !== docPrimaryClaimPeriod
      ) {
        e.isAdjustment = true;
      }
    }
  }

  if (entries.length === 0) {
    warnings.push({
      type: "no-records",
      severity: "error",
      message: "No PBS payment IDs detected in payment advice",
    });
  }

  return {
    entries,
    warnings,
    supplierNumber,
    paymentDate: docPaymentDate,
    adviceDate: docAdviceDate,
    bankReferences: [...bankReferences],
  };
}
