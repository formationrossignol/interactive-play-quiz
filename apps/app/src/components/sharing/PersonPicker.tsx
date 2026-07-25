import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { searchUsernames, type UsernameMatch } from "@/lib/sharing/sharingRepo";

interface PersonPickerProps {
  onPickUsername: (match: UsernameMatch) => void;
  onInviteEmail: (email: string) => void;
}

/** Reusable "add a person" widget: debounced username search + exact-email invite.
 *  Purely presentational — the caller decides what "picking" someone actually does
 *  (add to a course's content_shares, add to a group's members, ...). */
export const PersonPicker = ({ onPickUsername, onInviteEmail }: PersonPickerProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UsernameMatch[]>([]);
  const [email, setEmail] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setResults([]); return; }
    const handle = setTimeout(() => {
      searchUsernames(trimmed).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const pick = (match: UsernameMatch) => {
    onPickUsername(match);
    setQuery("");
    setResults([]);
  };

  const invite = () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    onInviteEmail(trimmed);
    setEmail("");
  };

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("shareSearchPlaceholder")}
          style={{
            width: "100%",
            height: 34,
            padding: "0 10px",
            borderRadius: "var(--ap-r-md)",
            border: "var(--ap-border-w) solid var(--ap-line)",
            background: "var(--ap-paper-2)",
            color: "var(--ap-ink)",
            fontFamily: "var(--ap-font-body)",
            fontSize: 13,
          }}
        />
        {results.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 10,
              background: "var(--ap-card)",
              border: "var(--ap-border-w) solid var(--ap-line)",
              borderRadius: "var(--ap-r-md)",
              boxShadow: "var(--ap-shadow-card)",
              overflow: "hidden",
            }}
          >
            {results.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => pick(match)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 10px",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ap-ink)",
                  fontFamily: "var(--ap-font-body)",
                }}
              >
                @{match.username}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") invite(); }}
          placeholder={t("shareEmailPlaceholder")}
          type="email"
          style={{
            flex: 1,
            height: 34,
            padding: "0 10px",
            borderRadius: "var(--ap-r-md)",
            border: "var(--ap-border-w) solid var(--ap-line)",
            background: "var(--ap-paper-2)",
            color: "var(--ap-ink)",
            fontFamily: "var(--ap-font-body)",
            fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={invite}
          className="ap-btn ap-btn--sm"
        >
          {t("shareInviteByEmail")}
        </button>
      </div>
    </div>
  );
};
