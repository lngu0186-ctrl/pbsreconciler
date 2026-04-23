import type { SummaryEntry, AdviceEntry, SafetyNetEntry, UploadedFile } from "@/types";
import { uid } from "@/lib/ids";

const SUMMARY_FILE_ID = "demo_summary_2605";
const SAFETY_FILE_ID = "demo_safetynet_2605";
const ADVICE_FILES = {
  may05: "demo_advice_may05",
  may08: "demo_advice_may08",
  may15: "demo_advice_may15",
  may18: "demo_advice_may18",
};

// Fictional bank reference numbers — invented placeholders, not real
const BANK_A = "550012345001";
const BANK_B = "550012345002";
const BANK_C = "550012345003";
const BANK_D = "550012345004";

interface SumSeed {
  pbsPaymentId: string;
  bank: string;
  rx: number;
  amt: number;
  gen: number;
  con: number;
  ent: number;
  repat: number;
  subtotal: number;
}

const sumSeeds: SumSeed[] = [
  // Bank A — single record
  { pbsPaymentId: "100355010001", bank: BANK_A, rx: 18, amt: 4820.10, gen: 4820.10, con: 1750.40, ent: 425.30, repat: 0, subtotal: 6995.80 },

  // Bank B — multi-record deposit group
  { pbsPaymentId: "100355010002", bank: BANK_B, rx: 12, amt: 720.45, gen: 720.45, con: 980.20, ent: 0, repat: 0, subtotal: 1700.65 },
  { pbsPaymentId: "100355010003", bank: BANK_B, rx: 8, amt: 310.80, gen: 310.80, con: 2150.60, ent: 1420.55, repat: 0, subtotal: 3881.95 },
  { pbsPaymentId: "100355010004", bank: BANK_B, rx: 22, amt: 410.30, gen: 410.30, con: 11200.75, ent: 1280.40, repat: 12.50, subtotal: 12903.95 },
  { pbsPaymentId: "100355010005", bank: BANK_B, rx: 35, amt: 2840.60, gen: 2840.60, con: 2510.20, ent: 285.40, repat: 0, subtotal: 5636.20 },
  { pbsPaymentId: "100355010006", bank: BANK_B, rx: 15, amt: 850.40, gen: 850.40, con: 4920.10, ent: 720.30, repat: 0, subtotal: 6490.80 },

  // Bank C
  { pbsPaymentId: "100355010007", bank: BANK_C, rx: 17, amt: 1980.50, gen: 1980.50, con: 3520.40, ent: 480.20, repat: 0, subtotal: 5981.10 },
  { pbsPaymentId: "100355010008", bank: BANK_C, rx: 20, amt: 1380.95, gen: 1380.95, con: 358.23, ent: 540.10, repat: 0, subtotal: 2279.28 },
  { pbsPaymentId: "100355010009", bank: BANK_C, rx: 38, amt: 2950.20, gen: 2950.20, con: 4420.60, ent: 1080.40, repat: 0, subtotal: 8451.20 },
  { pbsPaymentId: "100355010010", bank: BANK_C, rx: 13, amt: 9320.55, gen: 9320.55, con: 5810.40, ent: 410.20, repat: 320.50, subtotal: 15861.65 },

  // Bank D
  { pbsPaymentId: "100355010011", bank: BANK_D, rx: 16, amt: 245.60, gen: 245.60, con: 2870.30, ent: 615.40, repat: 0, subtotal: 3731.30 },
  { pbsPaymentId: "100355010012", bank: BANK_D, rx: 10, amt: 220.40, gen: 220.40, con: 2640.50, ent: 340.20, repat: 35.80, subtotal: 3236.90 },

  // Pending — no advice received yet
  { pbsPaymentId: "100355010013", bank: "PENDING", rx: 21, amt: 580.20, gen: 580.20, con: 11920.40, ent: 420.30, repat: 0, subtotal: 12940.90 },
  { pbsPaymentId: "100355010014", bank: "PENDING", rx: 9, amt: 1240.80, gen: 1240.80, con: 3810.20, ent: 248.40, repat: 0, subtotal: 5299.40 },
];

interface AdvSeed {
  pbsPaymentId: string;
  bank: string;
  paymentDate: string;
  fileId: string;
  fileName: string;
  claimPeriod: string;
  pbs: number;
  rpbs: number;
  acss: number;
  banked: number;
  isAdj?: boolean;
}

