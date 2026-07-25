// apps/app/src/components/GlobalSearch.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, ClipboardList, GraduationCap, Layers, Presentation, Search } from "lucide-react";
import { t } from "@/lib/i18n";
import type { User as AuthUser } from "@/lib/auth";
import type { ContentType } from "@/lib/content/types";
import { getSearchResultRoute, searchContent, type SearchResult } from "@/lib/content/searchContent";

type LabelKey = "creationTypeQuiz" | "creationTypePoll" | "creationTypeFlashcard" | "creationTypeSlide" | "creationTypeCourse" | "creationTypeExam";

const TYPE_META: Record<ContentType, { icon: typeof BookOpen; labelKey: LabelKey }> = {
  quiz: { icon: BookOpen, labelKey: "creationTypeQuiz" },
  poll: { icon: BarChart3, labelKey: "creationTypePoll" },
  flashcard: { icon: Layers, labelKey: "creationTypeFlashcard" },
  slide: { icon: Presentation, labelKey: "creationTypeSlide" },
  course: { icon: GraduationCap, labelKey: "creationTypeCourse" },
  exam: { icon: ClipboardList, labelKey: "creationTypeExam" },
};

type SearchStatus = "idle" | "loading" | "error" | "done";

const LISTBOX_ID = "global-search-listbox";
const optionId = (i: number) => `global-search-option-${i}`;

interface GlobalSearchProps {
  user: AuthUser | null;
}

export const GlobalSearch = ({ user }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!user || trimmed.length < 2) {
      requestIdRef.current += 1;
      setResults([]);
      setStatus("idle");
      setOpen(false);
      return;
    }

    const thisRequestId = ++requestIdRef.current;
    setStatus("loading");
    setOpen(true);

    const handle = setTimeout(() => {
      searchContent(user.id, trimmed)
        .then((found) => {
          if (!isMountedRef.current || requestIdRef.current !== thisRequestId) return;
          setResults(found);
          setHighlighted(0);
          setStatus("done");
        })
        .catch(() => {
          if (!isMountedRef.current || requestIdRef.current !== thisRequestId) return;
          setResults([]);
          setStatus("error");
        });
    }, 300);

    return () => clearTimeout(handle);
  }, [query, user]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const openResult = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    setStatus("idle");
    navigate(getSearchResultRoute(result.type, result.itemId));
  };

  if (!user) return null;

  const statusMessage =
    status === "loading" ? t("searchLoading")
    : status === "error" ? t("searchError")
    : status === "done" && results.length === 0 ? t("searchNoResults")
    : null;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "min(340px, 32vw)", flexShrink: 0 }}>
      <div style={{ position: "relative" }}>
        <Search
          className="h-4 w-4"
          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ap-muted)", pointerEvents: "none" }}
        />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={LISTBOX_ID}
          aria-activedescendant={open && results.length > 0 ? optionId(highlighted) : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length || status !== "idle") setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); e.currentTarget.blur(); return; }
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((i) => (i + 1) % results.length); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((i) => (i - 1 + results.length) % results.length); }
            else if (e.key === "Enter") { e.preventDefault(); openResult(results[highlighted]); }
          }}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px 0 34px",
            borderRadius: "var(--ap-r-lg)",
            border: "var(--ap-border-w) solid var(--ap-line)",
            background: "var(--ap-paper-2)",
            color: "var(--ap-ink)",
            fontFamily: "var(--ap-font-body)",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>

      {open && (
        <div
          role="listbox"
          id={LISTBOX_ID}
          className="z-50"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--ap-card)",
            border: "var(--ap-border-w) solid var(--ap-line)",
            borderRadius: "var(--ap-r-lg)",
            boxShadow: "var(--ap-shadow-card)",
            overflow: "hidden",
          }}
        >
          {statusMessage ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--ap-muted)" }}>
              {statusMessage}
            </div>
          ) : (
            results.map((result, i) => {
              const meta = TYPE_META[result.type];
              const Icon = meta.icon;
              return (
                <button
                  key={result.rowId}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === highlighted}
                  type="button"
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => openResult(result)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 12px",
                    background: i === highlighted ? "var(--ap-brand-soft)" : "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "var(--ap-font-body)",
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: "var(--ap-muted)", flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "var(--ap-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {result.title || t("untitled")}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--ap-muted)", flexShrink: 0 }}>
                    {t(meta.labelKey)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
