import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentUser, updateProfile, User as AuthUser, type Theme, type Language, type Plan } from "@/lib/auth";
import { getUserQuizzes } from "@/lib/quizStorage";
import { setLanguage as setI18nLanguage, getLanguage, t } from "@/lib/i18n";
import { SITE_THEMES, applySiteTheme, normalizeSiteTheme, type SiteTheme } from "@/lib/siteTheme";
import { Header } from "@/components/Header";
import { SecuritySection } from "@/components/SecuritySection";
import { Save, Trophy, BookOpen, Clock, Sun, Moon, Zap, Building2, User } from "lucide-react";
import { toast } from "sonner";

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--ap-font-body)",
  fontWeight: 700,
  fontSize: "14px",
  color: "var(--ap-ink)",
  background: "var(--ap-card)",
  border: "2px solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  padding: "11px 14px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color .12s, box-shadow .12s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  fontSize: "11px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  color: "var(--ap-muted)",
  marginBottom: "7px",
  fontFamily: "var(--ap-font-body)",
};

const triggerStyle = {
  fontFamily: "var(--ap-font-body)", fontWeight: 700, fontSize: "14px",
  border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
  background: "var(--ap-card)", color: "var(--ap-ink)", height: "44px",
  width: "100%",
};

const PLAN_META: Record<Plan, {
  label: string;
  color: string;
  colorDeep: string;
  icon: React.ElementType;
  features: string[];
}> = {
  perso: {
    label: 'Perso',
    color: '--ap-brand',
    colorDeep: '--ap-brand-deep',
    icon: User,
    features: ['Jusqu\'à 10 quiz', 'Types de questions classiques', '30 joueurs simultanés'],
  },
  pro: {
    label: 'Pro',
    color: '--ap-poll',
    colorDeep: '--ap-poll-deep',
    icon: Zap,
    features: ['Quiz illimités', 'Tous les types de questions', '200 joueurs simultanés', 'Statistiques avancées'],
  },
  entreprise: {
    label: 'Entreprise',
    color: '--ap-pres',
    colorDeep: '--ap-pres-deep',
    icon: Building2,
    features: ['Tout Pro inclus', 'Joueurs illimités', 'Marque blanche', 'Support dédié'],
  },
};

