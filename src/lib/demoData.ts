import type { SummaryEntry, AdviceEntry, UploadedFile } from "@/types";
import { uid } from "@/lib/ids";

const SUMMARY_FILE_ID = "demo_summary_2604";
const ADVICE_FILES = {
  apr07: "demo_advice_apr07",
  apr10: "demo_advice_apr10",
  apr17: "demo_advice_apr17",
  apr20: "demo_advice_apr20",
};

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
  // Bank 668002132172
  { pbsPaymentId: "100373819312", bank: "668002132172", rx: 17, amt: 5585.92, gen: 5585.92, con: 1920.11, ent: 504.57, repat: 0, subtotal: 8010.60 },
  // Bank 107002160245
  { pbsPaymentId: "100373834612", bank: "107002160245", rx: 14, amt: 816.22, gen: 816.22, con: 1133.35, ent: 0, repat: 0, subtotal: 1949.57 },
  { pbsPaymentId: "100373836532", bank: "107002160245", rx: 6, amt: 239.45, gen: 239.45, con: 2477.80, ent: 1751.06, repat: 0, subtotal: 4468.31 },
  { pbsPaymentId: "100373851832", bank: "107002160245", rx: 21, amt: 332.15, gen: 332.15, con: 12748.91, ent: 1402.01, repat: 10.22, subtotal: 14493.29 },
  { pbsPaymentId: "100373860444", bank: "107002160245", rx: 40, amt: 3124.20, gen: 3124.20, con: 2878.70, ent: 304.33, repat: 0, subtotal: 6307.23 },
  { pbsPaymentId: "100373871986", bank: "107002160245", rx: 14, amt: 901.76, gen: 901.76, con: 5605.27, ent: 803.69, repat: 0, subtotal: 7310.72 },
  // Bank 634002174035
  { pbsPaymentId: "100373876968", bank: "634002174035", rx: 19, amt: 2229.20, gen: 2229.20, con: 3941.94, ent: 520.44, repat: 0, subtotal: 6691.58 },
  { pbsPaymentId: "100373883192", bank: "634002174035", rx: 6, amt: 610.22, gen: 610.22, con: 1122.88, ent: 613.99, repat: 0, subtotal: 2347.09 },
  { pbsPaymentId: "100373890550", bank: "634002174035", rx: 14, amt: 1572.99, gen: 1572.99, con: 358.23, ent: 589.39, repat: 0, subtotal: 2520.61 },
  { pbsPaymentId: "100373912409", bank: "634002174035", rx: 40, amt: 3273.65, gen: 3273.65, con: 4856.50, ent: 1189.75, repat: 0, subtotal: 9319.90 },
  { pbsPaymentId: "100373930469", bank: "634002174035", rx: 14, amt: 10481.93, gen: 10481.93, con: 6372.10, ent: 442.12, repat: 376.20, subtotal: 17672.35 },
  // Bank 69002162279
  { pbsPaymentId: "100373875118", bank: "69002162279", rx: 19, amt: 288.43, gen: 288.43, con: 3177.10, ent: 670.26, repat: 0, subtotal: 4135.79 },
  { pbsPaymentId: "100373916618", bank: "69002162279", rx: 11, amt: 269.43, gen: 269.43, con: 2898.90, ent: 366.66, repat: 40.92, subtotal: 3575.91 },
  // Pending — no advice
  { pbsPaymentId: "100373923482", bank: "PENDING", rx: 23, amt: 618.94, gen: 618.94, con: 13081.76, ent: 455.87, repat: 0, subtotal: 14156.57 },
  { pbsPaymentId: "100373929790", bank: "PENDING", rx: 10, amt: 1348.09, gen: 1348.09, con: 4124.85, ent: 271.98, repat: 0, subtotal: 5744.92 },
  { pbsPaymentId: "100373961682", bank: "PENDING", rx: 11, amt: 669.62, gen: 669.62, con: 876.17, ent: 148.90, repat: 0, subtotal: 1694.69 },
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
  { pbsPaymentId: "100373819312", bank: "668002132172", paymentDate: "07 Apr 2026", fileId: ADVICE_FILES.apr07, fileName: "PBS_Advice_2026-04-07.pdf", claimPeriod: "2604", pbs: 8010.60, rpbs: 0, acss: 233.51, banked: 8244.11 },

  { pbsPaymentId: "100373860444", bank: "107002160245", paymentDate: "10 Apr 2026", fileId: ADVICE_FILES.apr10, fileName: "PBS_Advice_2026-04-10.pdf", claimPeriod: "2604", pbs: 6307.23, rpbs: 0, acss: 266.25, banked: 6573.48 },
  { pbsPaymentId: "100373851832", bank: "107002160245", paymentDate: "10 Apr 2026", fileId: ADVICE_FILES.apr10, fileName: "PBS_Advice_2026-04-10.pdf", claimPeriod: "2604", pbs: 14483.07, rpbs: 10.22, acss: 244.33, banked: 14737.62 },
  { pbsPaymentId: "100373871986", bank: "107002160245", paymentDate: "10 Apr 2026", fileId: ADVICE_FILES.apr10, fileName: "PBS_Advice_2026-04-10.pdf", claimPeriod: "2604", pbs: 7310.72, rpbs: 0, acss: 272.23, banked: 7582.95 },
  { pbsPaymentId: "100373836532", bank: "107002160245", paymentDate: "10 Apr 2026", fileId: ADVICE_FILES.apr10, fileName: "PBS_Advice_2026-04-10.pdf", claimPeriod: "2604", pbs: 4468.31, rpbs: 0, acss: 127.54, banked: 4595.85 },
  { pbsPaymentId: "100373834612", bank: "107002160245", paymentDate: "10 Apr 2026", fileId: ADVICE_FILES.apr10, fileName: "PBS_Advice_2026-04-10.pdf", claimPeriod: "2604", pbs: 1949.57, rpbs: 0, acss: 111.81, banked: 2061.38 },

  { pbsPaymentId: "100373883192", bank: "634002174035", paymentDate: "17 Apr 2026", fileId: ADVICE_FILES.apr17, fileName: "PBS_Advice_2026-04-17.pdf", claimPeriod: "2604", pbs: 2365.00, rpbs: 0, acss: 153.30, banked: 2518.30 },
  { pbsPaymentId: "100373876968", bank: "634002174035", paymentDate: "17 Apr 2026", fileId: ADVICE_FILES.apr17, fileName: "PBS_Advice_2026-04-17.pdf", claimPeriod: "2604", pbs: 6691.58, rpbs: 0, acss: 213.73, banked: 6905.31 },
  { pbsPaymentId: "100373930469", bank: "634002174035", paymentDate: "17 Apr 2026", fileId: ADVICE_FILES.apr17, fileName: "PBS_Advice_2026-04-17.pdf", claimPeriod: "2604", pbs: 17296.15, rpbs: 376.20, acss: 357.98, banked: 18030.33 },
  { pbsPaymentId: "100373912409", bank: "634002174035", paymentDate: "17 Apr 2026", fileId: ADVICE_FILES.apr17, fileName: "PBS_Advice_2026-04-17.pdf", claimPeriod: "2604", pbs: 9319.90, rpbs: 0, acss: 451.38, banked: 9771.28 },
  { pbsPaymentId: "100373890550", bank: "634002174035", paymentDate: "17 Apr 2026", fileId: ADVICE_FILES.apr17, fileName: "PBS_Advice_2026-04-17.pdf", claimPeriod: "2604", pbs: 2520.61, rpbs: 0, acss: 71.46, banked: 2592.07 },
  { pbsPaymentId: "100373875118", bank: "634002174035", paymentDate: "17 Apr 2026", fileId: ADVICE_FILES.apr17, fileName: "PBS_Advice_2026-04-17.pdf", claimPeriod: "2604", pbs: 4135.79, rpbs: 0, acss: 178.43, banked: 4314.22 },
  { pbsPaymentId: "100373923485", bank: "634002174035", paymentDate: "17 Apr 2026", fileId: ADVICE_FILES.apr17, fileName: "PBS_Advice_2026-04-17.pdf", claimPeriod: "2603", pbs: -10.25, rpbs: 0, acss: -1.21, banked: -11.46, isAdj: true },

  { pbsPaymentId: "100373916618", bank: "69002162279", paymentDate: "20 Apr 2026", fileId: ADVICE_FILES.apr20, fileName: "PBS_Advice_2026-04-20.pdf", claimPeriod: "2604", pbs: 3534.99, rpbs: 40.92, acss: 196.58, banked: 3772.49 },
  { pbsPaymentId: "100373923485", bank: "69002162279", paymentDate: "20 Apr 2026", fileId: ADVICE_FILES.apr20, fileName: "PBS_Advice_2026-04-20.pdf", claimPeriod: "2603", pbs: -10.25, rpbs: 0, acss: -1.21, banked: -11.46, isAdj: true },
];

export function buildDemoData(): {
  files: UploadedFile[];
  summaries: SummaryEntry[];
  advices: AdviceEntry[];
} {
  const summaries: SummaryEntry[] = sumSeeds.map((s) => ({
    id: uid("se_"),
    sourceFileId: SUMMARY_FILE_ID,
    sourceFileName: "Summary_Reconciliation_Report_2604.pdf",
    reportDate: "22 Apr 2026",
    claimPeriod: "2604",
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

  // Build file records
  const fileMap = new Map<string, UploadedFile>();
  fileMap.set(SUMMARY_FILE_ID, {
    id: SUMMARY_FILE_ID,
    name: "Summary_Reconciliation_Report_2604.pdf",
    detectedType: "summary",
    uploadedAt: Date.now(),
    recordCount: summaries.length,
    parseConfidence: 1,
    warnings: [],
    reportDate: "22 Apr 2026",
    bankReferences: ["668002132172", "107002160245", "634002174035", "69002162279"],
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
        supplierNumber: "25374L",
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
  };
}
