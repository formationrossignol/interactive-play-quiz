import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BookOpen, BarChart3, Layers, QrCode, Compass, Layout } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const contentTypes = [
  {
    key: "quiz",
    label: "Quiz",
    titleKey: "createQuiz" as const,
    descKey: "createQuizDesc" as const,
    ctaKey: "newQuiz" as const,
    icon: BookOpen,
    iconClass: "bg-rose-100 text-rose-600",
    borderClass: "card-quiz",
    route: "/builder-start?type=quiz",
  },
  {
    key: "slide",
    label: "Slides",
    titleKey: null,
    title: "Créer une présentation",
    descKey: null,
    desc: "Créez des présentations interactives et engageantes",
    ctaKey: null,
    cta: "Nouvelle présentation",
    icon: Layout,
    iconClass: "bg-emerald-100 text-emerald-600",
    borderClass: "card-slide",
    route: "/builder-start?type=slide",
  },
  {
    key: "poll",
    label: "Poll",
    titleKey: "createPoll" as const,
    descKey: "createPollDesc" as const,
    ctaKey: "newPoll" as const,
    icon: BarChart3,
    iconClass: "bg-cyan-100 text-cyan-600",
    borderClass: "card-poll",
    route: "/builder-start?type=poll",
  },
  {
    key: "flashcard",
    label: "Flashcard",
    titleKey: "createFlashcard" as const,
    descKey: "createFlashcardDesc" as const,
    ctaKey: "newFlashcard" as const,
    icon: Layers,
    iconClass: "bg-amber-100 text-amber-600",
    borderClass: "card-flashcard",
    route: "/builder-start?type=flashcard",
  },
] as const;

const Index = () => {
  const [gameCode, setGameCode] = useState("");
  const navigate = useNavigate();

  const joinQuiz = () => {
    if (gameCode.trim()) {
      navigate(`/join/${gameCode.toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header />

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        {/* Hero */}
        <section className="mb-16 rounded-2xl border border-indigo-100 bg-indigo-50 px-8 py-14 text-center">
          <span className="mb-6 inline-flex items-center rounded-full bg-indigo-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            {t("heroInteractive")}
          </span>
          <h1 className="mb-4 text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">
            {t("heroTitle")}{" "}
            <span className="text-indigo-600">{t("heroInteractive")}</span>{" "}
            {t("heroQuizzes")}
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg text-slate-500">
            {t("heroDescription")}
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              onClick={() => navigate("/builder-start?type=quiz")}
              className="h-12 rounded-full bg-indigo-600 px-8 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              {t("newQuiz")}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/discover")}
              className="h-12 rounded-full border-slate-200 px-8 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Compass className="mr-2 h-4 w-4" />
              {t("discoverPublic")}
            </Button>
          </div>
        </section>

        {/* Content type tiles */}
        <section className="mb-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {contentTypes.map(({ key, label, titleKey, title, descKey, desc, ctaKey, cta, icon: Icon, iconClass, borderClass, route }) => {
            const resolvedTitle = titleKey ? t(titleKey) : (title as string);
            const resolvedDesc = descKey ? t(descKey) : (desc as string);
            const resolvedCta = ctaKey ? t(ctaKey) : (cta as string);
            return (
              <div
                key={key}
                onClick={() => navigate(route)}
                className={cn(
                  "cursor-pointer rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
                  borderClass
                )}
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", iconClass)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {label}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">{resolvedTitle}</h3>
                <p className="mb-5 text-sm leading-relaxed text-slate-500">{resolvedDesc}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={(e) => { e.stopPropagation(); navigate(route); }}
                >
                  {resolvedCta}
                </Button>
              </div>
            );
          })}
        </section>

        {/* Join section */}
        <section className="mx-auto max-w-lg">
          <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-card">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                <QrCode className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{t("joinTitle")}</h3>
                <p className="text-sm text-slate-500">{t("joinDesc")}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder={t("enterCode")}
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinQuiz()}
                className="h-12 rounded-xl border-slate-200 text-lg font-semibold tracking-[0.25em] focus-visible:ring-indigo-500"
                maxLength={6}
              />
              <Button
                onClick={joinQuiz}
                disabled={!gameCode.trim()}
                className="h-12 rounded-xl bg-indigo-600 px-6 font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-40"
              >
                {t("join")}
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
