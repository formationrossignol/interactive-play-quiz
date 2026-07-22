import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ContentExplorer } from "@/components/content/ContentExplorer";
import { GenericCard, GenericRow, type GenericItemConfig } from "@/components/content/GenericItem";
import type { ContentDisplay } from "@/lib/content/contentView";
import type { SavedQuiz } from "@/lib/quizStorage";
import { t } from "@/lib/i18n";

const idOf = (d: ContentDisplay) => String((d.data.id as string | undefined) ?? "");

const config: GenericItemConfig = {
  accentBtn: "ap-btn--pres",
  editRoute: (id) => `/builder?type=slide&quizId=${id}`,
  countOf: (d) => (d.data.questions as unknown[] | undefined)?.length ?? 0,
  countLabel: (n) => `${n} diapositive${n > 1 ? "s" : ""}`,
  play: {
    label: "Présenter",
    run: (d, navigate) => {
      const id = idOf(d);
      if (!id) { toast.error("Présentation introuvable"); return; }
      localStorage.setItem(`slide-${id}`, JSON.stringify(d.data as unknown as SavedQuiz));
      navigate(`/quiz/${id}`);
    },
  },
};

const MySlides = () => {
  const navigate = useNavigate();
  return (
    <ContentExplorer
      type="slide"
      accentBtn="ap-btn--pres"
      headerTitle={t("mySlides")}
      headerSubtitle={t("mySlidesSubtitle")}
      rootLabel="Toutes les présentations"
      oneLabel="présentation"
      cta={{ label: "Créer une présentation", onClick: () => navigate("/builder-start?type=slide") }}
      renderCard={(d, ctx) => <GenericCard d={d} ctx={ctx} config={config} navigate={navigate} />}
      renderRow={(d, ctx) => <GenericRow d={d} ctx={ctx} config={config} navigate={navigate} />}
    />
  );
};

export default MySlides;