const adviceSeeds: AdvSeed[] = [
  // 05 May — Bank A
  { pbsPaymentId: "100355010001", bank: BANK_A, paymentDate: "05 May 2026", fileId: ADVICE_FILES.may05, fileName: "PBS_Advice_2026-05-05.pdf", claimPeriod: "2605", pbs: 6995.80, rpbs: 0, acss: 210.45, banked: 7206.25 },

  // 08 May — Bank B (multi-ID deposit)
  { pbsPaymentId: "100355010005", bank: BANK_B, paymentDate: "08 May 2026", fileId: ADVICE_FILES.may08, fileName: "PBS_Advice_2026-05-08.pdf", claimPeriod: "2605", pbs: 5636.20, rpbs: 0, acss: 240.10, banked: 5876.30 },
  { pbsPaymentId: "100355010004", bank: BANK_B, paymentDate: "08 May 2026", fileId: ADVICE_FILES.may08, fileName: "PBS_Advice_2026-05-08.pdf", claimPeriod: "2605", pbs: 12891.45, rpbs: 12.50, acss: 220.80, banked: 13124.75 },
  { pbsPaymentId: "100355010006", bank: BANK_B, paymentDate: "08 May 2026", fileId: ADVICE_FILES.may08, fileName: "PBS_Advice_2026-05-08.pdf", claimPeriod: "2605", pbs: 6490.80, rpbs: 0, acss: 245.60, banked: 6736.40 },
  { pbsPaymentId: "100355010003", bank: BANK_B, paymentDate: "08 May 2026", fileId: ADVICE_FILES.may08, fileName: "PBS_Advice_2026-05-08.pdf", claimPeriod: "2605", pbs: 3881.95, rpbs: 0, acss: 115.30, banked: 3997.25 },
  { pbsPaymentId: "100355010002", bank: BANK_B, paymentDate: "08 May 2026", fileId: ADVICE_FILES.may08, fileName: "PBS_Advice_2026-05-08.pdf", claimPeriod: "2605", pbs: 1700.65, rpbs: 0, acss: 100.40, banked: 1801.05 },

  // 15 May — Bank C (includes minor difference + adjustment)
  { pbsPaymentId: "100355010008", bank: BANK_C, paymentDate: "15 May 2026", fileId: ADVICE_FILES.may15, fileName: "PBS_Advice_2026-05-15.pdf", claimPeriod: "2605", pbs: 2294.40, rpbs: 0, acss: 138.20, banked: 2432.60 },
  { pbsPaymentId: "100355010007", bank: BANK_C, paymentDate: "15 May 2026", fileId: ADVICE_FILES.may15, fileName: "PBS_Advice_2026-05-15.pdf", claimPeriod: "2605", pbs: 5981.10, rpbs: 0, acss: 195.40, banked: 6176.50 },
  { pbsPaymentId: "100355010010", bank: BANK_C, paymentDate: "15 May 2026", fileId: ADVICE_FILES.may15, fileName: "PBS_Advice_2026-05-15.pdf", claimPeriod: "2605", pbs: 15541.15, rpbs: 320.50, acss: 325.40, banked: 16187.05 },
  { pbsPaymentId: "100355010009", bank: BANK_C, paymentDate: "15 May 2026", fileId: ADVICE_FILES.may15, fileName: "PBS_Advice_2026-05-15.pdf", claimPeriod: "2605", pbs: 8451.20, rpbs: 0, acss: 410.20, banked: 8861.40 },
  { pbsPaymentId: "100355099001", bank: BANK_C, paymentDate: "15 May 2026", fileId: ADVICE_FILES.may15, fileName: "PBS_Advice_2026-05-15.pdf", claimPeriod: "2604", pbs: -8.40, rpbs: 0, acss: -0.95, banked: -9.35, isAdj: true },

  // 18 May — Bank D
  { pbsPaymentId: "100355010012", bank: BANK_D, paymentDate: "18 May 2026", fileId: ADVICE_FILES.may18, fileName: "PBS_Advice_2026-05-18.pdf", claimPeriod: "2605", pbs: 3201.10, rpbs: 35.80, acss: 178.40, banked: 3415.30 },
  { pbsPaymentId: "100355010011", bank: BANK_D, paymentDate: "18 May 2026", fileId: ADVICE_FILES.may18, fileName: "PBS_Advice_2026-05-18.pdf", claimPeriod: "2605", pbs: 3731.30, rpbs: 0, acss: 162.50, banked: 3893.80 },
];

