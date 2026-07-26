import { type ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ClipboardList,
  Compass,
  Dices,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Library,
  Plus,
  Presentation,
  Settings,
  Share2,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

// "+ Créer" jumps straight into a builder's start flow — moved here from the
// old Header.tsx pill nav, not duplicated.
export const CREATE_ITEMS = [
  { label: t("navCreateQuiz"), icon: BookOpen, path: "/builder-start?type=quiz" },
  { label: t("navCreatePoll"), icon: BarChart3, path: "/builder-start?type=poll" },
  { label: t("createFlashcards"), icon: Layers, path: "/builder-start?type=flashcard" },
  { label: t("createSlides"), icon: Presentation, path: "/builder-start?type=slide" },
  { label: t("createCourse"), icon: GraduationCap, path: "/course-builder" },
  { label: t("createExam"), icon: ClipboardList, path: "/exam-builder" },
];

// Same 6 routes ContentExplorer.tsx's (now-removed) TYPE_TABS used to link to
// — content-type switching moved from an in-page tab strip into this submenu.
export const CREATIONS_ITEMS = [
  { label: t("creationTypeQuiz"), path: "/my-quizzes" },
  { label: t("creationTypePoll"), path: "/my-polls" },
  { label: t("creationTypeFlashcard"), path: "/my-flashcards" },
  { label: t("creationTypeSlide"), path: "/my-slides" },
  { label: t("creationTypeCourse"), path: "/my-courses" },
  { label: t("creationTypeExam"), path: "/my-exams" },
];

// Discovery/social — secondary to the Dashboard + Mes créations workflow,
// grouped under its own labelled section per sidebar UX best practices
// (group related items, keep primary actions visually distinct).
export const EXPLORE_ITEMS = [
  { label: t("navSharedWithMe"), icon: Share2, path: "/shared-with-me", requiresAuth: true },
  { label: t("questionBank"), icon: Library, path: "/question-bank", requiresAuth: true },
  { label: t("discoverPublic"), icon: Compass, path: "/discover", requiresAuth: false },
  { label: t("footerCommunity"), icon: Users, path: "/community", requiresAuth: false },
  { label: t("navTools"), icon: Dices, path: "/tools", requiresAuth: false },
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
  const { state, isMobile } = useSidebar();
  const collapsedIcon = state === "collapsed" && !isMobile;
  const [createOpen, setCreateOpen] = useState(false);
  // Lazy init re-runs fresh on every mount — correct today because AppSidebar
  // remounts on every route change (each page instantiates its own AppLayout).
  // If routing ever moves to a persistent shared-layout wrapper, this would
  // need to become a useEffect keyed on location.pathname instead.
  const [creationsOpen, setCreationsOpen] = useState(
    () => CREATIONS_ITEMS.some((item) => item.path === location.pathname),
  );

  return (
    <Sidebar collapsible="icon">
      {user && (
        <SidebarHeader>
          <DropdownMenu open={createOpen} onOpenChange={setCreateOpen}>
            <DropdownMenuTrigger asChild>
              {collapsedIcon ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="ap-btn ap-btn--sm ap-icon-btn" aria-label={t("createNew")}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center">
                    {t("createNew")}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <button className="ap-btn ap-btn--sm" style={{ width: "100%", justifyContent: "space-between" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Plus className="h-4 w-4" />
                    {t("createNew")}
                  </span>
                  <ChevronDown className="chevron-icon h-3.5 w-3.5" />
                </button>
              )}
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
            {user && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === "/dashboard"}
                  onClick={() => navigate("/dashboard")}
                  tooltip={t("dashboard")}
                >
                  <LayoutDashboard />
                  <span>{t("dashboard")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {user && (
              <Collapsible open={creationsOpen && !collapsedIcon} onOpenChange={setCreationsOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      // Collapsed to icon rail: a flyout submenu is unbuilt scope,
                      // so the trigger becomes a direct shortcut to My quizzes —
                      // avoids a dead click that silently does nothing.
                      isActive={collapsedIcon && CREATIONS_ITEMS.some((item) => item.path === location.pathname)}
                      onClick={collapsedIcon ? () => navigate(CREATIONS_ITEMS[0].path) : undefined}
                      tooltip={t("myCreations")}
                    >
                      <FolderOpen />
                      <span>{t("myCreations")}</span>
                      {!collapsedIcon && (
                        <ChevronDown
                          className="chevron-icon ml-auto h-3.5 w-3.5"
                          style={{ transform: creationsOpen ? "rotate(180deg)" : undefined }}
                        />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {CREATIONS_ITEMS.map((item) => (
                        <SidebarMenuSubItem key={item.path}>
                          <SidebarMenuSubButton
                            href={item.path}
                            isActive={location.pathname === item.path}
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(item.path);
                            }}
                          >
                            <span>{item.label}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("navGroupExplore")}</SidebarGroupLabel>
          <SidebarMenu>
            {EXPLORE_ITEMS.filter((item) => (item.requiresAuth ? Boolean(user) : true)).map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    tooltip={item.label}
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

      {user && (
        <SidebarFooter>
          <SidebarSeparator />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={location.pathname === "/profile"}
                onClick={() => navigate("/profile")}
                tooltip={t("settings")}
              >
                <Settings />
                <span>{t("settings")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
};
