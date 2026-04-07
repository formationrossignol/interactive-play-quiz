import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BookOpen, BarChart3, Layers, QrCode, Compass, Layout, ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n";

const contentTypes = [
  {
    key: "quiz",
    label: "Quiz",
    titleKey: "createQuiz" as const,
    descKey: "createQuizDesc" as const,
    ctaKey: "newQuiz" as const,
    icon: BookOpen,
    tileClass: "tile-quiz",
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
    tileClass: "tile-slide",
    route: "/builder-start?type=slide",
  },
  {
    key: "poll",
    label: "Poll",
    titleKey: "createPoll" as const,
    descKey: "createPollDesc" as const,
    ctaKey: "newPoll" as const,
    icon: BarChart3,
    tileClass: "tile-poll",
    route: "/builder-start?type=poll",
  },
  {
    key: "flashcard",
    label: "Flashcard",
    titleKey: "createFlashcard" as const,
    descKey: "createFlashcardDesc" as const,
    ctaKey: "newFlashcard" as const,
    icon: Layers,
    tileClass: "tile-flashcard",
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
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="mb-14 overflow-hidden rounded-3xl bg-[hsl(var(--hero-bg))] px-8 py-16 text-center relative">
          {/* Decorative dots grid */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          {/* Color splashes */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full opacity-20"
            style={{ background: "hsl(var(--quiz-color))", filter: "blur(80px)" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full opacity-15"
            style={{ background: "hsl(var(--poll-color))", filter: "blur(80px)" }}
          />

          <div className="relative z-10">
            <span className="chroma-badge mb-6 border border-white/20 bg-white/10 text-white/80">
              {t("heroInteractive")}
            </span>
            <h1 className="font-display mb-5 text-4xl font-extrabold leading-tight text-white md:text-6xl">
              {t("heroTitle")}{" "}
              <span
                style={{ color: "hsl(var(--quiz-color))" }}
              >
                {t("heroInteractive")}
              </span>{" "}
              {t("heroQuizzes")}
            </h1>
            <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-white/60">
              {t("heroDescription")}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={() => navigate("/builder-start?type=quiz")}
                className="btn-chroma"
                style={{ background: "hsl(var(--quiz-color))" }}
              >
                {t("newQuiz")}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate("/discover")}
                className="btn-chroma-outline"
                style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <Compass className="h-4 w-4" />
                {t("discoverPublic")}
              </button>
            </div>
          </div>
        </section>

        {/* ── CONTENT TYPE TILES ───────────────────────────────── */}
        <section className="mb-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {contentTypes.map(({ key, label, titleKey, title, descKey, desc, ctaKey, cta, icon: Icon, tileClass, route }) => {
            const resolvedTitle = titleKey ? t(titleKey) : (title as string);
            const resolvedDesc = descKey ? t(descKey) : (desc as string);
            const resolvedCta = ctaKey ? t(ctaKey) : (cta as string);

            /* flashcard uses dark text (marigold bg) */
            const isDark = key === "flashcard";

            return (
              <div
                key={key}
                onClick={() => navigate(route)}
                className={`${tileClass} group cursor-pointer rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-chroma`}
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isDark ? "bg-black/10" : "bg-white/20"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-black/50" : "text-white/50"}`}>
                    {label}
                  </span>
                </div>
                <h3 className={`mb-2 font-display text-lg font-bold leading-snug ${isDark ? "text-[#0F0E17]" : "text-white"}`}>
                  {resolvedTitle}
                </h3>
                <p className={`mb-5 text-sm leading-relaxed ${isDark ? "text-black/60" : "text-white/70"}`}>
                  {resolvedDesc}
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold ${isDark ? "text-black/70" : "text-white/90"} group-hover:gap-2.5 transition-all`}
                  onClick={(e) => { e.stopPropagation(); navigate(route); }}
                >
                  {resolvedCta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            );
          })}
        </section>

        {/* ── JOIN SECTION ─────────────────────────────────────── */}
        <section className="mx-auto max-w-lg">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
            <div className="mb-5 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "hsl(var(--poll-color))", color: "#fff" }}
              >
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">{t("joinTitle")}</h3>
                <p className="text-sm text-muted-foreground">{t("joinDesc")}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder={t("enterCode")}
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinQuiz()}
                className="h-12 rounded-xl border-border text-lg font-bold tracking-[0.25em] focus-visible:ring-[hsl(var(--poll-color))]"
                maxLength={6}
              />
              <Button
                onClick={joinQuiz}
                disabled={!gameCode.trim()}
                className="h-12 rounded-xl px-6 font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                style={{ background: "hsl(var(--poll-color))" }}
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
