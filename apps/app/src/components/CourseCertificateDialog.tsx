import { useEffect, useMemo, useState } from "react";
import { Award, BadgeCheck, Copy, Download, Linkedin, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Course } from "@/lib/courseStorage";
import { certificateNumberFor } from "@/lib/certificates";

interface CourseCertificateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course;
  learnerName: string;
  learnerId: string;
  totalLessons: number;
}

const fileSlug = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .toLowerCase() || "formation";

const completionDate = () => new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(new Date());

export const createLinkedInPostDraft = (course: Course) => {
  const objectives = (course.objectives ?? []).slice(0, 3);
  const skills = objectives.length
    ? `\n\nCette formation m’a notamment permis de travailler :\n${objectives.map((objective) => `• ${objective}`).join("\n")}`
    : "\n\nCette formation m’a permis de consolider de nouvelles connaissances et de les mettre en pratique.";
  return `Je suis heureux·se de partager l’obtention de mon attestation pour la formation « ${course.title} » sur Brivia.${skills}\n\nUne nouvelle étape dans mon parcours d’apprentissage continu.\n\n#FormationContinue #Apprentissage #DeveloppementProfessionnel`;
};

export interface CertificatePdfParams {
  courseId: string;
  courseTitle: string;
  learnerName: string;
  learnerId: string;
  totalLessons: number;
}

export async function createCertificatePdf({
  courseId,
  courseTitle,
  learnerName,
  learnerId,
  totalLessons,
}: CertificatePdfParams) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const certificateId = certificateNumberFor(courseId, learnerId);

  pdf.setFillColor(255, 252, 247);
  pdf.rect(0, 0, width, height, "F");
  pdf.setDrawColor(67, 56, 202);
  pdf.setLineWidth(1.2);
  pdf.roundedRect(12, 12, width - 24, height - 24, 3, 3, "S");

  pdf.setTextColor(67, 56, 202);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("BRIVIA", width / 2, 32, { align: "center" });

  pdf.setTextColor(36, 27, 58);
  pdf.setFontSize(28);
  pdf.text("ATTESTATION DE REUSSITE", width / 2, 58, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(13);
  pdf.setTextColor(109, 98, 136);
  pdf.text("Cette attestation certifie que", width / 2, 76, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(36, 27, 58);
  pdf.text(learnerName, width / 2, 94, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(13);
  pdf.setTextColor(109, 98, 136);
  pdf.text("a termine avec succes la formation", width / 2, 110, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(67, 56, 202);
  const titleLines = pdf.splitTextToSize(courseTitle, 190) as string[];
  pdf.text(titleLines, width / 2, 126, { align: "center" });

  const metaY = 150 + Math.max(0, titleLines.length - 1) * 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(109, 98, 136);
  pdf.text(`${totalLessons} leçon${totalLessons > 1 ? "s" : ""} validée${totalLessons > 1 ? "s" : ""} · Délivrée le ${completionDate()}`, width / 2, metaY, { align: "center" });
  pdf.text(`Identifiant : ${certificateId}`, width / 2, metaY + 13, { align: "center" });

  return pdf.output("blob");
}

export function CourseCertificateDialog({
  open,
  onOpenChange,
  course,
  learnerName,
  learnerId,
  totalLessons,
}: CourseCertificateDialogProps) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const generatedDraft = useMemo(() => createLinkedInPostDraft(course), [course]);
  const [postDraft, setPostDraft] = useState(generatedDraft);
  const fileName = `attestation-${fileSlug(course.title)}.pdf`;

  useEffect(() => setPostDraft(generatedDraft), [generatedDraft]);

  const copyPost = async () => {
    try {
      await navigator.clipboard.writeText(postDraft);
      toast.success("Le brouillon LinkedIn est copié");
    } catch {
      toast.error("Impossible de copier le brouillon");
    }
  };

  const download = async () => {
    setBusy("download");
    try {
      const blob = await createCertificatePdf({ courseId: course.id, courseTitle: course.title, learnerName, learnerId, totalLessons });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Attestation téléchargée");
    } catch {
      toast.error("Impossible de générer l’attestation");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    try {
      const blob = await createCertificatePdf({ courseId: course.id, courseTitle: course.title, learnerName, learnerId, totalLessons });
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Attestation — ${course.title}`,
          text: postDraft,
          files: [file],
        });
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      try {
        await navigator.clipboard.writeText(postDraft);
        toast.success("Attestation téléchargée et texte de partage copié");
      } catch {
        toast.success("Attestation téléchargée");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Le partage n’a pas pu être ouvert");
    } finally {
      setBusy(null);
    }
  };

  const openLinkedIn = async () => {
    await copyPost();
    window.open("https://www.linkedin.com/feed/", "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" style={{ borderRadius: "var(--ap-r-lg)", background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)" }}>
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--ap-font-display)" }}>
            <BadgeCheck size={22} color="var(--ap-brand)" />
            Votre attestation est prête
          </DialogTitle>
          <DialogDescription>
            Téléchargez le PDF, partagez-le depuis votre appareil ou préparez votre publication LinkedIn.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1.05fr_.95fr]">
          <div
            style={{
              minHeight: 300,
              padding: "30px 28px",
              border: "var(--ap-border-w) solid var(--ap-brand)",
              borderRadius: "var(--ap-r-md)",
              background: "linear-gradient(135deg, var(--ap-card), var(--ap-brand-soft))",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Award size={38} style={{ margin: "0 auto 16px", color: "var(--ap-brand)" }} />
            <span style={{ color: "var(--ap-brand)", fontSize: 12, fontWeight: 900, letterSpacing: ".14em" }}>ATTESTATION DE RÉUSSITE</span>
            <p className="ap-muted" style={{ margin: "18px 0 5px", fontSize: 13 }}>Décernée à</p>
            <strong style={{ fontFamily: "var(--ap-font-display)", fontSize: 24 }}>{learnerName}</strong>
            <p className="ap-muted" style={{ margin: "18px 0 6px", fontSize: 13 }}>pour avoir terminé</p>
            <strong style={{ color: "var(--ap-brand)", fontSize: 18 }}>{course.title}</strong>
            <span className="ap-muted" style={{ marginTop: 18, fontSize: 12 }}>{completionDate()} · {totalLessons} leçon{totalLessons > 1 ? "s" : ""}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 900, color: "var(--ap-muted)" }}>
              Squelette de post LinkedIn
              <textarea
                value={postDraft}
                onChange={(event) => setPostDraft(event.target.value)}
                style={{
                  minHeight: 190,
                  resize: "vertical",
                  padding: 12,
                  borderRadius: "var(--ap-r-sm)",
                  border: "var(--ap-border-w) solid var(--ap-line)",
                  background: "var(--ap-paper)",
                  color: "var(--ap-ink)",
                  fontFamily: "var(--ap-font-body)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={() => void copyPost()}>
                <Copy size={15} /> Copier le post
              </button>
              <button type="button" className="ap-btn ap-btn--sm" onClick={() => void openLinkedIn()}>
                <Linkedin size={15} /> Ouvrir LinkedIn
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" disabled={busy !== null} onClick={() => void download()}>
                <Download size={15} /> {busy === "download" ? "Génération…" : "Télécharger"}
              </button>
              <button type="button" className="ap-btn ap-btn--sm" disabled={busy !== null} onClick={() => void share()}>
                <Share2 size={15} /> {busy === "share" ? "Préparation…" : "Partager"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
