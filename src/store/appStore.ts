import { create } from "zustand";
import type {
  AdviceEntry,
  ReconResult,
  SafetyNetEntry,
  SummaryEntry,
  UploadedFile,
} from "@/types";
import { reconcile } from "@/lib/reconcile";
import { extractTextFromAny } from "@/lib/pdfText";
import { detectDocumentType } from "@/parsers/detectType";
import { parseSummaryReport } from "@/parsers/summaryReportParser";
import { parsePaymentAdvice } from "@/parsers/paymentAdviceParser";
import { parseSafetyNet } from "@/parsers/safetyNetParser";
import { uid } from "@/lib/ids";
import { buildDemoData } from "@/lib/demoData";

interface AppState {
  files: UploadedFile[];
  summaries: SummaryEntry[];
  advices: AdviceEntry[];
  safetyNet: SafetyNetEntry[];
  results: ReconResult[];
  selectedPbsId?: string;
  isProcessing: boolean;

  loadDemo: () => void;
  clearAll: () => void;
  uploadFiles: (files: File[]) => Promise<void>;
  recompute: () => void;
  selectPbs: (id?: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  files: [],
  summaries: [],
  advices: [],
  safetyNet: [],
  results: [],
  isProcessing: false,

  loadDemo: () => {
    const { files, summaries, advices } = buildDemoData();
    set({
      files,
      summaries,
      advices,
      safetyNet: [],
      results: reconcile(summaries, advices),
    });
  },

  clearAll: () =>
    set({
      files: [],
      summaries: [],
      advices: [],
      safetyNet: [],
      results: [],
      selectedPbsId: undefined,
    }),

  recompute: () => {
    const { summaries, advices } = get();
    set({ results: reconcile(summaries, advices) });
  },

  selectPbs: (id) => set({ selectedPbsId: id }),

  uploadFiles: async (incoming) => {
    set({ isProcessing: true });
    const newFiles: UploadedFile[] = [];
    const newSummaries: SummaryEntry[] = [];
    const newAdvices: AdviceEntry[] = [];
    const newSafety: SafetyNetEntry[] = [];

    for (const f of incoming) {
      const fileId = uid("f_");
      try {
        const text = await extractTextFromAny(f);
        const type = detectDocumentType(text);
        if (type === "summary") {
          const r = parseSummaryReport(text, fileId, f.name);
          newSummaries.push(...r.entries);
          newFiles.push({
            id: fileId,
            name: f.name,
            detectedType: "summary",
            uploadedAt: Date.now(),
            recordCount: r.entries.length,
            parseConfidence: r.entries.length
              ? r.entries.reduce((s, e) => s + e.parseConfidence, 0) / r.entries.length
              : 0,
            warnings: r.warnings,
            rawText: text,
            reportDate: r.reportDate,
            bankReferences: r.bankReferences,
          });
        } else if (type === "advice") {
          const r = parsePaymentAdvice(text, fileId, f.name);
          newAdvices.push(...r.entries);
          newFiles.push({
            id: fileId,
            name: f.name,
            detectedType: "advice",
            uploadedAt: Date.now(),
            recordCount: r.entries.length,
            parseConfidence: r.entries.length
              ? r.entries.reduce((s, e) => s + e.parseConfidence, 0) / r.entries.length
              : 0,
            warnings: r.warnings,
            rawText: text,
            supplierNumber: r.supplierNumber,
            paymentDate: r.paymentDate,
            bankReferences: r.bankReferences,
          });
        } else if (type === "safetyNet") {
          const r = parseSafetyNet(text, fileId, f.name);
          newSafety.push(...r.entries);
          newFiles.push({
            id: fileId,
            name: f.name,
            detectedType: "safetyNet",
            uploadedAt: Date.now(),
            recordCount: r.entries.length,
            parseConfidence: 1,
            warnings: r.warnings,
            rawText: text,
            reportDate: r.printDate,
          });
        } else {
          newFiles.push({
            id: fileId,
            name: f.name,
            detectedType: "unknown",
            uploadedAt: Date.now(),
            recordCount: 0,
            parseConfidence: 0,
            warnings: [
              {
                type: "unrecognised",
                severity: "error",
                message: "Could not classify document type",
              },
            ],
            rawText: text,
          });
        }
      } catch (err) {
        newFiles.push({
          id: fileId,
          name: f.name,
          detectedType: "unknown",
          uploadedAt: Date.now(),
          recordCount: 0,
          parseConfidence: 0,
          warnings: [
            {
              type: "extract-failed",
              severity: "error",
              message: err instanceof Error ? err.message : "Failed to extract text from file",
            },
          ],
        });
      }
    }

    const allFiles = [...get().files, ...newFiles];
    const allSummaries = [...get().summaries, ...newSummaries];
    const allAdvices = [...get().advices, ...newAdvices];
    const allSafety = [...get().safetyNet, ...newSafety];

    set({
      files: allFiles,
      summaries: allSummaries,
      advices: allAdvices,
      safetyNet: allSafety,
      results: reconcile(allSummaries, allAdvices),
      isProcessing: false,
    });
  },
}));
