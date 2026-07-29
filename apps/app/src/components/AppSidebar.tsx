import { type ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { t } from "@/lib/i18n";
import type { User as AuthUser } from "@/lib/auth";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { OrgSwitcher } from "@/components/org/OrgSwitcher";
import { myOrgMemberships } from "@/lib/org/orgRepo";
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
  { label: t("navCreateQuiz"), icon: "quiz", path: "/builder-start?type=quiz" },
  { label: t("navCreatePoll"), icon: "poll", path: "/builder-start?type=poll" },
  { label: t("createFlashcards"), icon: "style", path: "/builder-start?type=flashcard" },
  { label: t("createSlides"), icon: "co_present", path: "/builder-start?type=slide" },
  { label: t("createCourse"), icon: "school", path: "/course-builder" },
  { label: t("createLearningPath"), icon: "route", path: "/learning-path-builder" },
  { label: t("createExam"), icon: "assignment", path: "/exam-builder" },
];

// Same 6 routes ContentExplorer.tsx's (now-removed) TYPE_TABS used to link to
// — content-type switching moved from an in-page tab strip into this submenu.
export const CREATIONS_ITEMS = [
  { label: t("creationTypeQuiz"), path: "/my-quizzes" },
  { label: t("creationTypePoll"), path: "/my-polls" },
  { label: t("creationTypeFlashcard"), path: "/my-flashcards" },
  { label: t("creationTypeSlide"), path: "/my-slides" },
  { label: t("creationTypeCourse"), path: "/my-courses" },
  { label: t("creationTypeLearningPath"), path: "/my-learning-paths" },
  { label: t("creationTypeExam"), path: "/my-exams" },
];

// Collaboration/grading tools — niche, auth-only workflows split out of the
// old single "Explore" group so they can collapse away for users who never
// touch groups/signatures/grading (was 9 items deep, always expanded).
export const COLLAB_ITEMS = [
  { label: t("navSharedWithMe"), icon: "group_share", path: "/shared-with-me" },
  { label: t("navGroups"), icon: "groups", path: "/groups" },
  { label: t("navSignatures"), icon: "draw", path: "/signatures" },
  { label: t("navManualGrading"), icon: "edit_note", path: "/grading" },
  { label: t("navMyGrades"), icon: "grading", path: "/my-grades" },
  { label: t("questionBank"), icon: "library_books", path: "/question-bank" },
];

// Public discovery — no auth required, kept short and always visible.
export const DISCOVER_ITEMS = [
  { label: t("discoverPublic"), icon: "explore", path: "/discover", requiresAuth: false },
  { label: t("footerCommunity"), icon: "groups", path: "/community", requiresAuth: false },
  { label: t("navTools"), icon: "casino", path: "/tools", requiresAuth: false },
];

// Personal account shortcuts — was bundled with Support under one "Produit"
// label; split so each group name matches what it actually contains.
export const ACCOUNT_ITEMS = [
  { label: "Notifications", icon: "notifications", path: "/notifications" },
  { label: "Historique", icon: "history", path: "/history" },
];

export const SUPPORT_ITEMS = [
  { label: "Centre d’aide", icon: "help", path: "/help", requiresAuth: false },
  { label: "Roadmap", icon: "map", path: "/roadmap", requiresAuth: false },
  { label: "Nouveautés", icon: "campaign", path: "/changelog", requiresAuth: false },
  { label: "Signaler un problème", icon: "support_agent", path: "/report", requiresAuth: false },
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
  // Collaboration is niche (groups/signatures/grading) — collapsed by default
  // unless the current route already lives inside it.
  const [collabOpen, setCollabOpen] = useState(
    () => COLLAB_ITEMS.some((item) => item.path === location.pathname),
  );
  // React Query caches this across route changes — AppSidebar remounts on
  // every navigation (see AppLayout), so a plain useEffect was refetching
  // org memberships on every single page load.
  const { data: orgMemberships } = useQuery({
    queryKey: ["org", "memberships", user?.id],
    queryFn: myOrgMemberships,
    enabled: Boolean(user),
  });
  const isOrgAdmin = orgMemberships?.some((m) => m.role === "admin") ?? false;

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
                      <MaterialSymbol name="add" size={20} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center">
                    {t("createNew")}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <button className="ap-btn ap-btn--sm" style={{ width: "100%", justifyContent: "space-between" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <MaterialSymbol name="add" size={20} />
                    {t("createNew")}
                  </span>
                  <MaterialSymbol name="keyboard_arrow_down" size={20} className="chevron-icon" />
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
                <MaterialSymbol name="close" size={20} />
              </button>
              {CREATE_ITEMS.map((item) => {
                return (
                  <DropdownMenuItem
                    key={item.label}
                    className="gap-2 rounded-md text-sm cursor-pointer"
                    style={{ color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)" }}
                    onSelect={() => navigate(item.path)}
                  >
                    <MaterialSymbol name={item.icon} size={20} style={{ color: "var(--ap-muted)" }} />
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
                  <MaterialSymbol name="dashboard" size={20} />
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
                      <MaterialSymbol name="category" size={20} />
                      <span>{t("myCreations")}</span>
                      {!collapsedIcon && (
                        <MaterialSymbol
                          name="keyboard_arrow_down"
                          size={20}
                          className="chevron-icon ml-auto"
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

        {user && (
          <SidebarGroup>
            <Collapsible open={collabOpen || collapsedIcon} onOpenChange={setCollabOpen}>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer">
                  <span>{t("navGroupCollab")}</span>
                  {!collapsedIcon && (
                    <MaterialSymbol
                      name="keyboard_arrow_down"
                      size={16}
                      className="chevron-icon"
                      style={{ transform: collabOpen ? "rotate(180deg)" : undefined }}
                    />
                  )}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarMenu>
                  {COLLAB_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={location.pathname === item.path}
                        onClick={() => navigate(item.path)}
                        tooltip={item.label}
                      >
                        <MaterialSymbol name={item.icon} size={20} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>{t("navGroupDiscover")}</SidebarGroupLabel>
          <SidebarMenu>
            {DISCOVER_ITEMS.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  isActive={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                  tooltip={item.label}
                >
                  <MaterialSymbol name={item.icon} size={20} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {user && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("navGroupAccount")}</SidebarGroupLabel>
            <SidebarMenu>
              {ACCOUNT_ITEMS.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    tooltip={item.label}
                  >
                    <MaterialSymbol name={item.icon} size={20} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>{t("navGroupSupport")}</SidebarGroupLabel>
          <SidebarMenu>
            {SUPPORT_ITEMS.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  isActive={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                  tooltip={item.label}
                >
                  <MaterialSymbol name={item.icon} size={20} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {extraSection}
      </SidebarContent>

      {user && (
        <SidebarFooter>
          <SidebarSeparator />
          <SidebarMenu>
            <OrgSwitcher />
            {isOrgAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === "/org/invitations"}
                  onClick={() => navigate("/org/invitations")}
                  tooltip="Organisation"
                >
                  <MaterialSymbol name="domain" size={20} />
                  <span>Organisation</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={location.pathname === "/profile"}
                onClick={() => navigate("/profile")}
                tooltip={t("settings")}
              >
                <MaterialSymbol name="settings" size={20} />
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
