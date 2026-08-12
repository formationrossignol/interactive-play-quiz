import { useMemo, useRef, useState } from "react";
import { CheckCircle2, TriangleAlert, Upload } from "lucide-react";
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
import { importGradebookCsv } from "@/lib/lms/gradebook";
import {
  buildImportPreview,
  parseSpreadsheetRows,
  validImportRows,
  type ImportPreviewRow,
  type RosterMatchEntry,
} from "@/lib/lms/gradebookImport";

const inputClass = "h-9 w-full rounded-md border bg-transparent px-2 text-sm";
const inputStyle = { borderColor: "var(--ap-line)", color: "var(--ap-ink)" };

const STATUS_LABEL: Record<ImportPreviewRow["status"], string> = {
  ok: "OK",
  unmatched: "Apprenant introuvable dans cette session",
  duplicate: "Doublon — première occurrence déjà retenue",
  invalid_points: "Note hors barème ou illisible",
};

interface GradebookImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  sessionId: string;
  roster: RosterMatchEntry[];
  onImported: () => void;
}

export function GradebookImportDialog({ open, onOpenChange, orgId, sessionId, roster, onImported }: GradebookImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [identifierCol, setIdentifierCol] = useState(0);
  const [pointsCol, setPointsCol] = useState(1);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Import");
  const [weight, setWeight] = useState("1");
  const [maxPoints, setMaxPoints] = useState("20");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const headers = rawRows[0] ?? [];
  const maxPointsNumber = Number(maxPoints.replace(",", ".")) || 0;

  const preview = useMemo(
    () => (rawRows.length > 1 ? buildImportPreview(rawRows, identifierCol, pointsCol, roster, maxPointsNumber) : []),
    [rawRows, identifierCol, pointsCol, roster, maxPointsNumber],
  );
  const validRows = useMemo(() => validImportRows(preview), [preview]);
  const errorCount = preview.length - validRows.length;

  const reset = () => {
    setFileName("");
    setRawRows([]);
    setIdentifierCol(0);
    setPointsCol(1);
    setTitle("");
    setCategory("Import");
    setWeight("1");
    setMaxPoints("20");
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
      setPointsCol(rows[0].length > 1 ? 1 : 0);
      if (!title) setTitle(file.name.replace(/\.(csv|xlsx?|ods)$/i, ""));
    } catch (err) {
      showError(err, "GradebookImportDialog.parse", "Impossible de lire ce fichier.");
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      await importGradebookCsv({
        orgId, sessionId,
        title: title.trim() || "Import",
        category: category.trim() || "Import",
        weight: Number(weight.replace(",", ".")) || 1,
        maxPoints: maxPointsNumber,
        rows: validRows,
      });
      toast.success(`${validRows.length} note${validRows.length !== 1 ? "s" : ""} importée${validRows.length !== 1 ? "s" : ""}`);
      reset();
      onOpenChange(false);
      onImported();
    } catch (err) {
      showError(err, "GradebookImportDialog.import", "L'import a échoué.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" style={{ background: "var(--ap-card)", color: "var(--ap-ink)", borderColor: "var(--ap-line)" }}>
        <DialogHeader>
          <DialogTitle>Importer des notes (CSV/XLSX)</DialogTitle>
          <DialogDescription>
            Crée une nouvelle colonne de notes pour cette session à partir d'un fichier. Colonnes attendues : identifiant (nom d'utilisateur) et note.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="ap-muted mb-1 block">Titre de la colonne</span>
              <input className={inputClass} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Contrôle continu" />
            </label>
            <label className="text-xs">
              <span className="ap-muted mb-1 block">Catégorie</span>
              <input className={inputClass} style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)} />
            </label>
            <label className="text-xs">
              <span className="ap-muted mb-1 block">Coefficient</span>
              <input className={inputClass} style={inputStyle} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
            <label className="text-xs">
              <span className="ap-muted mb-1 block">Barème (note sur)</span>
              <input className={inputClass} style={inputStyle} inputMode="decimal" value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} />
            </label>
          </div>

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

          {headers.length > 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                <span className="ap-muted mb-1 block">Colonne identifiant</span>
                <select className={inputClass} style={inputStyle} value={identifierCol} onChange={(e) => setIdentifierCol(Number(e.target.value))}>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>)}
                </select>
              </label>
              <label className="text-xs">
                <span className="ap-muted mb-1 block">Colonne note</span>
                <select className={inputClass} style={inputStyle} value={pointsCol} onChange={(e) => setPointsCol(Number(e.target.value))}>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>)}
                </select>
              </label>
            </div>
          )}

          {preview.length > 0 && (
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
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border" style={{ borderColor: "var(--ap-line)" }}>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr style={{ background: "var(--ap-paper-2)" }}>
                      {["Identifiant", "Note", "Apprenant", "Statut"].map((h) => (
                        <th key={h} className="border-b px-2 py-1.5 text-left font-bold" style={{ borderColor: "var(--ap-line)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.rowIndex} style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
                        <td className="px-2 py-1.5">{row.rawIdentifier}</td>
                        <td className="px-2 py-1.5">{row.rawPoints}</td>
                        <td className="px-2 py-1.5">{row.matchedLabel ?? "—"}</td>
                        <td className="px-2 py-1.5" style={{ color: row.status === "ok" ? "var(--ap-pres)" : "var(--ap-danger)" }}>
                          {STATUS_LABEL[row.status]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); onOpenChange(false); }}>Annuler</Button>
            <Button size="sm" disabled={validRows.length === 0 || !title.trim()} loading={importing} onClick={() => void handleImport()}>
              Importer {validRows.length > 0 ? `${validRows.length} note${validRows.length !== 1 ? "s" : ""}` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
