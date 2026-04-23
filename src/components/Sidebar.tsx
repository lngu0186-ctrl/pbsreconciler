import { useRef, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mono } from "@/components/Mono";
import {
  Upload,
  FileText,
  ShieldCheck,
  Wand2,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/types";

const TYPE_LABEL: Record<DocumentType, string> = {
  summary: "Summary report",
  advice: "Payment advice",
  safetyNet: "Safety Net",
  unknown: "Unknown",
};

function TypeIcon({ type }: { type: DocumentType }) {
  const cls = "h-3.5 w-3.5";
  if (type === "summary") return <FileText className={cn(cls, "text-info")} />;
  if (type === "advice") return <FileText className={cn(cls, "text-success")} />;
  if (type === "safetyNet") return <ShieldCheck className={cn(cls, "text-warning")} />;
  return <HelpCircle className={cn(cls, "text-destructive")} />;
}

function UploadZone({
  label,
  hint,
  onFiles,
  isProcessing,
}: {
  label: string;
  hint: string;
  onFiles: (files: File[]) => void;
  isProcessing: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      }}
      className={cn(
        "rounded-md border border-dashed bg-card px-3 py-3 transition-colors",
        drag ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <div className="text-xs font-semibold text-foreground">{label}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2 w-full"
        disabled={isProcessing}
        onClick={() => inputRef.current?.click()}
      >
        {isProcessing ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="mr-1.5 h-3.5 w-3.5" />
        )}
        Choose files
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,.pdf,.txt"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? [...e.target.files] : [];
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function Sidebar() {
  const files = useAppStore((s) => s.files);
  const isProcessing = useAppStore((s) => s.isProcessing);
  const uploadFiles = useAppStore((s) => s.uploadFiles);
  const loadDemo = useAppStore((s) => s.loadDemo);
  const clearAll = useAppStore((s) => s.clearAll);
  const recompute = useAppStore((s) => s.recompute);

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-border bg-secondary/40">
      <div className="space-y-3 p-3">
        <UploadZone
          label="Summary Reconciliation Report"
          hint="From Z Dispense / Z Dispensing Software"
          onFiles={uploadFiles}
          isProcessing={isProcessing}
        />
        <UploadZone
          label="PBS Payment Advice PDFs"
          hint="From Services Australia / Medicare"
          onFiles={uploadFiles}
          isProcessing={isProcessing}
        />
        <UploadZone
          label="Safety Net statements (optional)"
          hint="PBS Safety Net reconciliation"
          onFiles={uploadFiles}
          isProcessing={isProcessing}
        />
      </div>

      <div className="space-y-2 px-3 pb-3">
        <Button
          className="w-full bg-brand-navy text-brand-navy-foreground hover:bg-brand-navy/90"
          onClick={recompute}
          disabled={isProcessing}
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          Reconcile
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={loadDemo} disabled={isProcessing}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            Demo data
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} disabled={isProcessing}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto border-t border-border px-3 py-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Uploaded files ({files.length})
        </div>
        {files.length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
            No files yet. Upload reports above, or click Demo data.
          </div>
        )}
        <div className="space-y-2">
          {files.map((f) => (
            <Card key={f.id} className="border-border/60 p-2 shadow-none">
              <div className="flex items-start gap-2">
                <TypeIcon type={f.detectedType} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium" title={f.name}>
                    {f.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>{TYPE_LABEL[f.detectedType]}</span>
                    <span>·</span>
                    <span>{f.recordCount} rec</span>
                    {f.warnings.length > 0 && (
                      <span className="ml-auto inline-flex items-center text-warning">
                        <AlertTriangle className="mr-0.5 h-3 w-3" />
                        {f.warnings.length}
                      </span>
                    )}
                  </div>
                  {f.bankReferences && f.bankReferences.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {f.bankReferences.slice(0, 3).map((br) => (
                        <Mono key={br} className="rounded bg-muted px-1 py-0.5 text-[10px]">
                          {br}
                        </Mono>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </aside>
  );
}
