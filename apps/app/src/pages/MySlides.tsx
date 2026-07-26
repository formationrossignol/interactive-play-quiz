import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { ContentExplorer } from "@/components/content/ContentExplorer";
import { GenericCard, GenericRow, type GenericItemConfig } from "@/components/content/GenericItem";
import { t } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { createContent } from "@/lib/content/contentRepo";
import { showError } from "@/lib/errorTaxonomy";
import { PresentationImportDialog } from "@/components/presentation-editor/import/PresentationImportDialog";

const config: GenericItemConfig = {
  accentBtn: "ap-btn--pres",
  editRoute: (id) => `/presentation-editor?id=${id}`,
  countOf: (d) => (d.data.slides as unknown[] | undefined)?.length ?? 0,
  countLabel: (n) => `${n} diapositive${n > 1 ? "s" : ""}`,
  play: {
    label: "Présenter",
    run: (d, navigate) => navigate(`/presentation-editor?id=${d.id}&present=1`),
  },
};

const MySlides = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [importOpen, setImportOpen] = useState(false);
  return (
    <>
      <ContentExplorer
        type="slide"
        accentBtn="ap-btn--pres"
        headerTitle={t("mySlides")}
        headerSubtitle={t("mySlidesSubtitle")}
        rootLabel="Toutes les présentations"
        oneLabel="présentation"
        cta={{ label: "Créer une présentation", onClick: () => navigate("/presentation-editor") }}
        headerExtras={(
          <button className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => setImportOpen(true)}>
            <Upload size={15} aria-hidden="true" />
            Importer
          </button>
        )}
        renderCard={(d, ctx) => <GenericCard d={d} ctx={ctx} config={config} navigate={navigate} />}
        renderRow={(d, ctx) => <GenericRow d={d} ctx={ctx} config={config} navigate={navigate} />}
      />
      <PresentationImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={async (presentation) => {
          if (!user) throw new Error("Connectez-vous pour importer une présentation.");
          try {
            const row = await createContent(user.id, "slide", presentation as unknown as Record<string, unknown>);
            toast.success(`${presentation.slides.length} diapositive${presentation.slides.length > 1 ? "s" : ""} importée${presentation.slides.length > 1 ? "s" : ""}`);
            navigate(`/presentation-editor?id=${row.id}`);
          } catch (error) {
            showError(error, "MySlides.import", "Impossible d’enregistrer la présentation importée.");
            throw error;
          }
        }}
      />
    </>
  );
};

export default MySlides;
