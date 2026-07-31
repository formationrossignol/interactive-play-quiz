import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, BookOpen, CalendarDays, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/page-header";
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

  const distinctCourses = new Set(certificates.map((certificate) => certificate.courseId)).size;
  const latestCertificate = certificates[0];

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
      <div className="product-page product-page--medium">
        <PageHeader
          title="Mes certificats"
          description="Retrouvez et téléchargez les attestations obtenues à la fin de vos formations."
        />

        {!loading && certificates.length > 0 && (
          <div className="product-metric-grid product-certificate-metrics">
            <CertificateMetric icon={Award} value={String(certificates.length)} label="Attestations" />
            <CertificateMetric icon={BookOpen} value={String(distinctCourses)} label="Formations certifiées" />
            <CertificateMetric
              icon={CalendarDays}
              value={latestCertificate ? new Date(latestCertificate.issuedAt).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "-"}
              label="Dernière obtention"
            />
          </div>
        )}

        <section className="product-panel product-certificate-panel">
          <div className="product-panel-heading">
            <div>
              <h2>Bibliothèque de certificats</h2>
              <p>Chaque document est généré à la demande au format PDF.</p>
            </div>
          </div>
          {loading ? (
            <div className="product-certificate-loading">
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
                className="product-certificate-item group"
                onClick={() => navigate(`/course/${certificate.courseId}`)}
              >
                <span className="product-certificate-item__icon">
                  <Award size={18} />
                </span>
                <div className="product-certificate-item__copy">
                  <strong className="truncate">{certificate.courseTitle}</strong>
                  <span>
                    {certificate.totalLessons} leçon{certificate.totalLessons > 1 ? "s" : ""}. Délivrée le {new Date(certificate.issuedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
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

function CertificateMetric({ icon: Icon, value, label }: { icon: typeof Award; value: string; label: string }) {
  return (
    <div className="product-metric">
      <span className="product-metric__icon"><Icon aria-hidden="true" /></span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}
