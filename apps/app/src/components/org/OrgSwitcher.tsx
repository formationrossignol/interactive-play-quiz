import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { myOrgMemberships, type OrgMembership } from "@/lib/org/orgRepo";

const ACTIVE_ORG_KEY = "quiz_active_org_id";
const ACTIVE_ORG_EVENT = "brivia:active-org-change";

export function useActiveOrgId(memberships: OrgMembership[]): [string | null, (id: string) => void] {
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(() => localStorage.getItem(ACTIVE_ORG_KEY));

  useEffect(() => {
    if (memberships.length === 0) return;
    if (!activeOrgId || !memberships.some((m) => m.org_id === activeOrgId)) {
      const fallbackId = memberships[0].org_id;
      localStorage.setItem(ACTIVE_ORG_KEY, fallbackId);
      setActiveOrgIdState(fallbackId);
    }
  }, [memberships, activeOrgId]);

  useEffect(() => {
    const syncActiveOrg = (event: Event) => {
      const nextId = event instanceof CustomEvent
        ? String(event.detail ?? "")
        : localStorage.getItem(ACTIVE_ORG_KEY) ?? "";
      if (nextId && memberships.some((membership) => membership.org_id === nextId)) {
        setActiveOrgIdState(nextId);
      }
    };
    window.addEventListener(ACTIVE_ORG_EVENT, syncActiveOrg);
    window.addEventListener("storage", syncActiveOrg);
    return () => {
      window.removeEventListener(ACTIVE_ORG_EVENT, syncActiveOrg);
      window.removeEventListener("storage", syncActiveOrg);
    };
  }, [memberships]);

  const setActiveOrgId = (id: string) => {
    localStorage.setItem(ACTIVE_ORG_KEY, id);
    setActiveOrgIdState(id);
    window.dispatchEvent(new CustomEvent(ACTIVE_ORG_EVENT, { detail: id }));
  };

  return [activeOrgId, setActiveOrgId];
}

export function OrgSwitcher() {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [activeOrgId, setActiveOrgId] = useActiveOrgId(memberships);

  useEffect(() => {
    myOrgMemberships().then(setMemberships).catch(() => setMemberships([]));
  }, []);

  if (memberships.length === 0) return null;

  const active = memberships.find((m) => m.org_id === activeOrgId) ?? memberships[0];

  // A single org still deserves a visible "you are here" — only the picker
  // (and its dropdown chrome) needs 2+ orgs to make sense.
  if (memberships.length === 1) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="Votre organisation">
          <MaterialSymbol name="domain" size={20} />
          <span>{active.organizations.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton>
            <MaterialSymbol name="domain" size={20} />
            <span>{active.organizations.name}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {memberships.map((m) => (
            <DropdownMenuItem key={m.org_id} onClick={() => setActiveOrgId(m.org_id)}>
              {m.organizations.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
