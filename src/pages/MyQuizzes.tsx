import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ContentExplorer } from "@/components/content/ContentExplorer";
import { GenericCard, GenericRow, type GenericItemConfig } from "@/components/content/GenericItem";
import type { ContentDisplay } from "@/lib/content/contentView";
import type { SavedQuiz } from "@/lib/quizStorage";
import { t } from "@/lib/i18n";

const idOf = (d: ContentDisplay) => String((d.data.id as string | undefined) ?? "");

const config: GenericItemConfig = {
  accentBtn: "ap-btn--quiz",
  editRoute: (id) => `/builder?type=quiz&quizId=${id}`,
  countOf: (d) => (d.data.questions as unknown[] | undefined)?.length ?? 0,
  countLabel: (n) => `${n} ${n > 1 ? t("questions") : t("question")}`,
  results: (id) => `/quiz-results/${id}`,
  showExam: true,
  play: {
    label: t("playQuiz"),
    run: (d, navigate) => {
      const id = idOf(d);
      if (!id) { toast.error("Quiz introuvable"); return; }
      localStorage.setItem(`quiz-${id}`, JSON.stringify(d.data as unknown as SavedQuiz));
      navigate(`/quiz/${id}`);
    },
  },
};

const MyQuizzes = () => {
  const navigate = useNavigate();
  return (
    <ContentExplorer
      type="quiz"
      accentBtn="ap-btn--quiz"
      headerTitle={t("myQuizzes")}
      headerSubtitle={t("myQuizzesSubtitle")}
      rootLabel="Tous les quiz"
      oneLabel="quiz"
      cta={{ label: t("createQuizCta"), onClick: () => navigate("/builder-start?type=quiz") }}
      headerExtras={
        <button
          onClick={() => navigate("/my-exams")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999, border: "2px solid var(--ap-line)", background: "var(--ap-paper-2)", fontFamily: "var(--ap-font-body)", fontWeight: 800, fontSize: 13, color: "var(--ap-ink)", cursor: "pointer" }}
        >
          📝 Examens
        </button>
      }
      renderCard={(d, ctx) => <GenericCard d={d} ctx={ctx} config={config} navigate={navigate} />}
      renderRow={(d, ctx) => <GenericRow d={d} ctx={ctx} config={config} navigate={navigate} />}
    />
  );
};

export default MyQuizzes;
