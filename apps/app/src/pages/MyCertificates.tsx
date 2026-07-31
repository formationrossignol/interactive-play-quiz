import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { ExplorerEmptyState } from "@/components/content/ExplorerEmptyState";
import { ListSkeleton } from "@/components/ui/skeletons/ListSkeleton";
import { getCurrentUser } from "@/lib/auth";
import { listCertificates, type Certificate } from "@/lib/certificates";
import { createCertificatePdf } from "@/components/CourseCertificateDialog";
import { useSEO } from "@/hooks/useSEO";

const fileSlug = (value: string) => value
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/[^a-zA-Z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .toLowerCase() || "formation";

export default function MyCertificates() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  useSEO({ title: "Mes certificats", description: "Vos attestations de réussite obtenues sur Brivia." });

  useEffect(() => {
    if (!user) return;
    listCertificates(user.id)
      .then(setCertificates)
      .catch(() => setCertificates([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const download = async (certificate: Certificate) => {
    setDownloadingId(certificate.id);
    try {
      const blob = await createCertificatePdf({
        courseId: certificate.courseId,
        courseTitle: certificate.courseTitle,
        learnerName: certificate.learnerName,
        learnerId: user.id,
        totalLessons: certificate.totalLessons,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `attestation-${fileSlug(certificate.courseTitle)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Attestation téléchargée");
    } catch {
      toast.error("Impossible de générer l’attestation");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <AppLayout subtitle="Mes certificats">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div style={{ marginBottom: 25 }}>
          <h1 className="ap-h2" style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 26, marginBottom: 4 }}>
            <Award size={23} /> Mes certificats
          </h1>
          <p className="ap-muted" style={{ fontSize: 14 }}>Vos attestations de réussite, obtenues en terminant une formation à 100 %.</p>
        </div>

        <section className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 20 }}>
              <ListSkeleton rows={3} avatarClassName="rounded-lg" />
            </div>
          ) : certificates.length === 0 ? (
            <ExplorerEmptyState
              icon={<Award size={27} />}
              title="Aucun certificat pour l'instant"
              body="Terminez une formation jusqu'au bout pour obtenir votre première attestation."
            />
          ) : (
            certificates.map((certificate) => (
              <div
                key={certificate.id}
                className="ap-row group flex cursor-pointer items-center gap-4 px-5"
                style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)", paddingTop: 14, paddingBottom: 14 }}
                onClick={() => navigate(`/course/${certificate.courseId}`)}
              >
                <span
                  style={{ width: 40, height: 40, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "var(--ap-r-md)", background: "var(--ap-brand-soft)", color: "var(--ap-brand)" }}
                >
                  <Award size={18} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 14.5 }} className="truncate">{certificate.courseTitle}</strong>
                  <span className="ap-muted" style={{ fontSize: 12.5 }}>
                    {certificate.totalLessons} leçon{certificate.totalLessons > 1 ? "s" : ""} · Délivrée le {new Date(certificate.issuedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                <div className="ap-hover-actions flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn"
                    title="Télécharger l’attestation"
                    aria-label={`Télécharger l’attestation de ${certificate.courseTitle}`}
                    disabled={downloadingId === certificate.id}
                    onClick={() => void download(certificate)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn"
                    title="Ouvrir la formation"
                    aria-label={`Ouvrir la formation ${certificate.courseTitle}`}
                    onClick={() => navigate(`/course/${certificate.courseId}`)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </AppLayout>
  );
}
