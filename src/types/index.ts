export type DocumentType =
  | "summary"
  | "advice"
  | "safetyNet"
  | "unknown";

export interface ParseWarning {
  type: string;
  message: string;
  pbsPaymentId?: string;
  severity: "info" | "warning" | "error";
  textSnippet?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  detectedType: DocumentType;
  uploadedAt: number;
  recordCount: number;
  parseConfidence: number; // 0..1
  warnings: ParseWarning[];
  rawText?: string;
  supplierNumber?: string;
  reportDate?: string;
  paymentDate?: string;
  bankReferences?: string[];
}

export interface SummaryEntry {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  reportDate?: string;
  claimPeriod?: string;
  bankReferenceNumber?: string;
  pbsPaymentId: string;
  rxTransactions?: number;
  amountPaid?: number;
  generalBenefits?: number;
  concessionalBenefits?: number;
  entitlementBenefits?: number;
  repatriationBenefits?: number;
  doctorsBagBenefits?: number;
  dbfAmount?: number;
  subtotal?: number;
  incentives?: number;
  total?: number;
  rawTextBlock?: string;
  parseConfidence: number;
  parseWarnings: ParseWarning[];
  _debug?: {
    rawBlockPreview: string;
    amtPaidFound: boolean;
    amtPaidValue: number;
    amountsArrayRaw: number[];
    amountsPosition5: number;
    amountsLastValue: number;
    subtotalFallbackUsed: boolean;
    allDecimalsInBlock: number[];
  };
}

export interface AdviceEntry {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  adviceDate?: string;
  paymentDate?: string;
  claimPeriod?: string;
  bankReferenceNumber?: string;
  pbsPaymentId: string;
  generalBenefits?: number;
  generalUnderCoBenefits?: number;
  concessionalBenefits?: number;
  entitlementBenefits?: number;
  repatriationBenefits?: number;
  doctorsBagBenefits?: number;
  totalPBS?: number;
  totalPBSPlusRPBS?: number;
  acssComponentOneCount?: number;
  acssComponentOneAmount?: number;
  acssComponentTwoCount?: number;
  acssComponentTwoAmount?: number;
  bankedTotal?: number;
  isAdjustment?: boolean;
  rawTextBlock?: string;
  parseConfidence: number;
  parseWarnings: ParseWarning[];
}

export interface SafetyNetEntry {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  printDate?: string;
  pbsPaymentId?: string;
  claimReference?: string;
  cardIssued?: string;
  cardHolder?: string;
  result?: string;
  assessmentReason?: string;
  rawTextBlock?: string;
}

export type ReconStatus =
  | "balanced"
  | "minor"
  | "mismatch"
  | "pending"
  | "adviceOnly"
  | "adjustment"
  | "parseIssue";

export interface ReconResult {
  pbsPaymentId: string;
  claimPeriodFromSummary?: string;
  claimPeriodFromAdvice?: string;
  bankReferenceSummary?: string;
  bankReferenceAdvice?: string;
  summarySubtotal?: number;
  adviceComparableTotal?: number;
  adviceTotalPBS?: number;
  adviceTotalPBSPlusRPBS?: number;
  acssTotal?: number;
  bankedTotal?: number;
  difference?: number;
  status: ReconStatus;
  issueFlags: string[];
  summaryRecord?: SummaryEntry;
  adviceRecord?: AdviceEntry;
  notes: string[];
}
