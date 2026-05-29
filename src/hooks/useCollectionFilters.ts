import { useState, useMemo, useEffect } from "react";
import type { SavedQuiz } from "@/lib/quizStorage";

export type SortOption = "newest" | "oldest" | "az" | "questions";

const PAGE_SIZE = 12;

export function useCollectionFilters(items: SavedQuiz[], pageSize = PAGE_SIZE) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tous");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);

  const categories = useMemo(() => {
    const cats = new Set(items.map((i) => i.category).filter(Boolean));
    return ["Tous", ...Array.from(cats).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let result = items.filter((item) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q) ||
        (item.tags ?? []).some((t) => t.toLowerCase().includes(q));
      const matchCat = category === "Tous" || item.category === category;
      return matchSearch && matchCat;
    });

    switch (sort) {
      case "oldest":
        result = [...result].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case "az":
        result = [...result].sort((a, b) => a.title.localeCompare(b.title, "fr"));
        break;
      case "questions":
        result = [...result].sort((a, b) => b.questions.length - a.questions.length);
        break;
      default:
        result = [...result].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    return result;
  }, [items, search, category, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, category, sort]);

  // Clamp page if items shrink
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return {
    search, setSearch,
    category, setCategory,
    sort, setSort,
    categories,
    filtered,
    paginated,
    page, setPage,
    totalPages,
    total: filtered.length,
  };
}
