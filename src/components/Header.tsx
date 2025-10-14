import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCurrentUser, logout } from "@/lib/auth";
import {
  Zap,
  LogOut,
  User,
  BookOpen,
  BarChart3,
  Globe,
  Home,
  Menu,
  Layers,
  Library,
  ChevronDown,
  Sparkles,
  CreditCard,
  Users,
  Mail,
} from "lucide-react";
import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { getLanguage, setLanguage, t, type Language } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface HeaderProps {
  subtitle?: string;
  toolbar?: ReactNode;
  toolbarPlacement?: "secondary" | "main";
  showNavigation?: boolean;
  alignLeft?: boolean;
}

export const Header = ({
  subtitle,
  toolbar,
  toolbarPlacement = "secondary",
  showNavigation = true,
  alignLeft = false,
}: HeaderProps) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getLanguage());
  const headerRef = useRef<HTMLElement | null>(null);

  const primaryNavigationItems = [
    {
      label: t('home'),
      icon: Home,
      onClick: () => navigate('/'),
      requiresAuth: false,
    },
    {
      label: t('features'),
      icon: Sparkles,
      onClick: () => navigate('/features'),
      requiresAuth: false,
    },
    {
      label: t('pricing'),
      icon: CreditCard,
      onClick: () => navigate('/pricing'),
      requiresAuth: false,
    },
    {
      label: t('footerAbout'),
      icon: Users,
      onClick: () => navigate('/about'),
      requiresAuth: false,
    },
    {
      label: t('footerContact'),
      icon: Mail,
      onClick: () => navigate('/contact'),
      requiresAuth: false,
    },
  ];

  const creationMenuItems = [
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
    {
      label: t('myFlashcards'),
      icon: Layers,
      onClick: () => navigate('/my-flashcards'),
      requiresAuth: true,
    },
    {
      label: t('questionBank'),
      icon: Library,
      onClick: () => navigate('/question-bank'),
      requiresAuth: true,
    },
  ];

  const availableCreationItems = creationMenuItems.filter((item) => (item.requiresAuth ? Boolean(user) : true));

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

  useLayoutEffect(() => {
    const updateHeaderHeight = () => {
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty('--app-header-height', `${headerHeight}px`);
    };

    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  const showMainToolbar = Boolean(toolbar && toolbarPlacement === "main");
  const mainNavigationIconClass =
    "h-12 w-12 rounded-full border border-white/60 bg-white/70 text-foreground/70 shadow-[0_10px_30px_-18px_rgba(15,26,61,0.45)] transition-all duration-300 hover:border-[#0f1a3d]/30 hover:text-foreground";

  return (
    <header
      ref={(node) => {
        headerRef.current = node;
      }}
      className="relative sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-border/60"
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        aria-hidden
        style={{
          background:
            "linear-gradient(90deg, hsla(var(--border), 0) 0%, hsla(var(--border), 0.45) 45%, hsla(var(--border), 0.45) 55%, hsla(var(--border), 0) 100%)",
        }}
      />
      <div
        className={cn(
          "flex flex-wrap items-center px-6 py-5",
          alignLeft
            ? "mx-0 w-full justify-start gap-4"
            : "mx-auto max-w-6xl justify-between gap-6"
        )}
      >
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

        {showNavigation && (
          <div className="hidden flex-1 items-center justify-center gap-6 md:flex">
            {primaryNavigationItems
              .filter((item) => (item.requiresAuth ? Boolean(user) : true))
              .map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex flex-col items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={item.onClick}
                      title={item.label}
                      className={mainNavigationIconClass}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="sr-only">{item.label}</span>
                    </Button>
                    <span className="text-xs font-medium uppercase tracking-[0.25em] text-foreground/50">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            {availableCreationItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 rounded-full px-4 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
                  >
                    <Layers className="h-4 w-4" />
                    <span>{t('myCreations')}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-50 w-56 rounded-2xl border border-white/50 bg-white/80 p-2 backdrop-blur-xl">
                  {availableCreationItems.map((item) => {
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
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {showMainToolbar && (
          <div className="flex flex-1 justify-center px-4">
            <div className="w-full max-w-4xl">
              {toolbar}
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex items-center gap-3",
            alignLeft && "ml-auto",
            toolbarPlacement === "main" ? "flex-wrap justify-end" : ""
          )}
        >
          {showNavigation && (
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
                  {primaryNavigationItems
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
                  {availableCreationItems.length > 0 && (
                    <>
                      <DropdownMenuSeparator className="bg-foreground/10" />
                      <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('myCreations')}
                      </DropdownMenuLabel>
                      {availableCreationItems.map((item) => {
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
                    </>
                  )}
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
          )}

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
                size="icon"
                onClick={() => navigate('/profile')}
                className="h-10 w-10 rounded-full border-white/60 bg-white/60 text-foreground/80 shadow-[0_10px_30px_-18px_rgba(15,26,61,0.5)] transition-all duration-300 hover:border-[#0f1a3d]/25 hover:text-foreground"
                title={user.username}
              >
                <User className="h-4 w-4" />
                <span className="sr-only">{t('profile')}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-10 w-10 rounded-full text-foreground/70 transition-colors hover:text-foreground"
                title={t('logout')}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">{t('logout')}</span>
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
      {toolbar && toolbarPlacement === "secondary" && (
        <div className="border-t border-white/40 bg-white/60 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
            {toolbar}
          </div>
        </div>
      )}
      {toolbar && toolbarPlacement === "main" && (
        <div className="w-full px-6 pb-4 lg:hidden">
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 border-t border-white/40 bg-white/60 px-4 py-3 backdrop-blur-xl",
              alignLeft ? "justify-start" : "justify-end"
            )}
          >
            {toolbar}
          </div>
        </div>
      )}
    </header>
  );
};
