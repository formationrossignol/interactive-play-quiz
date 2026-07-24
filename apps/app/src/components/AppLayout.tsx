import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, LogOut, Shield, User } from "lucide-react";
import { getCurrentUser, logout } from "@/lib/auth";
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
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BrandMonogram } from "@/components/BrandMonogram";
import { BrandWordmark } from "@/components/BrandWordmark";

interface AppLayoutProps {
  subtitle?: string;
  /** Extra sidebar menu group — passed straight through to AppSidebar, e.g.
   *  Admin's content/moderation/subscribers/settings tabs. */
  extraSection?: ReactNode;
  children: ReactNode;
}

// Topbar + persistent left sidebar shell for authenticated app pages.
// Replaces the old Header.tsx pill nav — account dropdown (profile/admin/
// language/logout) and the --app-header-height CSS var are carried over
// unchanged (the var's only other consumer is theme-innov.css).
export const AppLayout = ({ subtitle, extraSection, children }: AppLayoutProps) => {
  useLanguage();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [user, setUser] = useState(getCurrentUser());
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getLanguage());
  const [accountOpen, setAccountOpen] = useState(false);
  const topBarRef = useRef<HTMLElement | null>(null);

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
    window.location.href = "/";
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setCurrentLanguage(lang);
  };

  useLayoutEffect(() => {
    const updateHeaderHeight = () => {
      const headerHeight = topBarRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty("--app-header-height", `${headerHeight}px`);
    };
    updateHeaderHeight();
    window.addEventListener("resize", updateHeaderHeight);
    return () => window.removeEventListener("resize", updateHeaderHeight);
  }, []);

  void currentLanguage;

  return (
    <SidebarProvider>
      <AppSidebar user={user} extraSection={extraSection} />
      <SidebarInset>
        <header
          ref={(node) => { topBarRef.current = node; }}
          className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3"
          style={{
            borderBottom: "var(--ap-border-w) solid var(--ap-line)",
            backgroundColor: "var(--ap-paper)",
            backgroundImage: "var(--ap-texture)",
            backgroundSize: "28px 28px",
          }}
        >
          <SidebarTrigger />

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

          <div className="ml-auto flex items-center gap-2">
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
                <button className="ap-btn ap-btn--sm" onClick={() => navigate("/auth")}>
                  <User className="h-3.5 w-3.5" />
                  {t("login")}
                </button>
              </>
            )}
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
};
