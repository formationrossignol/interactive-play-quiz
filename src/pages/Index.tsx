import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Plus, QrCode, Compass } from "lucide-react";
import { t } from "@/lib/i18n";

const Index = () => {
  const [gameCode, setGameCode] = useState("");
  const navigate = useNavigate();

  const joinQuiz = () => {
    if (gameCode.trim()) {
      navigate(`/join/${gameCode.toUpperCase()}`);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="floating-orb -left-24 top-28 h-72 w-72 bg-[#0f1a3d]/12" />
      <div className="floating-orb -right-32 top-0 h-96 w-96 bg-[#1d2a55]/10" />
      <div className="floating-orb bottom-16 left-1/2 h-80 w-80 -translate-x-1/2 bg-[#0f1a3d]/8" />

      <Header />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-14 md:pt-16">
        <section className="glass-panel mt-6 overflow-hidden px-8 py-16 text-center md:mt-8 md:px-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center justify-center rounded-full border border-white/50 bg-white/60 px-4 py-1 text-xs tracking-[0.4em] text-foreground/60">
              {t('heroInteractive')}
            </span>
            <h2 className="font-heading mt-6 text-4xl leading-[1.08] text-foreground md:mt-8 md:text-6xl">
              {t('heroTitle')} <span className="text-foreground/60">{t('heroInteractive')}</span> {t('heroQuizzes')}
            </h2>
            <p className="mt-6 text-base leading-relaxed text-foreground/70 md:mt-8 md:text-xl">
              {t('heroDescription')}
            </p>
          </div>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 md:flex-row">
            <Button
              size="lg"
              onClick={() => navigate('/builder-start?type=quiz')}
              className="h-14 rounded-full bg-gradient-to-r from-[#0f1a3d] to-[#1d2a55] px-10 text-base font-medium tracking-wide text-white shadow-[0_24px_60px_-30px_rgba(15,26,61,0.8)] transition-transform duration-300 hover:-translate-y-0.5"
            >
              {t('newQuiz')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/discover')}
              className="h-14 rounded-full border-white/60 bg-white/60 px-10 text-base font-medium tracking-wide text-foreground/80 shadow-[0_22px_60px_-30px_rgba(15,26,61,0.6)] transition-all duration-300 hover:border-[#0f1a3d]/30 hover:text-foreground"
            >
              <Compass className="mr-2 h-5 w-5" />
              {t('discoverPublic')}
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div
            className="glass-tile cursor-pointer p-10 text-left"
            onClick={() => navigate('/builder-start?type=quiz')}
          >
            <div className="mb-10 flex items-center justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0f1a3d] to-[#1d2a55] text-white shadow-[0_16px_40px_-18px_rgba(15,26,61,0.6)]">
                <Plus className="h-7 w-7" />
              </div>
              <span className="text-xs font-medium uppercase tracking-[0.35em] text-foreground/40">Quiz</span>
            </div>
            <h3 className="font-heading text-4xl text-foreground">{t('createQuiz')}</h3>
            <p className="mt-4 text-base leading-relaxed text-foreground/65">{t('createQuizDesc')}</p>
            <div className="mt-10">
              <Button
                variant="outline"
                className="rounded-full border-white/60 bg-white/60 px-6 py-2 text-sm font-medium text-foreground/80 shadow-[0_12px_40px_-24px_rgba(15,26,61,0.6)] transition-all duration-300 hover:border-[#0f1a3d]/25 hover:text-foreground"
              >
                {t('newQuiz')}
              </Button>
            </div>
          </div>

          <div
            className="glass-tile cursor-pointer p-10 text-left"
            onClick={() => navigate('/builder-start?type=slide')}
          >
            <div className="mb-10 flex items-center justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1d2a55] to-[#30407a] text-white shadow-[0_16px_40px_-18px_rgba(15,26,61,0.6)]">
                <Plus className="h-7 w-7" />
              </div>
              <span className="text-xs font-medium uppercase tracking-[0.35em] text-foreground/40">Slides</span>
            </div>
            <h3 className="font-heading text-4xl text-foreground">Créer une présentation</h3>
            <p className="mt-4 text-base leading-relaxed text-foreground/65">Créez des présentations interactives et engageantes</p>
            <div className="mt-10">
              <Button
                variant="outline"
                className="rounded-full border-white/60 bg-white/60 px-6 py-2 text-sm font-medium text-foreground/80 shadow-[0_12px_40px_-24px_rgba(15,26,61,0.6)] transition-all duration-300 hover:border-[#0f1a3d]/25 hover:text-foreground"
              >
                Nouvelle présentation
              </Button>
            </div>
          </div>

          <div
            className="glass-tile cursor-pointer p-10 text-left"
            onClick={() => navigate('/builder-start?type=poll')}
          >
            <div className="mb-10 flex items-center justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#30407a] to-[#4a5f9a] text-white shadow-[0_16px_40px_-18px_rgba(15,26,61,0.6)]">
                <Plus className="h-7 w-7" />
              </div>
              <span className="text-xs font-medium uppercase tracking-[0.35em] text-foreground/40">Poll</span>
            </div>
            <h3 className="font-heading text-4xl text-foreground">{t('createPoll')}</h3>
            <p className="mt-4 text-base leading-relaxed text-foreground/65">{t('createPollDesc')}</p>
            <div className="mt-10">
              <Button
                variant="outline"
                className="rounded-full border-white/60 bg-white/60 px-6 py-2 text-sm font-medium text-foreground/80 shadow-[0_12px_40px_-24px_rgba(15,26,61,0.6)] transition-all duration-300 hover:border-[#0f1a3d]/25 hover:text-foreground"
              >
                {t('newPoll')}
              </Button>
            </div>
          </div>

          <div
            className="glass-tile cursor-pointer p-10 text-left"
            onClick={() => navigate('/builder-start?type=flashcard')}
          >
            <div className="mb-10 flex items-center justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4a5f9a] to-[#6276b8] text-white shadow-[0_16px_40px_-18px_rgba(15,26,61,0.6)]">
                <Plus className="h-7 w-7" />
              </div>
              <span className="text-xs font-medium uppercase tracking-[0.35em] text-foreground/40">Flashcard</span>
            </div>
            <h3 className="font-heading text-4xl text-foreground">{t('createFlashcard')}</h3>
            <p className="mt-4 text-base leading-relaxed text-foreground/65">{t('createFlashcardDesc')}</p>
            <div className="mt-10">
              <Button
                variant="outline"
                className="rounded-full border-white/60 bg-white/60 px-6 py-2 text-sm font-medium text-foreground/80 shadow-[0_12px_40px_-24px_rgba(15,26,61,0.6)] transition-all duration-300 hover:border-[#0f1a3d]/25 hover:text-foreground"
              >
                {t('newFlashcard')}
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <div className="glass-tile mx-auto flex max-w-3xl flex-col gap-8 p-10 md:flex-row md:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#0f1a3d] to-[#1d2a55] text-white shadow-[0_18px_44px_-20px_rgba(15,26,61,0.65)]">
              <QrCode className="h-7 w-7" />
            </div>
            <div className="flex-1 space-y-2 text-left">
              <h3 className="font-heading text-3xl text-foreground">{t('joinTitle')}</h3>
              <p className="text-base text-foreground/65">{t('joinDesc')}</p>
            </div>
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
              <Input
                placeholder={t('enterCode')}
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && joinQuiz()}
                className="h-14 rounded-2xl border-white/60 bg-white/70 text-lg tracking-[0.3em] text-foreground/80 placeholder:text-foreground/30 focus-visible:ring-2 focus-visible:ring-[#0f1a3d]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white/60"
                maxLength={6}
              />
              <Button
                onClick={joinQuiz}
                size="lg"
                disabled={!gameCode.trim()}
                className="h-14 rounded-2xl bg-gradient-to-r from-[#0f1a3d] to-[#1d2a55] px-8 text-base font-medium tracking-wide text-white shadow-[0_20px_50px_-28px_rgba(15,26,61,0.75)] transition-transform duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-foreground/20"
              >
                {t('join')}
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
