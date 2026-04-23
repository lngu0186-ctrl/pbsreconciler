import type { SafetyNetEntry, ParseWarning } from "@/types";
import { uid } from "@/lib/ids";

export interface SafetyNetParseResult {
  entries: SafetyNetEntry[];
  warnings: ParseWarning[];
  printDate?: string;
}

export function parseSafetyNet(
  text: string,
  sourceFileId: string,
  sourceFileName: string,
): SafetyNetParseResult {
  const warnings: ParseWarning[] = [];
  const entries: SafetyNetEntry[] = [];
  const printDateMatch = text.match(/Print\s*Date[:\s]+([0-9A-Za-z\/\- ]+?)(?:\n|$)/i);
  const printDate = printDateMatch?.[1]?.trim();

  const lines = text.split(/\r?\n/);
  let currentPbsId: string | undefined;
  for (const line of lines) {
    const idMatch = line.match(/PBS\s*Payment\s*ID[:\s]+(\d{12})/i);
    if (idMatch) currentPbsId = idMatch[1];

    // Each row: claim ref, card issued, card holder, result, reason
    const rowMatch = line.match(/(\d{6,})\s+(\d{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})\s+(.+?)\s+(Approved|Rejected|Paid|Not Paid)\s*(.*)$/i);
    if (rowMatch) {
      entries.push({
        id: uid("sn_"),
        sourceFileId,
        sourceFileName,
        printDate,
        pbsPaymentId: currentPbsId,
        claimReference: rowMatch[1],
        cardIssued: rowMatch[2],
        cardHolder: rowMatch[3].trim(),
        result: rowMatch[4],
        assessmentReason: rowMatch[5]?.trim(),
        rawTextBlock: line,
      });
    }
  }

  if (entries.length === 0) {
    warnings.push({
      type: "no-records",
      severity: "info",
      message: "No safety net rows parsed (file recognised but no rows extracted)",
    });
  }
  return { entries, warnings, printDate };
}
