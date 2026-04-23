import type { AdviceEntry, ParseWarning } from "@/types";
import { parseMoney, parseInt0 } from "@/lib/parseMoney";
import { uid } from "@/lib/ids";

const PBS_ID_RE = /\b(1\d{11})\b/g;
const SUPPLIER_RE = /\b(\d{4,5}[A-Z])\b/;
const DECIMAL_NUM_RE = /-?\$?\s*[0-9][0-9,]*\.[0-9]{2}/;

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

/**
 * Parse a PBS Payment Advice (incl. RCTI variant).
 *
 * Critical correctness rule: each PBS Payment ID block is parsed in strict
 * isolation. We find every PBS ID position, then for each ID build a block
 * spanning from that position (with a small lookbehind for the bank ref
 * label) up to — but not including — the next PBS ID. All extracted fields
 * are local to the block; nothing carries forward across blocks.
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

  const paymentDateMatch = text.match(
    /Payment\s*Date[:\s]+([0-9]{1,2}\s+[A-Za-z]{3,}\s+20\d{2}|[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
  );
  const adviceDateMatch = text.match(
    /Advice\s*Date[:\s]+([0-9]{1,2}\s+[A-Za-z]{3,}\s+20\d{2}|[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
  );
  const docPaymentDate = paymentDateMatch?.[1];
  const docAdviceDate = adviceDateMatch?.[1];

  // Find all PBS ID positions in the raw text
  const matches: { id: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  PBS_ID_RE.lastIndex = 0;
  while ((m = PBS_ID_RE.exec(text)) !== null) {
    matches.push({ id: m[1], index: m.index });
  }

  // De-duplicate header references that repeat the same ID right next to itself
  const uniquePositions: { id: string; index: number }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const prev = uniquePositions[uniquePositions.length - 1];
    if (prev && prev.id === cur.id && cur.index - prev.index < 200) continue;
    uniquePositions.push(cur);
  }

  for (let i = 0; i < uniquePositions.length; i++) {
    const pbsPaymentId = uniquePositions[i].id;
    // Strict scope: block start = this ID position (with a small lookbehind to
    // capture the bank-ref / claim-period header that introduces this block);
    // block end = next ID position (or EOF).
    const lookbehind = i === 0 ? 400 : 200;
    const start = Math.max(0, uniquePositions[i].index - lookbehind);
    // Don't let lookbehind reach into the previous block
    const safeStart =
      i > 0 ? Math.max(start, uniquePositions[i - 1].index + uniquePositions[i - 1].id.length) : start;
    const end =
      i + 1 < uniquePositions.length ? uniquePositions[i + 1].index : text.length;

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

    // Bank reference: prefer "Bank Ref(erence)" labelled value within block
    const refLabel = block.match(/Bank\s*Ref(?:erence)?[^\n]*?(\d{10,15})/i);
    if (refLabel && refLabel[1] !== pbsPaymentId) {
      bankReferenceNumber = refLabel[1];
    } else {
      const nums = [...block.matchAll(/\b(\d{10,15})\b/g)]
        .map((mm) => mm[1])
        .filter((n) => n !== pbsPaymentId && !n.startsWith("100"));
      bankReferenceNumber = nums[0];
    }
    if (bankReferenceNumber) bankReferences.add(bankReferenceNumber);

    const cpMatch = block.match(/Claim\s*Period[^\n\d]*(\d{3,4})/i);
    claimPeriod = cpMatch?.[1];

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
