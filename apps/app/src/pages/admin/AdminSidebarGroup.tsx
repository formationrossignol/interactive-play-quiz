import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { MaterialSymbol } from "@/components/MaterialSymbol";

export type AdminSection = "content" | "moderation" | "subscribers" | "users" | "revenue" | "settings";

export interface AdminNavItem {
  key: AdminSection;
  icon: string;
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
// nav, with the same live badge counts and one entry point for navigation.
export const AdminSidebarGroup = ({ section, setSection, nav }: AdminSidebarGroupProps) => (
  <SidebarGroup>
    <SidebarGroupLabel>Administration</SidebarGroupLabel>
    <SidebarMenu>
      {nav.map((item) => {
        return (
          <SidebarMenuItem key={item.key}>
            <SidebarMenuButton isActive={section === item.key} onClick={() => setSection(item.key)}>
              <MaterialSymbol name={item.icon} size={20} />
              <span>{item.label}</span>
            </SidebarMenuButton>
            {item.key !== "settings" && item.key !== "revenue" && (
              <SidebarMenuBadge style={item.alert && section !== item.key ? { color: "var(--ap-danger)" } : undefined}>
                {item.count}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  </SidebarGroup>
);
