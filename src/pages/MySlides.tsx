import { useNavigate } from "react-router-dom";
import { ContentExplorer } from "@/components/content/ContentExplorer";
import { GenericCard, GenericRow, type GenericItemConfig } from "@/components/content/GenericItem";
import { t } from "@/lib/i18n";

const config: GenericItemConfig = {
  accentBtn: "ap-btn--pres",
  editRoute: (id) => `/presentation-editor?id=${id}`,
  countOf: (d) => (d.data.slides as unknown[] | undefined)?.length ?? 0,
  countLabel: (n) => `${n} diapositive${n > 1 ? "s" : ""}`,
  play: {
    label: "Présenter",
    run: (d, navigate) => navigate(`/presentation-editor?id=${(d.data.id as string) ?? ""}&present=1`),
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
      cta={{ label: "Créer une présentation", onClick: () => navigate("/presentation-editor") }}
      renderCard={(d, ctx) => <GenericCard d={d} ctx={ctx} config={config} navigate={navigate} />}
      renderRow={(d, ctx) => <GenericRow d={d} ctx={ctx} config={config} navigate={navigate} />}
    />
  );
};

export default MySlides;
