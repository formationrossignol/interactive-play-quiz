import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export type AdminSection = "content" | "moderation" | "subscribers" | "settings";

export interface AdminNavItem {
  key: AdminSection;
  icon: React.ElementType;
  label: string;
  count: number;
  alert?: boolean;
}

interface AdminSidebarGroupProps {
  section: AdminSection;
  setSection: (section: AdminSection) => void;
  nav: AdminNavItem[];
}

// Admin's own content/moderation/subscribers/settings tabs, rehosted as an
// extra group in the shared AppSidebar instead of Admin.tsx's own .adm-rail
// nav — same live badge counts, just one entry point for navigation.
export const AdminSidebarGroup = ({ section, setSection, nav }: AdminSidebarGroupProps) => (
  <SidebarGroup>
    <SidebarGroupLabel>Administration</SidebarGroupLabel>
    <SidebarMenu>
      {nav.map((item) => {
        const Icon = item.icon;
        return (
          <SidebarMenuItem key={item.key}>
            <SidebarMenuButton isActive={section === item.key} onClick={() => setSection(item.key)}>
              <Icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
            {item.key !== "settings" && (
              <SidebarMenuBadge style={item.alert && section !== item.key ? { color: "var(--ap-quiz)" } : undefined}>
                {item.count}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  </SidebarGroup>
);
