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
  const { jsPDF, GState } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const cx = width / 2;
  const certificateId = certificateNumberFor(courseId, learnerId);

  const INK = [32, 24, 54] as const;
  const INDIGO = [67, 56, 202] as const;
  const MUTED = [109, 98, 136] as const;
  const GOLD = [176, 141, 87] as const;
  const CREAM = [255, 252, 247] as const;

  const setDraw = (c: readonly [number, number, number]) => pdf.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: readonly [number, number, number]) => pdf.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: readonly [number, number, number]) => pdf.setFillColor(c[0], c[1], c[2]);

  const diamond = (x: number, y: number, w: number, h: number) => {
    pdf.triangle(x - w, y, x, y - h, x + w, y, "F");
    pdf.triangle(x - w, y, x, y + h, x + w, y, "F");
  };

  // Background
  setFill(CREAM);
  pdf.rect(0, 0, width, height, "F");

  // Faint diagonal watermark for a security-document feel
  pdf.setGState(new GState({ opacity: 0.028 }));
  pdf.setFont("times", "bold");
  pdf.setFontSize(78);
  setText(INDIGO);
  pdf.text("BRIVIA", cx, height / 2 + 22, { align: "center", angle: 28 });
  pdf.setGState(new GState({ opacity: 1 }));

  // Double frame: gold outer, indigo inner
  setDraw(GOLD);
  pdf.setLineWidth(0.5);
  pdf.rect(9, 9, width - 18, height - 18, "S");
  setDraw(INDIGO);
  pdf.setLineWidth(0.3);
  pdf.rect(12.5, 12.5, width - 25, height - 25, "S");

  // Gold corner ornaments on the inner frame
  setFill(GOLD);
  [
    [12.5, 12.5],
    [width - 12.5, 12.5],
    [12.5, height - 12.5],
    [width - 12.5, height - 12.5],
  ].forEach(([x, y]) => diamond(x, y, 2.1, 2.9));

  // Emblem medallion
  const emblemY = 30;
  setDraw(GOLD);
  pdf.setLineWidth(0.5);
  pdf.circle(cx, emblemY, 8.4, "S");
  pdf.setLineWidth(0.25);
  pdf.circle(cx, emblemY, 6.6, "S");
  pdf.setFont("times", "bolditalic");
  pdf.setFontSize(15);
  setText(INDIGO);
  pdf.text("B", cx, emblemY + 3.3, { align: "center" });

  // Wordmark flanked by thin gold rules
  const wmY = 46;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  setText(GOLD);
  pdf.text("B R I V I A", cx, wmY, { align: "center" });
  setDraw(GOLD);
  pdf.setLineWidth(0.25);
  pdf.line(cx - 42, wmY - 1.4, cx - 20, wmY - 1.4);
  pdf.line(cx + 20, wmY - 1.4, cx + 42, wmY - 1.4);

  // Title
  pdf.setFont("times", "bold");
  pdf.setFontSize(30);
  setText(INK);
  pdf.text("ATTESTATION DE RÉUSSITE", cx, 65, { align: "center" });

  // Ornamental divider: line – diamond – line
  const dividerY = 73;
  setDraw(GOLD);
  pdf.setLineWidth(0.35);
  pdf.line(cx - 26, dividerY, cx - 5, dividerY);
  pdf.line(cx + 5, dividerY, cx + 26, dividerY);
  diamond(cx, dividerY, 1.6, 2.2);

  pdf.setFont("times", "italic");
  pdf.setFontSize(13);
  setText(MUTED);
  pdf.text("Cette attestation certifie que", cx, 86, { align: "center" });

  // Learner name with a gold underline sized to the text
  pdf.setFont("times", "bold");
  pdf.setFontSize(27);
  setText(INK);
  pdf.text(learnerName, cx, 104, { align: "center" });
  const nameWidth = pdf.getTextWidth(learnerName);
  setDraw(GOLD);
  pdf.setLineWidth(0.4);
  pdf.line(cx - nameWidth / 2 - 6, 108, cx + nameWidth / 2 + 6, 108);

  pdf.setFont("times", "italic");
  pdf.setFontSize(13);
  setText(MUTED);
  pdf.text("a terminé avec succès la formation", cx, 119, { align: "center" });

  pdf.setFont("times", "bold");
  pdf.setFontSize(20);
  setText(INDIGO);
  const titleLines = pdf.splitTextToSize(courseTitle, 190) as string[];
  pdf.text(titleLines, cx, 133, { align: "center" });

  // Closing ornament, positioned to balance the space below the (variable-height) title
  const closingY = 133 + Math.max(0, titleLines.length - 1) * 8 + 20;
  setDraw(GOLD);
  pdf.setLineWidth(0.3);
  pdf.line(cx - 30, closingY, cx - 6, closingY);
  pdf.line(cx + 6, closingY, cx + 30, closingY);
  diamond(cx, closingY, 1.4, 1.9);

  // Footer: signature block · seal · certificate reference
  const footerRuleY = height - 40;
  setDraw(GOLD);
  pdf.setLineWidth(0.25);
  pdf.line(30, footerRuleY, width - 30, footerRuleY);

  const footerY = footerRuleY + 14;

  // Left — signature line
  pdf.setDrawColor(INDIGO[0], INDIGO[1], INDIGO[2]);
  pdf.setLineWidth(0.3);
  pdf.line(28, footerY, 78, footerY);
  pdf.setFont("times", "italic");
  pdf.setFontSize(9.5);
  setText(MUTED);
  pdf.text("Direction de la formation", 28, footerY + 5);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  setText(INDIGO);
  pdf.text("BRIVIA", 28, footerY + 9.5);

  // Center — wax-seal medallion with checkmark
  const sealY = footerRuleY + 8.5;
  setDraw(GOLD);
  pdf.setLineWidth(0.5);
  pdf.circle(cx, sealY, 7.6, "S");
  pdf.setLineWidth(0.25);
  pdf.circle(cx, sealY, 6, "S");
  setDraw(INDIGO);
  pdf.setLineWidth(1.1);
  pdf.lines([[2.6, 2.8], [5, -6]], cx - 3, sealY + 0.3, [1, 1], "S");
  setFill(GOLD);
  pdf.triangle(cx - 3.6, sealY + 6.2, cx - 0.6, sealY + 6.2, cx - 2.1, sealY + 11.5, "F");
  pdf.triangle(cx + 0.6, sealY + 6.2, cx + 3.6, sealY + 6.2, cx + 2.1, sealY + 11.5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  setText(GOLD);
  pdf.text("AUTHENTIFIÉ", cx, footerY + 9.5, { align: "center" });

  // Right — reference details
  pdf.setFont("times", "normal");
  pdf.setFontSize(9.5);
  setText(MUTED);
  pdf.text(
    `${totalLessons} leçon${totalLessons > 1 ? "s" : ""} validée${totalLessons > 1 ? "s" : ""} · Délivrée le ${completionDate()}`,
    width - 28,
    footerY,
    { align: "right" },
  );
  pdf.setFont("courier", "normal");
  pdf.setFontSize(8.5);
  setText(GOLD);
  pdf.text(`N° ${certificateId}`, width - 28, footerY + 5, { align: "right" });

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
