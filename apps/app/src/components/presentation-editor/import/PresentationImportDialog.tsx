import { useRef, useState } from "react";
import { FileUp, Link2, LoaderCircle, Presentation, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { importGoogleSlidesPresentation, importPresentationFile } from "./presentationImport";
import type { Presentation as PresentationDocument } from "../types/presentation";
import { ButtonShimmerLabel } from "@/components/ui/skeleton";

interface ImportProgressState {
  message: string;
  current?: number;
  total?: number;
}

export function PresentationImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (presentation: PresentationDocument) => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"file" | "google">("file");
  const [googleUrl, setGoogleUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<ImportProgressState | null>(null);
  const [error, setError] = useState("");
  const busy = progress !== null;

  async function run(task: () => Promise<PresentationDocument>) {
    setError("");
    try {
      const presentation = await task();
      setProgress((current) => ({ ...(current ?? {}), message: "Finalisation de l’import…" }));
      await onImport(presentation);
      onOpenChange(false);
      setGoogleUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L’import a échoué.");
    } finally {
      setProgress(null);
    }
  }

  function handleFile(file?: File) {
    if (!file || busy) return;
    setProgress({ message: "Préparation du fichier…" });
    void run(() => importPresentationFile(file, (message, current, total) => setProgress({ message, current, total })));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Importer une présentation</DialogTitle>
          <DialogDescription>
            Convertissez un Google Slides, un PowerPoint ou un PDF en diapositives Brivia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setTab("file")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${tab === "file" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            <FileUp className="h-4 w-4" /> PPTX ou PDF
          </button>
          <button
            type="button"
            onClick={() => setTab("google")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${tab === "google" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            <Presentation className="h-4 w-4" /> Google Slides
          </button>
        </div>

        {tab === "file" ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="Choisir un fichier PowerPoint ou PDF"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              handleFile(event.dataTransfer.files[0]);
            }}
            style={{
              minHeight: 230,
              display: "grid",
              placeItems: "center",
              padding: 28,
              border: `2px dashed ${dragging ? "var(--ap-brand)" : "var(--ap-line-2)"}`,
              borderRadius: "var(--ap-r-lg)",
              background: dragging ? "var(--ap-brand-soft)" : "var(--ap-paper-2)",
              cursor: busy ? "wait" : "pointer",
              textAlign: "center",
            }}
          >
            <div>
              <span style={{ width: 54, height: 54, display: "grid", placeItems: "center", margin: "0 auto 14px", borderRadius: "var(--ap-r-md)", background: "var(--ap-pres-soft)", color: "var(--ap-pres-deep)" }}>
                {busy ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              </span>
              <b style={{ display: "block", fontSize: 16 }}>{progress?.message || "Déposez votre fichier ici"}</b>
              <span style={{ display: "block", marginTop: 6, color: "var(--ap-muted)", fontSize: 13 }}>
                PowerPoint .pptx ou document .pdf · 50 Mo max
              </span>
            </div>
            <input ref={inputRef} hidden type="file" accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.target.value = "";
            }} />
          </div>
        ) : (
          <div style={{ padding: "22px 0 4px" }}>
            <label htmlFor="google-slides-import-url" style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--ap-muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              Lien Google Slides
            </label>
            <div style={{ display: "flex", gap: 9, marginTop: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Link2 className="h-4 w-4" style={{ position: "absolute", left: 12, top: 13, color: "var(--ap-muted)" }} />
                <input
                  id="google-slides-import-url"
                  value={googleUrl}
                  onChange={(event) => setGoogleUrl(event.target.value)}
                  placeholder="https://docs.google.com/presentation/d/…"
                  disabled={busy}
                  style={{ width: "100%", height: 42, padding: "0 12px 0 38px", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", background: "var(--ap-card)", fontSize: 13 }}
                />
              </div>
              <button
                type="button"
                className="ap-btn ap-btn--pill ap-btn--sm"
                disabled={!googleUrl.trim() || busy}
                aria-busy={busy || undefined}
                onClick={() => void run(() => importGoogleSlidesPresentation(googleUrl, (message, current, total) => setProgress({ message, current, total })))}
              >
                <ButtonShimmerLabel loading={busy}>Importer</ButtonShimmerLabel>
              </button>
            </div>
            <p style={{ margin: "12px 0 0", padding: 12, borderRadius: "var(--ap-r-md)", background: "var(--ap-brand-soft)", color: "var(--ap-brand-deep)", fontSize: 12.5, fontWeight: 650, lineHeight: 1.45 }}>
              Le lien doit être accessible aux personnes qui le possèdent. Pour un document privé, téléchargez-le depuis Google Slides au format PPTX ou PDF.
            </p>
            {progress && <p style={{ marginTop: 14, fontSize: 13, fontWeight: 800 }}>{progress.message}</p>}
          </div>
        )}

        {progress && (
          <div style={{ display: "grid", gap: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, fontWeight: 800 }}>
              <span>{progress.message}</span>
              {progress.current != null && progress.total != null && (
                <span style={{ color: "var(--ap-brand)", whiteSpace: "nowrap" }}>
                  Slide {progress.current} / {progress.total} importées
                </span>
              )}
            </div>
            <div
              role="progressbar"
              aria-label="Progression de l’import"
              aria-valuemin={0}
              aria-valuemax={progress.total ?? 100}
              aria-valuenow={progress.current ?? undefined}
              style={{ height: 9, overflow: "hidden", borderRadius: "var(--ap-r-sm)", background: "var(--ap-line)" }}
            >
              <div
                style={{
                  width: progress.current != null && progress.total ? `${Math.round(progress.current / progress.total * 100)}%` : "32%",
                  height: "100%",
                  borderRadius: "var(--ap-r-sm)",
                  background: "linear-gradient(90deg, var(--ap-brand), var(--ap-pres))",
                  transition: "width .2s ease",
                  animation: progress.current == null ? "ap-import-progress 1.2s ease-in-out infinite alternate" : undefined,
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "var(--ap-danger-soft)", color: "var(--ap-danger-deep)", fontSize: 13, fontWeight: 750 }}>
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
