import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCurrentUser, logout } from "@/lib/auth";
import { Zap, LogOut, User, BookOpen, BarChart3, Globe, Home, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { getLanguage, setLanguage, t, type Language } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  subtitle?: string;
}

export const Header = ({ subtitle }: HeaderProps) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getLanguage());

  const navigationItems = [
    {
      label: t('home'),
      icon: Home,
      onClick: () => navigate('/'),
      requiresAuth: false,
    },
    {
      label: t('myQuizzes'),
      icon: BookOpen,
      onClick: () => navigate('/my-quizzes'),
      requiresAuth: true,
    },
    {
      label: t('myPolls'),
      icon: BarChart3,
      onClick: () => navigate('/my-polls'),
      requiresAuth: true,
    },
  ];

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser?.id !== user?.id || currentUser?.username !== user?.username) {
      setUser(currentUser);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate("/");
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setCurrentLanguage(lang);
    window.location.reload(); // Reload to apply language changes
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-white/40 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 gap-6">
        <div
          className="group flex cursor-pointer items-center gap-4 transition-transform duration-300 hover:-translate-y-0.5"
          onClick={() => navigate('/')}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0f1a3d] to-[#1d2a55] text-white shadow-[0_12px_30px_-12px_rgba(15,26,61,0.5)]">
            <Zap className="h-6 w-6" />
          </div>
          <div className="leading-tight">
            <h1 className="font-heading text-2xl text-foreground">{t('quizMaster')}</h1>
            {subtitle && <p className="text-xs uppercase tracking-[0.3em] text-foreground/60">{subtitle}</p>}
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {navigationItems
            .filter((item) => (item.requiresAuth ? Boolean(user) : true))
            .map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.label}
                  variant="ghost"
                  size="sm"
                  onClick={item.onClick}
                  className="gap-2 rounded-full px-4 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
        </div>

        <div className="flex items-center gap-3">
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full border-white/60 bg-white/60 text-foreground/70 shadow-[0_10px_30px_-18px_rgba(15,26,61,0.5)] transition-all duration-300 hover:border-[#0f1a3d]/30 hover:text-foreground"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="z-50 w-56 rounded-2xl border border-white/50 bg-white/80 p-2 backdrop-blur-xl">
                {navigationItems
                  .filter((item) => (item.requiresAuth ? Boolean(user) : true))
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.label}
                        className="gap-2 rounded-xl text-sm text-foreground/80 transition-colors hover:bg-foreground/5"
                        onSelect={item.onClick}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                {user && (
                  <DropdownMenuItem
                    className="gap-2 rounded-xl text-sm text-foreground/80 transition-colors hover:bg-foreground/5"
                    onSelect={() => navigate('/profile')}
                  >
                    <User className="h-4 w-4" />
                    {t('profile')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-full border-white/60 bg-white/60 text-foreground/70 shadow-[0_10px_30px_-18px_rgba(15,26,61,0.5)] transition-all duration-300 hover:border-[#0f1a3d]/30 hover:text-foreground"
              >
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="z-50 rounded-2xl border border-white/50 bg-white/80 p-2 backdrop-blur-xl">
              <DropdownMenuItem
                className="rounded-xl text-sm text-foreground/80 transition-colors hover:bg-foreground/5"
                onClick={() => handleLanguageChange('en')}
              >
                🇬🇧 English
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl text-sm text-foreground/80 transition-colors hover:bg-foreground/5"
                onClick={() => handleLanguageChange('fr')}
              >
                🇫🇷 Français
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/profile')}
                className="hidden h-10 rounded-full border-white/60 bg-white/60 px-4 text-sm font-medium text-foreground/80 shadow-[0_10px_30px_-18px_rgba(15,26,61,0.5)] transition-all duration-300 hover:border-[#0f1a3d]/25 hover:text-foreground sm:flex"
                title={user.username}
              >
                <User className="mr-2 h-4 w-4" />
                {t('profile')}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/profile')}
                className="sm:hidden h-10 w-10 rounded-full border-white/60 bg-white/60 text-foreground/80 shadow-[0_10px_30px_-18px_rgba(15,26,61,0.5)] transition-all duration-300 hover:border-[#0f1a3d]/25 hover:text-foreground"
                title={user.username}
              >
                <User className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-10 rounded-full text-foreground/70 transition-colors hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">{t('logout')}</span>
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => navigate('/auth')}
              className="rounded-full border-white/60 bg-white/60 px-6 text-sm font-medium text-foreground/80 shadow-[0_10px_30px_-18px_rgba(15,26,61,0.5)] transition-all duration-300 hover:border-[#0f1a3d]/25 hover:text-foreground"
            >
              <User className="mr-2 h-4 w-4" />
              {t('login')}
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};
