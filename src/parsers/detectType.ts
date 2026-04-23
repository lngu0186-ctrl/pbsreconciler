import type { DocumentType } from "@/types";

export function detectDocumentType(text: string): DocumentType {
  const t = text.toLowerCase();
  if (t.includes("pbs safety net") && t.includes("reconciliation statement")) {
    return "safetyNet";
  }
  if (
    t.includes("recipient created tax invoice") ||
    t.includes("pharmaceutical benefits scheme claims payment advice") ||
    t.includes("pbs claims payment advice") ||
    (t.includes("payment advice") && t.includes("pbs payment id"))
  ) {
    return "advice";
  }
  if (
    t.includes("summary reconciliation report") ||
    (t.includes("pbs payment id") && t.includes("rx trans") && t.includes("amt"))
  ) {
    return "summary";
  }
  return "unknown";
}
