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
  ChevronDown,
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
    window.location.reload();
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

  // Suppress unused variable warning — kept intentionally for re-render reactivity
  void currentLanguage;

  return (
    <header
      ref={(node) => { headerRef.current = node; }}
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-100"
    >
      <div
        className={cn(
          "flex items-center px-6 py-4",
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-xl text-slate-900 leading-none">{t("quizMaster")}</span>
            {subtitle && (
              <p className="text-xs text-slate-400 font-medium mt-0.5">{subtitle}</p>
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
          <nav className="hidden md:flex flex-1 items-center justify-center gap-1">
            {primaryNavigationItems
              .filter((item) => (item.requiresAuth ? Boolean(user) : true))
              .map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {item.label}
                </button>
              ))}

            {availableCreationItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer">
                    <Layers className="h-4 w-4" />
                    {t("myCreations")}
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-50 w-52 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg">
                  {availableCreationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.label}
                        className="gap-2 rounded-lg text-sm text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
                        onSelect={item.onClick}
                      >
                        <Icon className="h-4 w-4 text-slate-400" />
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>
        )}

        {/* Right actions */}
        <div className={cn("flex items-center gap-2", alignLeft && "ml-auto")}>
          {/* Mobile menu */}
          {showNavigation && (
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-slate-200">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-50 w-56 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg">
                  {primaryNavigationItems
                    .filter((item) => (item.requiresAuth ? Boolean(user) : true))
                    .map((item) => (
                      <DropdownMenuItem
                        key={item.label}
                        className="rounded-lg text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                        onSelect={item.onClick}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  {availableCreationItems.length > 0 && (
                    <>
                      <DropdownMenuSeparator className="bg-slate-100" />
                      <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        {t("myCreations")}
                      </DropdownMenuLabel>
                      {availableCreationItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <DropdownMenuItem
                            key={item.label}
                            className="gap-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                            onSelect={item.onClick}
                          >
                            <Icon className="h-4 w-4 text-slate-400" />
                            {item.label}
                          </DropdownMenuItem>
                        );
                      })}
                    </>
                  )}
                  {user && (
                    <DropdownMenuItem
                      className="gap-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                      onSelect={() => navigate("/profile")}
                    >
                      <User className="h-4 w-4 text-slate-400" />
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
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              >
                <Globe className="h-4 w-4" />
                <span className="sr-only">Language</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="z-50 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg">
              <DropdownMenuItem
                className="rounded-lg text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                onClick={() => handleLanguageChange("en")}
              >
                🇬🇧 English
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-lg text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                onClick={() => handleLanguageChange("fr")}
              >
                🇫🇷 Français
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Auth */}
          {user ? (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate("/profile")}
                className="h-9 w-9 rounded-lg border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                title={user.username}
              >
                <User className="h-4 w-4" />
                <span className="sr-only">{t("profile")}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-9 w-9 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                title={t("logout")}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">{t("logout")}</span>
              </Button>
            </>
          ) : (
            <Button
              onClick={() => navigate("/auth")}
              className="h-9 rounded-lg bg-indigo-600 text-white text-sm font-semibold px-4 hover:bg-indigo-700 transition-colors"
            >
              <User className="mr-1.5 h-3.5 w-3.5" />
              {t("login")}
            </Button>
          )}
        </div>
      </div>

      {/* Secondary toolbar row */}
      {toolbar && toolbarPlacement === "secondary" && (
        <div className="border-t border-slate-100 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2.5">
            {toolbar}
          </div>
        </div>
      )}
      {toolbar && toolbarPlacement === "main" && !alignLeft && (
        <div className="w-full px-6 pb-3 lg:hidden">
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-white px-4 py-2.5">
            {toolbar}
          </div>
        </div>
      )}
    </header>
  );
};
