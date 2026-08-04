import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { GlobalSearch } from "@/components/GlobalSearch";
import { CommandPalette } from "@/components/CommandPalette";
import { BrandMonogram } from "ui/BrandMonogram";
import { BrandWordmark } from "ui/BrandWordmark";
import { Footer } from "@/components/Footer";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { MaterialSymbol } from "@/components/MaterialSymbol";

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
  const location = useLocation();
  useScrollRestoration(`${location.pathname}${location.search}`);
  const { isAdmin } = useIsAdmin();
  const [user, setUser] = useState(getCurrentUser());
  const [currentLanguage, setCurrentLanguage] = useState<Language>(getLanguage());
  const [accountOpen, setAccountOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
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

  return (
    <SidebarProvider className="product-shell-root">
      <AppSidebar user={user} extraSection={extraSection} />
      <SidebarInset className="min-w-0 overflow-x-clip">
        <header
          ref={(node) => { topBarRef.current = node; }}
          className="product-topbar"
        >
          <SidebarTrigger />

          <button
            type="button"
            className="product-topbar__brand"
            onClick={() => (user ? navigate("/dashboard") : (window.location.href = "/"))}
            title={subtitle}
            aria-label={subtitle ? `Brivia — ${subtitle}` : "Brivia"}
          >
            <BrandMonogram size={22} />
            <BrandWordmark size={19} />
          </button>

          <div className="product-topbar__context">
            <strong>{subtitle || t("dashboard")}</strong>
            <span>Brivia workspace</span>
          </div>

          <div className="product-topbar__actions">
            <GlobalSearch user={user} />
            <div className="product-topbar__icons">
            <button
              type="button"
              className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn product-topbar__command"
              style={{ height: 38, width: 38, padding: 0 }}
              aria-label={`${t("commandPaletteOpen")} (${navigator.platform.includes("Mac") ? "⌘" : "Ctrl+"}K)`}
              title={`${t("commandPaletteOpen")} (${navigator.platform.includes("Mac") ? "⌘K" : "Ctrl+K"})`}
              onClick={() => setPaletteOpen(true)}
            >
              <MaterialSymbol name="terminal" size={20} />
            </button>
            {user && <NotificationCenter user={user} />}
            {user ? (
              <DropdownMenu open={accountOpen} onOpenChange={setAccountOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="ap-avatar-btn" aria-label={user.username} title={user.username}>
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt="" className="ap-avatar-btn__img" />
                      : avatarInitial}
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
                    <MaterialSymbol name="person" size={20} style={{ color: "var(--ap-muted)" }} />
                    {t("profile")}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem
                      className="gap-2 rounded-md text-sm cursor-pointer"
                      style={{ color: "var(--ap-ink)" }}
                      onSelect={() => navigate("/admin")}
                    >
                      <MaterialSymbol name="admin_panel_settings" size={20} style={{ color: "var(--ap-muted)" }} />
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
                    className="gap-2 rounded-md text-sm cursor-pointer"
                    style={{ color: "var(--ap-ink)" }}
                    onClick={() => handleLanguageChange("en")}
                  >
                    <MaterialSymbol name="language" size={18} style={{ color: "var(--ap-muted)" }} />
                    English
                    {currentLanguage === "en" && <MaterialSymbol name="check" size={18} className="ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 rounded-md text-sm cursor-pointer"
                    style={{ color: "var(--ap-ink)" }}
                    onClick={() => handleLanguageChange("fr")}
                  >
                    <MaterialSymbol name="language" size={18} style={{ color: "var(--ap-muted)" }} />
                    Français
                    {currentLanguage === "fr" && <MaterialSymbol name="check" size={18} className="ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator style={{ background: "var(--ap-line)" }} />
                  <DropdownMenuItem
                    className="gap-2 rounded-md text-sm cursor-pointer"
                    style={{ color: "var(--ap-ink)" }}
                    onSelect={handleLogout}
                  >
                    <MaterialSymbol name="logout" size={20} style={{ color: "var(--ap-muted)" }} />
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
                      <MaterialSymbol name="language" size={20} />
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
                      className="gap-2 rounded-md text-sm cursor-pointer"
                      style={{ color: "var(--ap-ink)" }}
                      onClick={() => handleLanguageChange("en")}
                    >
                      <MaterialSymbol name="language" size={18} style={{ color: "var(--ap-muted)" }} />
                      English
                      {currentLanguage === "en" && <MaterialSymbol name="check" size={18} className="ml-auto" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 rounded-md text-sm cursor-pointer"
                      style={{ color: "var(--ap-ink)" }}
                      onClick={() => handleLanguageChange("fr")}
                    >
                      <MaterialSymbol name="language" size={18} style={{ color: "var(--ap-muted)" }} />
                      Français
                      {currentLanguage === "fr" && <MaterialSymbol name="check" size={18} className="ml-auto" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button className="ap-btn ap-btn--sm" onClick={() => navigate("/auth")}>
                  <MaterialSymbol name="login" size={18} />
                  {t("login")}
                </button>
              </>
            )}
            </div>
          </div>
        </header>

        <div className="product-content">
          <main className="product-main">{children}</main>
          <Footer />
        </div>
      </SidebarInset>

      <CommandPalette user={user} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </SidebarProvider>
  );
};
