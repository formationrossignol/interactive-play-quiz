import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/lib/notifications/types";

const OPTIONS: {
  key: keyof NotificationPreferences;
  title: string;
  body: string;
  icon: string;
}[] = [
  { key: "sharesEnabled", title: "Partages et collaboration", body: "Invitations et nouveaux droits sur un contenu.", icon: "share" },
  { key: "examsEnabled", title: "Examens", body: "Nouvelles copies et activité des participants.", icon: "fact_check" },
  { key: "supportEnabled", title: "Support", body: "Suivi et résolution de vos demandes.", icon: "support_agent" },
  { key: "productEnabled", title: "Nouveautés produit", body: "Versions et améliorations importantes.", icon: "campaign" },
];

export function NotificationPreferencesPanel({
  value,
  onChange,
  disabled = false,
}: {
  value?: NotificationPreferences;
  onChange: (value: NotificationPreferences) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? DEFAULT_NOTIFICATION_PREFERENCES);
  useEffect(() => {
    if (value) setDraft(value);
  }, [value]);

  const set = (key: keyof NotificationPreferences, checked: boolean) => {
    const next = { ...draft, [key]: checked };
    setDraft(next);
    onChange(next);
  };

  return (
    <div style={{ display: "grid" }}>
      {OPTIONS.map(({ key, title, body, icon }) => (
        <div key={key} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 11, alignItems: "center", padding: "15px 0", borderBottom: "var(--ap-border-w) solid var(--ap-line)" }}>
          <span style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "var(--ap-r-md)", background: "var(--ap-paper-2)", color: "var(--ap-brand)" }}>
            <MaterialSymbol name={icon} size={18} />
          </span>
          <span>
            <strong style={{ display: "block", fontSize: 13 }}>{title}</strong>
            <span className="ap-muted" style={{ display: "block", marginTop: 2, fontSize: 11.5, lineHeight: 1.4 }}>{body}</span>
          </span>
          <Switch checked={draft[key]} onCheckedChange={(checked) => set(key, checked)} disabled={disabled} aria-label={title} />
        </div>
      ))}
      <p className="ap-muted" style={{ margin: "14px 0 0", fontSize: 11.5, lineHeight: 1.45 }}>
        Les alertes système et de sécurité restent toujours actives.
      </p>
    </div>
  );
}
