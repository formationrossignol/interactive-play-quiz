import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Plus, Settings } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { t } from "@/lib/i18n";
import type { User as AuthUser } from "@/lib/auth";
import { CREATE_ITEMS, CREATIONS_ITEMS, EXPLORE_ITEMS, PRODUCT_ITEMS } from "@/components/AppSidebar";
import { TYPE_META } from "@/components/GlobalSearch";
import { getSearchResultRoute, searchContent, type SearchResult } from "@/lib/content/searchContent";

interface CommandPaletteProps {
  user: AuthUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// REQ-UX-006: Ctrl/Cmd+K palette to jump to any page, creation action, or
// piece of content. Reuses the same nav data as AppSidebar and the same
// content search as GlobalSearch rather than re-declaring either. Open state
// is controlled by the caller so a visible header button can trigger it too.
export const CommandPalette = ({ user, open, onOpenChange: setOpen }: CommandPaletteProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!user || trimmed.length < 2) { setResults([]); return; }
    const thisRequestId = ++requestIdRef.current;
    const handle = setTimeout(() => {
      searchContent(user.id, trimmed)
        .then((found) => { if (requestIdRef.current === thisRequestId) setResults(found); })
        .catch(() => { if (requestIdRef.current === thisRequestId) setResults([]); });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, user]);

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("commandPalettePlaceholder")}
      />
      <CommandList>
        <CommandEmpty>{t("commandPaletteEmpty")}</CommandEmpty>

        {user && (
          <CommandGroup heading={t("commandPaletteNavGroup")}>
            <CommandItem value="dashboard" onSelect={() => go("/dashboard")}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {t("dashboard")}
            </CommandItem>
            {CREATIONS_ITEMS.map((item) => (
              <CommandItem key={item.path} value={item.label} onSelect={() => go(item.path)}>
                <span className="ml-6">{item.label}</span>
              </CommandItem>
            ))}
            {EXPLORE_ITEMS.filter((item) => (item.requiresAuth ? Boolean(user) : true)).map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.path} value={item.label} onSelect={() => go(item.path)}>
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </CommandItem>
              );
            })}
            {PRODUCT_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.path} value={item.label} onSelect={() => go(item.path)}>
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </CommandItem>
              );
            })}
            <CommandItem value={t("settings")} onSelect={() => go("/profile")}>
              <Settings className="mr-2 h-4 w-4" />
              {t("settings")}
            </CommandItem>
          </CommandGroup>
        )}

        {user && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("commandPaletteCreateGroup")}>
              {CREATE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem key={item.path} value={item.label} onSelect={() => go(item.path)}>
                    <Plus className="mr-2 h-3.5 w-3.5 opacity-50" />
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {results.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("commandPaletteContentGroup")}>
              {results.map((result) => {
                const meta = TYPE_META[result.type];
                const Icon = meta.icon;
                return (
                  <CommandItem
                    key={result.rowId}
                    value={`${result.title || t("untitled")} ${result.rowId}`}
                    onSelect={() => go(getSearchResultRoute(result.type, result.itemId))}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span className="flex-1 truncate">{result.title || t("untitled")}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{t(meta.labelKey)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
