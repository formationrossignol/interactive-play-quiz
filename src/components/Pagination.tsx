import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination = ({ page, totalPages, onPageChange, className }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const getPages = (): (number | "…")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (page > 3) pages.push("…");
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  };

  const baseBtn: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: "var(--ap-r-sm)",
    border: "var(--ap-border-w) solid var(--ap-line)",
    background: "var(--ap-card)",
    color: "var(--ap-ink)",
    fontFamily: "var(--ap-font-display)",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all .1s var(--ap-ease)",
    boxShadow: "0 3px 0 var(--ap-line)",
  };

  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        style={{ ...baseBtn, opacity: page === 1 ? 0.35 : 1, cursor: page === 1 ? "not-allowed" : "pointer" }}
        onMouseEnter={(e) => {
          if (page !== 1) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ap-brand)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--ap-brand)";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ap-line)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--ap-ink)";
        }}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {getPages().map((p, i) =>
        p === "…" ? (
          <span
            key={`ellipsis-${i}`}
            style={{ ...baseBtn, border: "none", boxShadow: "none", background: "transparent", color: "var(--ap-muted)" }}
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            style={
              p === page
                ? {
                    ...baseBtn,
                    background: "var(--ap-brand)",
                    border: "2px solid var(--ap-brand)",
                    boxShadow: "0 3px 0 var(--ap-brand-deep)",
                    color: "#fff",
                    cursor: "default",
                  }
                : baseBtn
            }
            onMouseEnter={(e) => {
              if (p !== page) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ap-brand)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--ap-brand)";
              }
            }}
            onMouseLeave={(e) => {
              if (p !== page) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ap-line)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--ap-ink)";
              }
            }}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        style={{ ...baseBtn, opacity: page === totalPages ? 0.35 : 1, cursor: page === totalPages ? "not-allowed" : "pointer" }}
        onMouseEnter={(e) => {
          if (page !== totalPages) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ap-brand)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--ap-brand)";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ap-line)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--ap-ink)";
        }}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};
