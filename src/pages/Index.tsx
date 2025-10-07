import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
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
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-16 mt-8">
          <h2 className="text-6xl font-bold text-foreground mb-6 animate-fade-in">
            {t('heroTitle')} <span className="bg-gradient-primary bg-clip-text text-transparent">{t('heroInteractive')}</span> {t('heroQuizzes')}
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            {t('heroDescription')}
          </p>
        </div>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Create Quiz */}
          <Card className="border-2 hover:border-primary transition-all cursor-pointer group" onClick={() => navigate('/builder-start?type=quiz')}>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto mb-4 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">{t('createQuiz')}</h3>
              <p className="text-muted-foreground mb-6">{t('createQuizDesc')}</p>
              <Button className="w-full" size="lg">
                {t('newQuiz')}
              </Button>
            </CardContent>
          </Card>

          {/* Create Poll */}
          <Card className="border-2 hover:border-primary transition-all cursor-pointer group" onClick={() => navigate('/builder-start?type=poll')}>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-gradient-secondary rounded-full mx-auto mb-4 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">{t('createPoll')}</h3>
              <p className="text-muted-foreground mb-6">{t('createPollDesc')}</p>
              <Button className="w-full" size="lg">
                {t('newPoll')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Join Section */}
        <Card className="max-w-2xl mx-auto mb-16">
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-success rounded-full flex items-center justify-center">
                <QrCode className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-foreground">{t('joinTitle')}</h3>
                <p className="text-muted-foreground">{t('joinDesc')}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Input
                placeholder={t('enterCode')}
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && joinQuiz()}
                className="text-lg"
                maxLength={6}
              />
              <Button onClick={joinQuiz} size="lg" disabled={!gameCode.trim()}>
                {t('join')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Discover Public Quizzes */}
        <div className="text-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate('/discover')}
            className="group"
          >
            <Compass className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
            {t('discoverPublic')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
