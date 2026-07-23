import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void; // omitted on the current (last) page
}

/** Shared fil d'ariane: circular Home button > links > bold current page. Used by every builder/explorer topbar. */
export function Breadcrumb({ onHome, items }: { onHome: () => void; items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Fil d'ariane" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <button
        onClick={onHome}
        aria-label="Accueil"
        style={{
          display: "grid", placeItems: "center", width: 36, height: 36,
          borderRadius: "50%", border: "var(--ap-border-w) solid var(--ap-line)",
          background: "var(--ap-card)", cursor: "pointer", flexShrink: 0,
        }}
      >
        <Home style={{ width: 16, height: 16, color: "var(--ap-ink)" }} />
      </button>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <ChevronRight style={{ width: 15, height: 15, color: "var(--ap-line-2)", flexShrink: 0 }} />
            {item.onClick ? (
              <button
                onClick={item.onClick}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  fontFamily: "var(--ap-font-body)", fontSize: 15, fontWeight: 700,
                  color: "var(--ap-muted)", whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </button>
            ) : (
              <span
                style={{
                  fontFamily: isLast ? "var(--ap-font-display)" : "var(--ap-font-body)",
                  fontWeight: 700, fontSize: isLast ? 16 : 15,
                  color: isLast ? "var(--ap-ink)" : "var(--ap-muted)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
                }}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
