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
  Menu,
  Layers,
  Library,
  GraduationCap,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { getLanguage, setLanguage, t, type Language } from "@/lib/i18n";
import { useLanguage } from "@/hooks/useLanguage";
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
  useLanguage();
  const [user, setUser] = useState(getCurrentUser());
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getLanguage());
  const headerRef = useRef<HTMLElement | null>(null);

  const primaryNavigationItems = [
    { label: t("home"), onClick: () => navigate("/"), requiresAuth: false },
    { label: t("features"), onClick: () => navigate("/features"), requiresAuth: false },
    { label: t("pricing"), onClick: () => navigate("/pricing"), requiresAuth: false },
    { label: t("footerAbout"), onClick: () => navigate("/about"), requiresAuth: false },
    { label: t("footerContact"), onClick: () => navigate("/contact"), requiresAuth: false },
  ];

  const creationMenuItems = [
    { label: t("myQuizzes"), icon: BookOpen, onClick: () => navigate("/my-quizzes"), requiresAuth: true },
    { label: t("myPolls"), icon: BarChart3, onClick: () => navigate("/my-polls"), requiresAuth: true },
    { label: t("myFlashcards"), icon: Layers, onClick: () => navigate("/my-flashcards"), requiresAuth: true },
    { label: t("myCourses"), icon: GraduationCap, onClick: () => navigate("/my-courses"), requiresAuth: true },
    { label: "Mes examens", icon: Library, onClick: () => navigate("/my-exams"), requiresAuth: true },
    { label: t("questionBank"), icon: Library, onClick: () => navigate("/question-bank"), requiresAuth: true },
  ];

  const availableCreationItems = creationMenuItems.filter((item) =>
    item.requiresAuth ? Boolean(user) : true
  );

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
        borderBottom: "2px solid var(--ap-line)",
        boxShadow: "0 2px 0 var(--ap-line)",
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
          onClick={() => navigate("/")}
        >
          <span className="ap-logo">
            <svg viewBox="0 0 24 24"><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"/></svg>
          </span>
          <div>
            <span className="ap-brandname" style={{ fontSize: "20px" }}>{t("quizMaster")}</span>
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

            {availableCreationItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ap-nav-pill__item flex items-center gap-1.5">
                    <Layers className="h-4 w-4" />
                    {t("myCreations")}
                    <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--ap-muted)" }} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="z-50 w-52 p-1.5"
                  style={{
                    background: "var(--ap-card)",
                    border: "2px solid var(--ap-line)",
                    borderRadius: "var(--ap-r-lg)",
                    boxShadow: "var(--ap-shadow-card)",
                  }}
                >
                  {availableCreationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.label}
                        className="gap-2 rounded-xl text-sm cursor-pointer"
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

        {/* Right actions */}
        <div className={cn("flex items-center gap-2", alignLeft && "ml-auto")}>
          {/* Mobile menu */}
          {showNavigation && (
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="ap-btn ap-btn--ghost ap-btn--sm"
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
                    border: "2px solid var(--ap-line)",
                    borderRadius: "var(--ap-r-lg)",
                    boxShadow: "var(--ap-shadow-card)",
                  }}
                >
                  {primaryNavigationItems
                    .filter((item) => (item.requiresAuth ? Boolean(user) : true))
                    .map((item) => (
                      <DropdownMenuItem
                        key={item.label}
                        className="rounded-xl text-sm cursor-pointer"
                        style={{ color: "var(--ap-ink)" }}
                        onSelect={item.onClick}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  {availableCreationItems.length > 0 && (
                    <>
                      <DropdownMenuSeparator style={{ background: "var(--ap-line)" }} />
                      <DropdownMenuLabel
                        className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide"
                        style={{ color: "var(--ap-muted)" }}
                      >
                        {t("myCreations")}
                      </DropdownMenuLabel>
                      {availableCreationItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <DropdownMenuItem
                            key={item.label}
                            className="gap-2 rounded-xl text-sm cursor-pointer"
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
                  {user && (
                    <DropdownMenuItem
                      className="gap-2 rounded-xl text-sm cursor-pointer"
                      style={{ color: "var(--ap-ink)" }}
                      onSelect={() => navigate("/profile")}
                    >
                      <User className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                      {t("profile")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Language switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="ap-btn ap-btn--ghost ap-btn--sm"
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
                border: "2px solid var(--ap-line)",
                borderRadius: "var(--ap-r-lg)",
                boxShadow: "var(--ap-shadow-card)",
              }}
            >
              <DropdownMenuItem
                className="rounded-xl text-sm cursor-pointer"
                style={{ color: "var(--ap-ink)" }}
                onClick={() => handleLanguageChange("en")}
              >
                🇬🇧 English
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl text-sm cursor-pointer"
                style={{ color: "var(--ap-ink)" }}
                onClick={() => handleLanguageChange("fr")}
              >
                🇫🇷 Français
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Auth */}
          {user ? (
            <>
              <button
                className="ap-btn ap-btn--ghost ap-btn--sm"
                style={{ padding: "8px 10px" }}
                onClick={() => navigate("/profile")}
                title={user.username}
              >
                <User className="h-4 w-4" />
              </button>
              <button
                className="ap-btn ap-btn--ghost ap-btn--sm"
                style={{ padding: "8px 10px" }}
                onClick={handleLogout}
                title={t("logout")}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              className="ap-btn ap-btn--sm"
              onClick={() => navigate("/auth")}
            >
              <User className="h-3.5 w-3.5" />
              {t("login")}
            </button>
          )}
        </div>
      </div>

      {/* Secondary toolbar row */}
      {toolbar && toolbarPlacement === "secondary" && (
        <div style={{ borderTop: "2px solid var(--ap-line)", backgroundColor: "var(--ap-paper)" }}>
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2.5">
            {toolbar}
          </div>
        </div>
      )}
      {toolbar && toolbarPlacement === "main" && !alignLeft && (
        <div className="w-full px-6 pb-3 lg:hidden">
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-2.5"
            style={{ borderTop: "2px solid var(--ap-line)", backgroundColor: "var(--ap-paper)" }}
          >
            {toolbar}
          </div>
        </div>
      )}
    </header>
  );
};
