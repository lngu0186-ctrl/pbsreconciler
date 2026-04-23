import type { AdviceEntry, ParseWarning } from "@/types";
import { parseMoney, parseInt0 } from "@/lib/parseMoney";
import { uid } from "@/lib/ids";

const PBS_ID_RE = /\b(1\d{11})\b/g;
const SUPPLIER_RE = /\b(\d{4,5}[A-Z])\b/;

export interface AdviceParseResult {
  entries: AdviceEntry[];
  warnings: ParseWarning[];
  supplierNumber?: string;
  paymentDate?: string;
  adviceDate?: string;
  bankReferences: string[];
}

function findValueAfterLabel(text: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const re = new RegExp(
      label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "[^\\n]*?(-?\\$?\\s*[0-9][0-9,]*\\.[0-9]{2})",
      "i",
    );
    const m = text.match(re);
    if (m) {
      const v = parseMoney(m[1]);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

function findCountAndAmount(
  text: string,
  label: string,
): { count?: number; amount?: number } {
  const re = new RegExp(
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      "[^\\n]*?(\\d+)[^\\n]*?(-?\\$?\\s*[0-9][0-9,]*\\.[0-9]{2})",
    "i",
  );
  const m = text.match(re);
  if (!m) return {};
  return {
    count: parseInt0(m[1]),
    amount: parseMoney(m[2]),
  };
}

/**
 * Parse a PBS Payment Advice (incl. RCTI variant).
 * One PDF may contain MULTIPLE PBS payment IDs — we split the text into blocks
 * around each detected ID and parse independently.
 */
export function parsePaymentAdvice(
  text: string,
  sourceFileId: string,
  sourceFileName: string,
): AdviceParseResult {
  const warnings: ParseWarning[] = [];
  const entries: AdviceEntry[] = [];
  const bankReferences = new Set<string>();

  // Document-level metadata
  const supplierMatch = text.match(/Approved\s*Supplier[^\n]*?(\d{4,5}[A-Z])/i)
    || text.match(SUPPLIER_RE);
  const supplierNumber = supplierMatch?.[1];

  const paymentDateMatch = text.match(/Payment\s*Date[:\s]+([0-9]{1,2}\s+[A-Za-z]{3,}\s+20\d{2}|[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i);
  const adviceDateMatch = text.match(/Advice\s*Date[:\s]+([0-9]{1,2}\s+[A-Za-z]{3,}\s+20\d{2}|[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i);
  const docPaymentDate = paymentDateMatch?.[1];
  const docAdviceDate = adviceDateMatch?.[1];

  // Find ID positions
  const matches: { id: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  PBS_ID_RE.lastIndex = 0;
  while ((m = PBS_ID_RE.exec(text)) !== null) {
    matches.push({ id: m[1], index: m.index });
  }
  // Dedup consecutive same IDs (header references)
  const uniquePositions: { id: string; index: number }[] = [];
  const seen = new Map<string, number>();
  for (const mm of matches) {
    if (!seen.has(mm.id) || mm.index - (seen.get(mm.id) ?? 0) > 200) {
      uniquePositions.push(mm);
      seen.set(mm.id, mm.index);
    }
  }

  // Build blocks: from each occurrence to the next
  for (let i = 0; i < uniquePositions.length; i++) {
    const start = uniquePositions[i].index;
    const end = i + 1 < uniquePositions.length ? uniquePositions[i + 1].index : text.length;
    const block = text.slice(Math.max(0, start - 200), end);
    const pbsPaymentId = uniquePositions[i].id;

    // Bank reference: first 10-15 digit number near the ID, but NOT another PBS ID
    let bankReferenceNumber: string | undefined;
    const refMatch = block.match(/Bank\s*Ref(?:erence)?[^\n]*?(\d{10,15})/i);
    if (refMatch && refMatch[1] !== pbsPaymentId) {
      bankReferenceNumber = refMatch[1];
    } else {
      // fall back: any nearby 11-15 digit number that isn't a PBS ID
      const nums = [...block.matchAll(/\b(\d{10,15})\b/g)]
        .map((mm) => mm[1])
        .filter((n) => n !== pbsPaymentId && !n.startsWith("1003"));
      bankReferenceNumber = nums[0];
    }
    if (bankReferenceNumber) bankReferences.add(bankReferenceNumber);

    const claimPeriodMatch = block.match(/Claim\s*Period[^\n\d]*(\d{3,4})/i);
    const claimPeriod = claimPeriodMatch?.[1];

    const generalBenefits = findValueAfterLabel(block, ["General benefits", "General Benefits"]);
    const generalUnderCoBenefits = findValueAfterLabel(block, ["General under co", "General under-co", "General Under Co"]);
    const concessionalBenefits = findValueAfterLabel(block, ["Concessional benefits", "Concessional Benefits"]);
    const entitlementBenefits = findValueAfterLabel(block, ["Entitlement", "Free benefits"]);
    const repatriationBenefits = findValueAfterLabel(block, ["Repatriation", "RPBS benefits"]);
    const doctorsBagBenefits = findValueAfterLabel(block, ["Doctor's Bag", "Doctors Bag"]);
    const totalPBS = findValueAfterLabel(block, ["Total PBS Benefits", "Total (PBS)", "Total PBS"]);
    const totalPBSPlusRPBS = findValueAfterLabel(block, ["Total (PBS + RPBS)", "Total PBS + RPBS", "Total PBS+RPBS"]);
    const acss1 = findCountAndAmount(block, "ACSS Component 1");
    const acss2 = findCountAndAmount(block, "ACSS Component 2");
    const bankedTotal = findValueAfterLabel(block, [
      "Total (PBS + RPBS + Fees)",
      "Total PBS + RPBS + Fees",
      "Total (PBS + Fees)",
      "Total PBS + Fees",
      "Banked Total",
      "Banked",
    ]);

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
      acssComponentOneCount: acss1.count,
      acssComponentOneAmount: acss1.amount,
      acssComponentTwoCount: acss2.count,
      acssComponentTwoAmount: acss2.amount,
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
