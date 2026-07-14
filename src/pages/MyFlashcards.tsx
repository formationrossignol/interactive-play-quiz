import { useNavigate } from "react-router-dom";
import { ContentExplorer } from "@/components/content/ContentExplorer";
import { GenericCard, GenericRow, type GenericItemConfig } from "@/components/content/GenericItem";
import { t } from "@/lib/i18n";

const config: GenericItemConfig = {
  accentBtn: "ap-btn--flash",
  editRoute: (id) => `/builder?type=flashcard&quizId=${id}`,
  countOf: (d) => (d.data.questions as unknown[] | undefined)?.length ?? 0,
  countLabel: (n) => `${n} ${n > 1 ? t("cards") : t("card")}`,
  primaryEdit: t("editSet"),
};

const MyFlashcards = () => {
  const navigate = useNavigate();
  return (
    <ContentExplorer
      type="flashcard"
      accentBtn="ap-btn--flash"
      headerTitle={t("myFlashcards")}
      headerSubtitle={t("myFlashcardsSubtitle")}
      rootLabel="Tous les paquets"
      oneLabel="paquet"
      cta={{ label: t("createFlashcardSet"), onClick: () => navigate("/builder-start?type=flashcard") }}
      renderCard={(d, ctx) => <GenericCard d={d} ctx={ctx} config={config} navigate={navigate} />}
      renderRow={(d, ctx) => <GenericRow d={d} ctx={ctx} config={config} navigate={navigate} />}
    />
  );
};

export default MyFlashcards;