const statCards = [
  { key: "totalQuizzes",   labelKey: "quizzesCreated", icon: Trophy,   accent: "--ap-brand",  accentDeep: "--ap-brand-deep" },
  { key: "publicQuizzes",  labelKey: "publicQuizzes",  icon: BookOpen, accent: "--ap-poll",   accentDeep: "--ap-poll-deep" },
  { key: "totalQuestions", labelKey: "questions",      icon: Clock,    accent: "--ap-pres",   accentDeep: "--ap-pres-deep" },
] as const;

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [siteTheme, setSiteTheme] = useState<SiteTheme>("arcade");
  const [language, setLanguage] = useState<Language>("en");
  const [plan, setPlan] = useState<Plan>("perso");
  const [stats, setStats] = useState({ totalQuizzes: 0, publicQuizzes: 0, totalQuestions: 0 });

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) { navigate("/auth"); return; }
    setUser(currentUser);
    setUsername(currentUser.username);
    setEmail(currentUser.email);
    setTheme(currentUser.theme || "light");
    setSiteTheme(normalizeSiteTheme(currentUser.siteTheme));
    setLanguage(currentUser.language || "en");
    setPlan(currentUser.plan || "perso");
    const userQuizzes = getUserQuizzes(currentUser.id).filter((q) => q.type === "quiz");
    setStats({
      totalQuizzes: userQuizzes.length,
      publicQuizzes: userQuizzes.filter((q) => q.isPublic).length,
      totalQuestions: userQuizzes.reduce((sum, q) => sum + q.questions.length, 0),
    });
  }, [navigate]);

  const handleSave = async () => {
    if (!user) return;
    if (!username.trim()) { toast.error(t("usernameRequired")); return; }
    const updatedUser = await updateProfile({ username: username.trim(), theme, siteTheme, language });
    if (!updatedUser) { toast.error(t("loginError")); return; }
    setUser(updatedUser);
    setI18nLanguage(language);
    document.documentElement.classList.toggle("dark", theme === "dark");
    applySiteTheme(siteTheme);
    toast.success(t("profileUpdated"));
    setTimeout(() => window.location.reload(), 500);
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-brand)";
    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-line)";
    e.currentTarget.style.boxShadow = "none";
  };

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header subtitle={t("myProfile")} />

      <div className="mx-auto max-w-4xl px-6 py-10">

        {/* Page header */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          {/* Avatar circle */}
          <div
            style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "var(--ap-brand)",
              boxShadow: "0 6px 0 var(--ap-brand-deep), 0 12px 24px rgba(112,72,255,.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--ap-font-display)", fontWeight: 600,
                fontSize: "28px", color: "#fff", textTransform: "uppercase",
              }}
            >
              {user.username?.[0] ?? "?"}
            </span>
          </div>
          <h1 className="ap-h2" style={{ fontSize: "26px", marginBottom: "6px" }}>{user.username}</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>{user.email}</p>
        </div>

        <div style={{ display: "grid", gap: "20px" }}>

          {/* Stats */}
          <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {statCards.map(({ key, labelKey, icon: Icon, accent, accentDeep }) => (
              <div
                key={key}
                className="ap-card"
                style={{ textAlign: "center", padding: "24px 20px" }}
              >
                <div
                  className="ap-tile__icon"
                  style={{
                    background: `var(${accent})`,
                    boxShadow: `0 5px 0 var(${accentDeep})`,
                    margin: "0 auto 14px",
                  }}
                >
                  <Icon className="h-6 w-6" color="#fff" />
                </div>
                <div
                  style={{
                    fontFamily: "var(--ap-font-display)", fontWeight: 600,
                    fontSize: "36px", color: "var(--ap-ink)", lineHeight: 1,
                    marginBottom: "6px",
                  }}
                >
                  {stats[key]}
                </div>
                <div className="ap-muted" style={{ fontSize: "13px", fontWeight: 700 }}>
                  {t(labelKey as Parameters<typeof t>[0])}
                </div>
              </div>
            ))}
          </div>

          {/* Account plan */}
          {(() => {
            const meta = PLAN_META[plan];
            const PlanIcon = meta.icon;
            const isEntreprise = plan === 'entreprise';
            return (
              <div className="ap-card ap-card--floaty" style={{ padding: "28px 32px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
                  <h2 className="ap-h3" style={{ margin: 0 }}>Mon compte</h2>
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      background: `var(${meta.color})`, color: "#fff",
                      fontFamily: "var(--ap-font-display)", fontWeight: 700,
                      fontSize: "13px", padding: "5px 14px", borderRadius: "999px",
                      boxShadow: `0 3px 0 var(${meta.colorDeep})`,
                    }}
                  >
                    <PlanIcon style={{ width: 14, height: 14 }} />
                    {meta.label}
                  </span>
                </div>
                <ul style={{ margin: "0 0 20px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {meta.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "var(--ap-ink)", fontFamily: "var(--ap-font-body)", fontWeight: 600 }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: `var(${meta.color})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg viewBox="0 0 12 10" width="10" height="8" fill="none"><path d="M1 5l3 3 7-7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                {!isEntreprise && (
                  <button
                    className="ap-btn ap-btn--pill"
                    style={{ gap: "8px" }}
                    onClick={() => navigate("/pricing")}
                  >
                    <Zap style={{ width: 15, height: 15 }} />
                    Passer à {plan === 'perso' ? 'Pro' : 'Entreprise'}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Profile info */}
          <div className="ap-card ap-card--floaty" style={{ padding: "28px 32px" }}>
            <h2 className="ap-h3" style={{ marginBottom: "20px" }}>{t("profileInfo")}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>{t("username")}</label>
                <input
                  style={inputStyle}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>
              <div>
                <label style={labelStyle}>{t("email")}</label>
                <input
                  type="email"
                  style={{ ...inputStyle, opacity: 0.55, cursor: "not-allowed" }}
                  value={email}
                  disabled
                />
                <p className="ap-muted" style={{ fontSize: "11px", marginTop: "5px" }}>{t("emailReadonly")}</p>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="ap-card ap-card--floaty" style={{ padding: "28px 32px" }}>
            <h2 className="ap-h3" style={{ marginBottom: "20px" }}>{t("preferences")}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>{t("siteTheme")}</label>
                <div role="radiogroup" aria-label={t("siteTheme")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px", marginTop: "8px" }}>
                  {SITE_THEMES.map((def) => {
                    const selected = siteTheme === def.id;
                    return (
                      <button
                        key={def.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setSiteTheme(def.id);
                          // Aperçu instantané — persisté définitivement au clic sur Enregistrer
                          applySiteTheme(def.id);
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: "12px", textAlign: "left",
                          cursor: "pointer", padding: "12px 14px",
                          background: selected ? "var(--ap-brand-soft)" : "var(--ap-card)",
                          border: `2px solid ${selected ? "var(--ap-brand)" : "var(--ap-line)"}`,
                          borderRadius: "var(--ap-r-md)",
                          transition: "border-color .12s, background .12s",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                            display: "grid", placeItems: "center",
                            fontFamily: def.previewFont, fontWeight: 600, fontSize: 17,
                            color: "#fff", background: def.colors[0],
                          }}
                        >
                          Aa
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontWeight: 800, fontSize: "14px", color: "var(--ap-ink)" }}>
                            {def.name}
                          </span>
                          <span className="ap-muted" style={{ display: "block", fontSize: "12px", lineHeight: 1.3, margin: "2px 0 6px" }}>
                            {def.tagline[getLanguage()]}
                          </span>
                          <span aria-hidden="true" style={{ display: "flex", gap: "4px" }}>
                            {def.colors.map((c) => (
                              <span key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c, border: "1px solid var(--ap-line-2)" }} />
                            ))}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="ap-muted" style={{ fontSize: "11px", marginTop: "6px" }}>{t("siteThemeHint")}</p>
              </div>

              <div>
                <label style={labelStyle}>{t("theme")}</label>
                <Select
                  value={theme}
                  onValueChange={(v: Theme) => {
                    setTheme(v);
                    // Aperçu instantané — persisté définitivement au clic sur Enregistrer
                    document.documentElement.classList.toggle("dark", v === "dark");
                  }}
                >
                  <SelectTrigger style={{ ...triggerStyle, marginTop: "8px" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                    <SelectItem value="light">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Sun className="w-4 h-4" />{t("lightMode")}
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Moon className="w-4 h-4" />{t("darkMode")}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label style={labelStyle}>{t("language")}</label>
                <Select value={language} onValueChange={(v: Language) => setLanguage(v)}>
                  <SelectTrigger style={{ ...triggerStyle, marginTop: "8px" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div style={{ paddingTop: "8px" }}>
                <button className="ap-btn ap-btn--pill" style={{ width: "100%", gap: "8px" }} onClick={handleSave}>
                  <Save className="w-4 h-4" />
                  {t("saveChanges")}
                </button>
              </div>
            </div>
          </div>

          {/* Security */}
          <SecuritySection />

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
