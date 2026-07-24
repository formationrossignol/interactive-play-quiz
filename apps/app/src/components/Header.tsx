import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getCurrentUser, logout } from "@/lib/auth";
import {
  LogOut,
  User,
  BookOpen,
  BarChart3,
  Globe,
  Menu,
  Layers,
  GraduationCap,
  Presentation,
  ChevronDown,
  ClipboardList,
  Shield,
  X,
  Plus,
} from "lucide-react";
import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { getLanguage, setLanguage, t, type Language } from "@/lib/i18n";
import { useLanguage } from "@/hooks/useLanguage";
import { useIsAdmin } from "@/lib/pages/useIsAdmin";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BrandMonogram } from "@/components/BrandMonogram";
import { BrandWordmark } from "@/components/BrandWordmark";

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
  useLanguage();
  const { isAdmin } = useIsAdmin();
  const [user, setUser] = useState(getCurrentUser());
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getLanguage());
  const headerRef = useRef<HTMLElement | null>(null);
  // Controlled so the mega-menu can carry a themed scrim + close button
  // (Innov dims the page behind the open menu; other themes just ignore it).
  const [creationsOpen, setCreationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // App-only nav: features/pricing/about/contact now live in apps/marketing.
  const primaryNavigationItems = [
    { label: t("dashboard"), onClick: () => navigate("/my-quizzes"), requiresAuth: true },
    { label: t("questionBank"), onClick: () => navigate("/question-bank"), requiresAuth: true },
    { label: t("discoverPublic"), onClick: () => navigate("/discover"), requiresAuth: false },
    { label: t("footerCommunity"), onClick: () => navigate("/community"), requiresAuth: false },
  ];

  // "+ Créer" jumps straight into a builder's start flow, unlike the old
  // "Mes créations" dropdown which linked to the content list pages.
  const createMenuItems = [
    { label: t("createQuiz"), icon: BookOpen, onClick: () => navigate("/builder-start?type=quiz") },
    { label: t("createPoll"), icon: BarChart3, onClick: () => navigate("/builder-start?type=poll") },
    { label: t("createFlashcards"), icon: Layers, onClick: () => navigate("/builder-start?type=flashcard") },
    { label: t("createSlides"), icon: Presentation, onClick: () => navigate("/builder-start?type=slide") },
    { label: t("createCourse"), icon: GraduationCap, onClick: () => navigate("/course-builder") },
    { label: t("createExam"), icon: ClipboardList, onClick: () => navigate("/exam-builder") },
  ];

  const avatarInitial = (user?.username || "?").trim().charAt(0).toUpperCase();

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser?.id !== user?.id || currentUser?.username !== user?.username) {
      setUser(currentUser);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    setUser(null);
    (window.location.href = "/");
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setCurrentLanguage(lang);
  };

  useLayoutEffect(() => {
    const updateHeaderHeight = () => {
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty("--app-header-height", `${headerHeight}px`);
    };
    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight);
    return () => window.removeEventListener("resize", updateHeaderHeight);
  }, []);

  void currentLanguage;

  return (
    <header
      ref={(node) => { headerRef.current = node; }}
      className="sticky top-0 z-40"
      style={{
        backgroundColor: "var(--ap-paper)",
        backgroundImage: "var(--ap-texture)",
        backgroundSize: "28px 28px",
      }}
    >
      <div
        className={cn(
          "flex items-center px-6 py-3",
          alignLeft
            ? "mx-0 w-full justify-start gap-4"
            : "mx-auto max-w-6xl justify-between gap-6"
        )}
      >
        {/* Logo */}
        <div
          className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80"
          onClick={() => (user ? navigate("/my-quizzes") : (window.location.href = "/"))}
        >
          <span className="ap-logo">
            <BrandMonogram size={22} />
          </span>
          <div>
            <BrandWordmark size={20} />
            {subtitle && (
              <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--ap-muted)" }}>{subtitle}</p>
            )}
          </div>
        </div>

        {/* Main toolbar placement */}
        {toolbar && toolbarPlacement === "main" && (
          <div className="flex flex-1 justify-center px-4">
            <div className="w-full max-w-4xl">{toolbar}</div>
          </div>
        )}

        {/* Desktop navigation */}
        {showNavigation && (
          <nav className="hidden md:flex flex-1 items-center justify-center">
            <div className="ap-nav-pill">
            {primaryNavigationItems
              .filter((item) => (item.requiresAuth ? Boolean(user) : true))
              .map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="ap-nav-pill__item"
                >
                  {item.label}
                </button>
              ))}

            {user && (
              <DropdownMenu open={creationsOpen} onOpenChange={setCreationsOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="ap-nav-pill__item flex items-center gap-1.5">
                    <Plus className="h-4 w-4" />
                    {t("createNew")}
                    <ChevronDown className="chevron-icon h-3.5 w-3.5" style={{ color: "var(--ap-muted)" }} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="z-50 w-52 p-1.5 ap-mega-menu"
                  style={{
                    background: "var(--ap-card)",
                    border: "var(--ap-border-w) solid var(--ap-line)",
                    borderRadius: "var(--ap-r-lg)",
                    boxShadow: "var(--ap-shadow-card)",
                    position: "relative",
                  }}
                >
                  <button
                    type="button"
                    className="ap-mega-menu__close"
                    aria-label="Fermer le menu"
                    onClick={() => setCreationsOpen(false)}
                  >
                    <X />
                  </button>
                  {createMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.label}
                        className="gap-2 rounded-md text-sm cursor-pointer"
                        style={{ color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)" }}
                        onSelect={item.onClick}
                      >
                        <Icon className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            </div>
          </nav>
        )}
        {/* Scrim behind the mega-menu — inert (transparent, no pointer-events)
            except under themes that dim the page while the menu is open. */}
        <div
          className={cn("ap-menu-scrim", creationsOpen && "is-open")}
          onClick={() => setCreationsOpen(false)}
          aria-hidden="true"
        />

        {/* Right actions */}
        <div className={cn("flex items-center gap-2", alignLeft && "ml-auto")}>
          {/* Mobile menu */}
          {showNavigation && (
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn"
                    style={{ padding: "8px 10px" }}
                    aria-label="Menu"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="z-50 w-56 p-1.5"
                  style={{
                    background: "var(--ap-card)",
                    border: "var(--ap-border-w) solid var(--ap-line)",
                    borderRadius: "var(--ap-r-lg)",
                    boxShadow: "var(--ap-shadow-card)",
                  }}
                >
                  {primaryNavigationItems
                    .filter((item) => (item.requiresAuth ? Boolean(user) : true))
                    .map((item) => (
                      <DropdownMenuItem
                        key={item.label}
                        className="rounded-md text-sm cursor-pointer"
                        style={{ color: "var(--ap-ink)" }}
                        onSelect={item.onClick}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  {user && (
                    <>
                      <DropdownMenuSeparator style={{ background: "var(--ap-line)" }} />
                      <DropdownMenuLabel
                        className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide"
                        style={{ color: "var(--ap-muted)" }}
                      >
                        {t("createNew")}
                      </DropdownMenuLabel>
                      {createMenuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <DropdownMenuItem
                            key={item.label}
                            className="gap-2 rounded-md text-sm cursor-pointer"
                            style={{ color: "var(--ap-ink)" }}
                            onSelect={item.onClick}
                          >
                            <Icon className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                            {item.label}
                          </DropdownMenuItem>
                        );
                      })}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Account: profile / admin / language / logout, one entry point */}
          {user ? (
            <DropdownMenu open={accountOpen} onOpenChange={setAccountOpen}>
              <DropdownMenuTrigger asChild>
                <button className="ap-avatar-btn" aria-label={user.username} title={user.username}>
                  {avatarInitial}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="z-50 w-52 p-1.5"
                style={{
                  background: "var(--ap-card)",
                  border: "var(--ap-border-w) solid var(--ap-line)",
                  borderRadius: "var(--ap-r-lg)",
                  boxShadow: "var(--ap-shadow-card)",
                }}
              >
                <DropdownMenuLabel
                  className="px-2 py-1.5 text-xs font-bold truncate"
                  style={{ color: "var(--ap-muted)" }}
                >
                  {user.username}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="gap-2 rounded-md text-sm cursor-pointer"
                  style={{ color: "var(--ap-ink)" }}
                  onSelect={() => navigate("/profile")}
                >
                  <User className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                  {t("profile")}
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem
                    className="gap-2 rounded-md text-sm cursor-pointer"
                    style={{ color: "var(--ap-ink)" }}
                    onSelect={() => navigate("/admin")}
                  >
                    <Shield className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                    {t("admin")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator style={{ background: "var(--ap-line)" }} />
                <DropdownMenuLabel
                  className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide"
                  style={{ color: "var(--ap-muted)" }}
                >
                  {t("language")}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="rounded-md text-sm cursor-pointer"
                  style={{ color: "var(--ap-ink)" }}
                  onClick={() => handleLanguageChange("en")}
                >
                  🇬🇧 English
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="rounded-md text-sm cursor-pointer"
                  style={{ color: "var(--ap-ink)" }}
                  onClick={() => handleLanguageChange("fr")}
                >
                  🇫🇷 Français
                </DropdownMenuItem>
                <DropdownMenuSeparator style={{ background: "var(--ap-line)" }} />
                <DropdownMenuItem
                  className="gap-2 rounded-md text-sm cursor-pointer"
                  style={{ color: "var(--ap-ink)" }}
                  onSelect={handleLogout}
                >
                  <LogOut className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
          <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn"
                style={{ padding: "8px 10px" }}
                aria-label="Language"
              >
                <Globe className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="z-50 p-1.5"
              style={{
                background: "var(--ap-card)",
                border: "var(--ap-border-w) solid var(--ap-line)",
                borderRadius: "var(--ap-r-lg)",
                boxShadow: "var(--ap-shadow-card)",
              }}
            >
              <DropdownMenuItem
                className="rounded-md text-sm cursor-pointer"
                style={{ color: "var(--ap-ink)" }}
                onClick={() => handleLanguageChange("en")}
              >
                🇬🇧 English
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-md text-sm cursor-pointer"
                style={{ color: "var(--ap-ink)" }}
                onClick={() => handleLanguageChange("fr")}
              >
                🇫🇷 Français
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className="ap-btn ap-btn--sm"
            onClick={() => navigate("/auth")}
          >
            <User className="h-3.5 w-3.5" />
            {t("login")}
          </button>
          </>
          )}
        </div>
      </div>

      {/* Secondary toolbar row */}
      {toolbar && toolbarPlacement === "secondary" && (
        <div style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)", backgroundColor: "var(--ap-paper)", backgroundImage: "var(--ap-texture)", backgroundSize: "28px 28px" }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2.5">
            {toolbar}
          </div>
        </div>
      )}
      {toolbar && toolbarPlacement === "main" && !alignLeft && (
        <div className="w-full px-6 pb-3 lg:hidden">
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-2.5"
            style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)", backgroundColor: "var(--ap-paper)", backgroundImage: "var(--ap-texture)", backgroundSize: "28px 28px" }}
          >
            {toolbar}
          </div>
        </div>
      )}
    </header>
  );
};
