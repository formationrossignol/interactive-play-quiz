import { type ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ClipboardList,
  Compass,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Library,
  Plus,
  Presentation,
  Settings,
  Users,
  X,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { User as AuthUser } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// "+ Créer" jumps straight into a builder's start flow — moved here from the
// old Header.tsx pill nav, not duplicated.
const CREATE_ITEMS = [
  { label: t("navCreateQuiz"), icon: BookOpen, path: "/builder-start?type=quiz" },
  { label: t("navCreatePoll"), icon: BarChart3, path: "/builder-start?type=poll" },
  { label: t("createFlashcards"), icon: Layers, path: "/builder-start?type=flashcard" },
  { label: t("createSlides"), icon: Presentation, path: "/builder-start?type=slide" },
  { label: t("createCourse"), icon: GraduationCap, path: "/course-builder" },
  { label: t("createExam"), icon: ClipboardList, path: "/exam-builder" },
];

const NAV_ITEMS = [
  { label: t("dashboard"), icon: LayoutDashboard, path: "/my-quizzes", requiresAuth: true },
  { label: t("questionBank"), icon: Library, path: "/question-bank", requiresAuth: true },
  { label: t("discoverPublic"), icon: Compass, path: "/discover", requiresAuth: false },
  { label: t("footerCommunity"), icon: Users, path: "/community", requiresAuth: false },
  { label: t("settings"), icon: Settings, path: "/profile", requiresAuth: true },
];

interface AppSidebarProps {
  user: AuthUser | null;
  /** Extra menu group rendered below the main nav — e.g. Admin's own
   *  content/moderation/subscribers/settings tabs. */
  extraSection?: ReactNode;
}

export const AppSidebar = ({ user, extraSection }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Sidebar>
      {user && (
        <SidebarHeader>
          <DropdownMenu open={createOpen} onOpenChange={setCreateOpen}>
            <DropdownMenuTrigger asChild>
              <button className="ap-btn ap-btn--sm" style={{ width: "100%", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Plus className="h-4 w-4" />
                  {t("createNew")}
                </span>
                <ChevronDown className="chevron-icon h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="z-50 w-56 p-1.5 ap-mega-menu"
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
                onClick={() => setCreateOpen(false)}
              >
                <X />
              </button>
              {CREATE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={item.label}
                    className="gap-2 rounded-md text-sm cursor-pointer"
                    style={{ color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)" }}
                    onSelect={() => navigate(item.path)}
                  >
                    <Icon className="h-4 w-4" style={{ color: "var(--ap-muted)" }} />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarHeader>
      )}

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.filter((item) => (item.requiresAuth ? Boolean(user) : true)).map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
        {extraSection}
      </SidebarContent>
    </Sidebar>
  );
};
