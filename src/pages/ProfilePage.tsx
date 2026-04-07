import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentUser, setCurrentUser, User as AuthUser, type Theme, type Language } from "@/lib/auth";
import { getUserQuizzes } from "@/lib/quizStorage";
import { setLanguage as setI18nLanguage, t } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { Save, Trophy, Clock, BookOpen, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [theme, setTheme] = useState<Theme>('light');
  const [language, setLanguage] = useState<Language>('en');
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    publicQuizzes: 0,
    totalQuestions: 0
  });

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      navigate("/auth");
      return;
    }
    
    setUser(currentUser);
    setUsername(currentUser.username);
    setEmail(currentUser.email);
    setTheme(currentUser.theme || 'light');
    setLanguage(currentUser.language || 'en');

    // Calculate stats
    const userQuizzes = getUserQuizzes(currentUser.id).filter((quiz) => quiz.type === 'quiz');
    setStats({
      totalQuizzes: userQuizzes.length,
      publicQuizzes: userQuizzes.filter(q => q.isPublic).length,
      totalQuestions: userQuizzes.reduce((sum, q) => sum + q.questions.length, 0)
    });
  }, [navigate]);

  const handleSave = () => {
    if (!user) return;
    
    if (!username.trim()) {
      toast.error(t('usernameRequired'));
      return;
    }

    const updatedUser: AuthUser = {
      ...user,
      username: username.trim(),
      theme,
      language
    };

    setCurrentUser(updatedUser);
    setUser(updatedUser);
    setI18nLanguage(language);
    
    // Apply theme
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    toast.success(t('profileUpdated'));
    
    // Reload to apply language
    setTimeout(() => window.location.reload(), 500);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header subtitle={t('myProfile')} />

      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-foreground mb-2">{t('myProfile')}</h2>
          <p className="text-muted-foreground">{t('manageInfo')}</p>
        </div>

        <div className="grid gap-6">
          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-indigo-600 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-foreground mb-1">{stats.totalQuizzes}</div>
                <div className="text-muted-foreground text-sm">{t('quizzesCreated')}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-indigo-500 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-foreground mb-1">{stats.publicQuizzes}</div>
                <div className="text-muted-foreground text-sm">{t('publicQuizzes')}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-emerald-600 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-foreground mb-1">{stats.totalQuestions}</div>
                <div className="text-muted-foreground text-sm">{t('questions')}</div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">{t('profileInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="username">{t('username')}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="mt-2 cursor-not-allowed opacity-60"
                />
                <p className="text-muted-foreground text-xs mt-1">{t('emailReadonly')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">{t('preferences')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="theme">{t('theme')}</Label>
                <Select value={theme} onValueChange={(value: Theme) => setTheme(value)}>
                  <SelectTrigger id="theme" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4" />
                        {t('lightMode')}
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4" />
                        {t('darkMode')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="language">{t('language')}</Label>
                <Select value={language} onValueChange={(value: Language) => setLanguage(value)}>
                  <SelectTrigger id="language" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4">
                <Button
                  variant="default"
                  className="w-full"
                  onClick={handleSave}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {t('saveChanges')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