export function buildDemoData(): {
  files: UploadedFile[];
  summaries: SummaryEntry[];
  advices: AdviceEntry[];
  safetyNet: SafetyNetEntry[];
} {
  const summaries: SummaryEntry[] = sumSeeds.map((s) => ({
    id: uid("se_"),
    sourceFileId: SUMMARY_FILE_ID,
    sourceFileName: "Summary_Reconciliation_Report_2605.pdf",
    reportDate: "20 May 2026",
    claimPeriod: "2605",
    bankReferenceNumber: s.bank === "PENDING" ? undefined : s.bank,
    pbsPaymentId: s.pbsPaymentId,
    rxTransactions: s.rx,
    amountPaid: s.amt,
    generalBenefits: s.gen,
    concessionalBenefits: s.con,
    entitlementBenefits: s.ent,
    repatriationBenefits: s.repat,
    subtotal: s.subtotal,
    parseConfidence: 1,
    parseWarnings: [],
    rawTextBlock: `${s.pbsPaymentId}  ${s.rx}  ${s.amt.toFixed(2)}  ${s.gen.toFixed(2)}  ${s.con.toFixed(2)}  ${s.ent.toFixed(2)}  ${s.repat.toFixed(2)}  ${s.subtotal.toFixed(2)}`,
  }));

  const advices: AdviceEntry[] = adviceSeeds.map((a) => ({
    id: uid("ae_"),
    sourceFileId: a.fileId,
    sourceFileName: a.fileName,
    paymentDate: a.paymentDate,
    adviceDate: a.paymentDate,
    claimPeriod: a.claimPeriod,
    bankReferenceNumber: a.bank,
    pbsPaymentId: a.pbsPaymentId,
    totalPBS: a.pbs,
    totalPBSPlusRPBS: a.rpbs > 0 ? a.pbs + a.rpbs : undefined,
    acssComponentOneAmount: a.acss,
    acssComponentOneCount: 0,
    bankedTotal: a.banked,
    isAdjustment: a.isAdj,
    parseConfidence: 1,
    parseWarnings: [],
    rawTextBlock: `Demo advice block for ${a.pbsPaymentId}`,
  }));

  // One Safety Net statement entry
  const safetyNet: SafetyNetEntry[] = [
    {
      id: uid("sn_"),
      sourceFileId: SAFETY_FILE_ID,
      sourceFileName: "PBS_SafetyNet_Statement_2605.pdf",
      printDate: "20 May 2026",
      pbsPaymentId: "100355088001",
      claimReference: "SN-2605-0001",
      cardIssued: "Yes",
      cardHolder: "Demo Cardholder",
      result: "Approved",
      assessmentReason: "Threshold met",
      rawTextBlock: "Demo Safety Net statement entry",
    },
  ];

  // Build file records
  const fileMap = new Map<string, UploadedFile>();
  fileMap.set(SUMMARY_FILE_ID, {
    id: SUMMARY_FILE_ID,
    name: "Summary_Reconciliation_Report_2605.pdf",
    detectedType: "summary",
    uploadedAt: Date.now(),
    recordCount: summaries.length,
    parseConfidence: 1,
    warnings: [],
    reportDate: "20 May 2026",
    bankReferences: [BANK_A, BANK_B, BANK_C, BANK_D],
  });
  fileMap.set(SAFETY_FILE_ID, {
    id: SAFETY_FILE_ID,
    name: "PBS_SafetyNet_Statement_2605.pdf",
    detectedType: "safetyNet",
    uploadedAt: Date.now(),
    recordCount: safetyNet.length,
    parseConfidence: 1,
    warnings: [],
    reportDate: "20 May 2026",
  });
  for (const a of adviceSeeds) {
    if (!fileMap.has(a.fileId)) {
      fileMap.set(a.fileId, {
        id: a.fileId,
        name: a.fileName,
        detectedType: "advice",
        uploadedAt: Date.now(),
        recordCount: 0,
        parseConfidence: 1,
        warnings: [],
        paymentDate: a.paymentDate,
        supplierNumber: "99999X",
        bankReferences: [],
      });
    }
    const f = fileMap.get(a.fileId)!;
    f.recordCount++;
    if (a.bank && !f.bankReferences!.includes(a.bank)) {
      f.bankReferences!.push(a.bank);
    }
  }

  return {
    files: [...fileMap.values()],
    summaries,
    advices,
    safetyNet,
  };
}
