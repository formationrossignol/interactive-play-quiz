import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ContentExplorer } from "@/components/content/ContentExplorer";
import { GenericCard, GenericRow, type GenericItemConfig } from "@/components/content/GenericItem";
import type { ContentDisplay } from "@/lib/content/contentView";
import { t } from "@/lib/i18n";

const idOf = (d: ContentDisplay) => String((d.data.id as string | undefined) ?? "");

const config: GenericItemConfig = {
  accentBtn: "ap-btn--poll",
  editRoute: (id) => `/builder?type=poll&quizId=${id}`,
  countOf: (d) => (d.data.questions as unknown[] | undefined)?.length ?? 0,
  countLabel: (n) => `${n} ${n > 1 ? t("questions") : t("question")}`,
  results: (id) => `/poll-results/${id}`,
  play: {
    label: t("launchPoll"),
    run: (d, navigate) => {
      const id = idOf(d);
      if (!id) { toast.error("Sondage introuvable"); return; }
      localStorage.setItem(`poll-${id}`, JSON.stringify(d.data));
      navigate(`/quiz/${id}`);
    },
  },
};

const MyPolls = () => {
  const navigate = useNavigate();
  return (
    <ContentExplorer
      type="poll"
      accentBtn="ap-btn--poll"
      headerTitle={t("myPolls")}
      headerSubtitle={t("myPollsSubtitle")}
      rootLabel="Tous les sondages"
      oneLabel="sondage"
      cta={{ label: t("createPollCta"), onClick: () => navigate("/builder-start?type=poll") }}
      renderCard={(d, ctx) => <GenericCard d={d} ctx={ctx} config={config} navigate={navigate} />}
      renderRow={(d, ctx) => <GenericRow d={d} ctx={ctx} config={config} navigate={navigate} />}
    />
  );
};

export default MyPolls;
