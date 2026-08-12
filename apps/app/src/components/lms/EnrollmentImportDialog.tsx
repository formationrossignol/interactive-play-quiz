import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showError } from "@/lib/errorTaxonomy";
import {
  enrollInSession,
  listSessionEnrollments,
  resolveOrgMembersByIdentifier,
} from "@/lib/lms/enrollment";
import {
  buildEnrollmentPreview,
  extractIdentifierColumn,
  importableEnrollmentRows,
  parseSpreadsheetRows,
  type EnrollmentPreviewRow,
} from "@/lib/lms/enrollmentImport";

const inputClass = "h-9 w-full rounded-md border bg-transparent px-2 text-sm";
const inputStyle = { borderColor: "var(--ap-line)", color: "var(--ap-ink)" };

const STATUS_LABEL: Record<EnrollmentPreviewRow["status"], string> = {
  ok: "OK",
  unmatched: "Identifiant introuvable dans cette organisation",
  duplicate: "Doublon — première occurrence déjà retenue",
  already_enrolled: "Déjà inscrit·e (sera confirmé, pas dupliqué)",
};

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

interface EnrollmentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  sessionId: string;
  onImported: () => void;
}

export function EnrollmentImportDialog({ open, onOpenChange, orgId, sessionId, onImported }: EnrollmentImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [identifierCol, setIdentifierCol] = useState(0);
  const [kind, setKind] = useState<"email" | "username">("email");
  const [parsing, setParsing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [preview, setPreview] = useState<EnrollmentPreviewRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<number, "active" | "waitlisted" | "error"> | null>(null);

  const headers = rawRows[0] ?? [];
  const validRows = useMemo(() => (preview ? importableEnrollmentRows(preview) : []), [preview]);
  const errorCount = preview ? preview.length - validRows.length : 0;

  const reset = () => {
    setFileName(""); setRawRows([]); setIdentifierCol(0); setKind("email");
    setPreview(null); setOutcomes(null);
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const rows = await parseSpreadsheetRows(file);
      if (rows.length < 2) {
        toast.error("Fichier vide ou sans ligne de données.");
        return;
      }
      setFileName(file.name);
      setRawRows(rows);
      setIdentifierCol(0);
      setPreview(null);
      setOutcomes(null);
    } catch (err) {
      showError(err, "EnrollmentImportDialog.parse", "Impossible de lire ce fichier.");
    } finally {
      setParsing(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const identifiers = [...new Set(extractIdentifierColumn(rawRows, identifierCol))];
      const [resolved, existing] = await Promise.all([
        resolveOrgMembersByIdentifier(orgId, kind, identifiers),
        listSessionEnrollments(sessionId),
      ]);
      const alreadyEnrolled = new Set(existing.filter((e) => e.status === "active").map((e) => e.learner_id));
      setPreview(buildEnrollmentPreview(rawRows, identifierCol, resolved, alreadyEnrolled));
      setOutcomes(null);
    } catch (err) {
      showError(err, "EnrollmentImportDialog.resolve", "La correspondance a échoué.");
    } finally {
      setResolving(false);
    }
  };

  const handleImport = async () => {
    if (!preview || validRows.length === 0) return;
    setImporting(true);
    const nextOutcomes: Record<number, "active" | "waitlisted" | "error"> = {};
    try {
      for (const row of preview) {
        if (row.status !== "ok" && row.status !== "already_enrolled") continue;
        if (!row.learnerId) continue;
        try {
          const enrollment = await enrollInSession(sessionId, row.learnerId, "import");
          nextOutcomes[row.rowIndex] = enrollment.status === "waitlisted" ? "waitlisted" : "active";
        } catch {
          nextOutcomes[row.rowIndex] = "error";
        }
      }
      setOutcomes(nextOutcomes);
      const successCount = Object.values(nextOutcomes).filter((o) => o !== "error").length;
      toast.success(`${successCount} apprenant${successCount !== 1 ? "s" : ""} inscrit${successCount !== 1 ? "s" : ""}`);
      onImported();
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadReport = () => {
    if (!preview) return;
    const rows = preview.map((row) => [
      row.rawIdentifier,
      row.matchedLabel ?? "",
      STATUS_LABEL[row.status],
      outcomes?.[row.rowIndex] ?? "",
    ]);
    const csv = [["Identifiant", "Apprenant", "Statut", "Résultat import"], ...rows]
      .map((r) => r.map(csvCell).join(";")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rapport-import-inscriptions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" style={{ background: "var(--ap-card)", color: "var(--ap-ink)", borderColor: "var(--ap-line)" }}>
        <DialogHeader>
          <DialogTitle>Importer des apprenants (CSV/XLSX)</DialogTitle>
          <DialogDescription>
            Colonne identifiant (email ou nom d'utilisateur). Seules les personnes déjà membres de cette organisation peuvent être inscrites.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.ods"
            className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(file); e.target.value = ""; }}
          />
          <Button variant="outline" size="sm" loading={parsing} onClick={() => fileInputRef.current?.click()}>
            <Upload /> {fileName || "Choisir un fichier CSV/XLSX"}
          </Button>

          {headers.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                <span className="ap-muted mb-1 block">Colonne identifiant</span>
                <select className={inputClass} style={inputStyle} value={identifierCol} onChange={(e) => { setIdentifierCol(Number(e.target.value)); setPreview(null); }}>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>)}
                </select>
              </label>
              <label className="text-xs">
                <span className="ap-muted mb-1 block">Type d'identifiant</span>
                <select className={inputClass} style={inputStyle} value={kind} onChange={(e) => { setKind(e.target.value as "email" | "username"); setPreview(null); }}>
                  <option value="email">Email</option>
                  <option value="username">Nom d'utilisateur</option>
                </select>
              </label>
            </div>
          )}

          {headers.length > 0 && !preview && (
            <Button size="sm" loading={resolving} onClick={() => void handleResolve()}>Prévisualiser</Button>
          )}

          {preview && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1" style={{ color: "var(--ap-pres)" }}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> {validRows.length} valide{validRows.length !== 1 ? "s" : ""}
                </span>
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1" style={{ color: "var(--ap-danger)" }}>
                    <TriangleAlert className="h-3.5 w-3.5" /> {errorCount} en erreur
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={handleDownloadReport}><Download size={14} /> Rapport</Button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border" style={{ borderColor: "var(--ap-line)" }}>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr style={{ background: "var(--ap-paper-2)" }}>
                      {["Identifiant", "Apprenant", "Statut", "Résultat"].map((h) => (
                        <th key={h} className="border-b px-2 py-1.5 text-left font-bold" style={{ borderColor: "var(--ap-line)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.rowIndex} style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
                        <td className="px-2 py-1.5">{row.rawIdentifier}</td>
                        <td className="px-2 py-1.5">{row.matchedLabel ?? "—"}</td>
                        <td className="px-2 py-1.5" style={{ color: row.status === "ok" ? "var(--ap-pres)" : row.status === "already_enrolled" ? "var(--ap-muted)" : "var(--ap-danger)" }}>
                          {STATUS_LABEL[row.status]}
                        </td>
                        <td className="px-2 py-1.5">{outcomes?.[row.rowIndex] ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false); }}>Fermer</Button>
            {preview && (
              <Button size="sm" disabled={validRows.length === 0} loading={importing} onClick={() => void handleImport()}>
                Inscrire {validRows.length > 0 ? `${validRows.length} apprenant${validRows.length !== 1 ? "s" : ""}` : ""}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
