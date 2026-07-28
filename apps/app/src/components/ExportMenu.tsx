import { useId, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ExportMenuOption {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void | Promise<void>;
}

interface ExportMenuProps {
  options: ExportMenuOption[];
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  align?: "start" | "center" | "end";
  disabledReason?: string;
}

export function ExportMenu({
  options,
  disabled = false,
  className = "ap-btn ap-btn--ghost ap-btn--sm",
  style,
  align = "end",
  disabledReason,
}: ExportMenuProps) {
  const reasonId = useId();
  const unavailable = disabled || options.length === 0;
  const reason = unavailable
    ? disabledReason ?? (options.length === 0 ? "Ajoutez au moins une ressource pour exporter." : "Cette action n’est pas encore disponible.")
    : undefined;

  return (
    <div className="inline-flex flex-col items-end gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={className}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, ...style }}
            disabled={unavailable}
            aria-describedby={reason ? reasonId : undefined}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exporter
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          style={{
            minWidth: 210,
            padding: 6,
            background: "var(--ap-card)",
            border: "var(--ap-border-w) solid var(--ap-line)",
            borderRadius: "var(--ap-r-md)",
            boxShadow: "var(--ap-shadow-card)",
          }}
        >
          {options.map(({ id, label, icon: Icon, onSelect }) => (
            <DropdownMenuItem
              key={id}
              className="flex cursor-pointer items-center gap-2.5 text-sm"
              style={{ padding: "9px 10px", color: "var(--ap-ink)" }}
              onSelect={() => { void onSelect(); }}
            >
              <Icon className="h-4 w-4" style={{ color: "var(--ap-muted)" }} aria-hidden="true" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {reason && (
        <p id={reasonId} className="m-0 max-w-72 text-right text-xs font-semibold leading-snug text-muted-foreground">
          {reason}
        </p>
      )}
    </div>
  );
}
