import * as pdfjsLib from "pdfjs-dist";
// @ts-expect-error -- worker URL import
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group items into lines based on y-coordinate
    type Item = { str: string; x: number; y: number };
    const items: Item[] = (content.items as Array<{ str: string; transform: number[] }>)
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: Math.round(it.transform[5]),
      }))
      .filter((it) => it.str && it.str.trim());

    const byY = new Map<number, Item[]>();
    for (const it of items) {
      const key = it.y;
      if (!byY.has(key)) byY.set(key, []);
      byY.get(key)!.push(it);
    }
    const sortedYs = [...byY.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const row = byY.get(y)!.sort((a, b) => a.x - b.x);
      lines.push(row.map((r) => r.str).join("  "));
    }
    lines.push(""); // page break
  }
  return lines.join("\n");
}

export async function extractTextFromAny(file: File): Promise<string> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return extractPdfText(file);
  }
  // Treat as text
  return await file.text();
}
