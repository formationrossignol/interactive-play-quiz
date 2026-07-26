import { useState } from "react";
import { ChevronDown, Download, FileArchive, FileImage, FileText, LoaderCircle, Presentation, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Presentation as PresentationDocument } from "../types/presentation";
import { exportPresentation, type PresentationExportFormat } from "./presentationExport";

const FORMATS: { id: PresentationExportFormat; label: string; Icon: LucideIcon; separated?: boolean }[] = [
  { id: "pptx", label: "Microsoft PowerPoint (.pptx)", Icon: Presentation },
  { id: "odp", label: "Document ODP (.odp)", Icon: Presentation },
  { id: "pdf", label: "Document PDF (.pdf)", Icon: FileText },
  { id: "txt", label: "Texte brut (.txt)", Icon: FileText },
  { id: "jpg", label: "Image JPEG (.jpg, diapositive actuelle)", Icon: FileImage, separated: true },
  { id: "png", label: "Image PNG (.png, diapositive actuelle)", Icon: FileImage },
  { id: "svg", label: "Scalable Vector Graphics (.svg, diapositive active)", Icon: FileImage },
  { id: "json", label: "Document Brivia (.json)", Icon: FileArchive, separated: true },
];

export function PresentationExportMenu({ presentation, activeSlideId }: { presentation: PresentationDocument; activeSlideId: string }) {
  const [busy, setBusy] = useState(false);

  async function run(format: PresentationExportFormat) {
    if (busy) return;
    setBusy(true);
    try {
      await exportPresentation(presentation, activeSlideId, format);
      toast.success("Export prêt.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L’export a échoué.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ap-btn ap-btn--sm ap-btn--ghost" disabled={busy}>
          {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} aria-hidden="true" />}
          Exporter
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ minWidth: 360, padding: 7, background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)", boxShadow: "var(--ap-shadow-card)" }}>
        {FORMATS.map(({ id, label, Icon, separated }) => (
          <div key={id}>
            {separated && <DropdownMenuSeparator />}
            <DropdownMenuItem className="flex items-center gap-3 cursor-pointer rounded-lg py-2.5 text-sm" onSelect={() => void run(id)}>
              <Icon size={17} style={{ color: "var(--ap-muted)" }} />
              {label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
