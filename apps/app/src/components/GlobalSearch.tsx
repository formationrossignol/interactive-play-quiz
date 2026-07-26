// apps/app/src/components/GlobalSearch.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart2, BookOpen, Clock, GraduationCap, Layers, Presentation, Search, X, ClipboardCheck } from "lucide-react";
import { t } from "@/lib/i18n";
import type { User as AuthUser } from "@/lib/auth";
import type { ContentType } from "@/lib/content/types";
import { getSearchResultRoute, searchContent, type SearchResult } from "@/lib/content/searchContent";
import { addRecentSearch, getRecentSearches, removeRecentSearch } from "@/lib/content/searchHistory";

type LabelKey = "creationTypeQuiz" | "creationTypePoll" | "creationTypeFlashcard" | "creationTypeSlide" | "creationTypeCourse" | "creationTypeExam";

export const TYPE_META: Record<ContentType, { icon: typeof BookOpen; labelKey: LabelKey }> = {
  quiz: { icon: BookOpen, labelKey: "creationTypeQuiz" },
  poll: { icon: BarChart2, labelKey: "creationTypePoll" },
  flashcard: { icon: Layers, labelKey: "creationTypeFlashcard" },
  slide: { icon: Presentation, labelKey: "creationTypeSlide" },
  course: { icon: GraduationCap, labelKey: "creationTypeCourse" },
  exam: { icon: ClipboardCheck, labelKey: "creationTypeExam" },
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
  const [recent, setRecent] = useState<string[]>(() => (user ? getRecentSearches(user.id) : []));
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

  // Results grouped by content type (REQ-SRC-003) while keyboard nav still
  // walks a single flat, score/recency-ordered list — `displayOrder` is that
  // list re-sequenced to match the grouped rendering below, so index N in
  // one is always the same result as index N in the other.
  const grouped = useMemo(() => {
    const buckets = new Map<ContentType, SearchResult[]>();
    for (const r of results) {
      if (!buckets.has(r.type)) buckets.set(r.type, []);
      buckets.get(r.type)!.push(r);
    }
    return buckets;
  }, [results]);
  const displayOrder = useMemo(() => Array.from(grouped.values()).flat(), [grouped]);

  const showRecent = query.trim().length === 0 && recent.length > 0;
  const statusMessage =
    status === "loading" ? t("searchLoading")
    : status === "error" ? t("searchError")
    : status === "done" && displayOrder.length === 0 ? t("searchNoResults")
    : null;
  const hasPanelContent = showRecent || !!statusMessage || grouped.size > 0;

  const openResult = (result: SearchResult) => {
    if (user) setRecent(addRecentSearch(user.id, query));
    setOpen(false);
    setQuery("");
    setStatus("idle");
    navigate(getSearchResultRoute(result.type, result.itemId));
  };

  const runRecentQuery = (q: string) => {
    setQuery(q);
  };

  if (!user) return null;

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
          aria-activedescendant={open && displayOrder.length > 0 ? optionId(highlighted) : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (displayOrder.length || status !== "idle" || (query.trim().length === 0 && recent.length > 0)) setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); e.currentTarget.blur(); return; }
            if (!open || displayOrder.length === 0) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((i) => (i + 1) % displayOrder.length); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((i) => (i - 1 + displayOrder.length) % displayOrder.length); }
            else if (e.key === "Enter") { e.preventDefault(); openResult(displayOrder[highlighted]); }
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

      {open && hasPanelContent && (
        <div
          role="listbox"
          id={LISTBOX_ID}
          className="z-50"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            maxHeight: 360,
            overflowY: "auto",
            background: "var(--ap-card)",
            border: "var(--ap-border-w) solid var(--ap-line)",
            borderRadius: "var(--ap-r-sm)",
            boxShadow: "var(--ap-shadow-card)",
            overflow: "hidden",
          }}
        >
          {showRecent ? (
            <div style={{ padding: "6px 0" }}>
              <div style={{ padding: "6px 12px 2px", fontSize: 11, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ap-muted)" }}>
                {t("searchRecentTitle")}
              </div>
              {recent.map((q) => (
                <div key={q} style={{ display: "flex", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => runRecentQuery(q)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 6px 8px 12px",
                      background: "transparent", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "var(--ap-font-body)",
                    }}
                  >
                    <Clock className="h-3.5 w-3.5" style={{ color: "var(--ap-muted)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ap-ink)" }}>{q}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={t("searchRemoveRecent")}
                    onClick={() => user && setRecent(removeRecentSearch(user.id, q))}
                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: "6px 10px", color: "var(--ap-muted)" }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : statusMessage ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--ap-muted)" }}>
              {statusMessage}
            </div>
          ) : (
            Array.from(grouped.entries()).map(([type, items]) => {
              const meta = TYPE_META[type];
              const GroupIcon = meta.icon;
              return (
                <div key={type}>
                  <div style={{ padding: "6px 12px 2px", display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ap-muted)" }}>
                    <GroupIcon className="h-3 w-3" /> {t(meta.labelKey)}
                  </div>
                  {items.map((result) => {
                    const i = displayOrder.indexOf(result);
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
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "var(--ap-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {result.title || t("untitled")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
