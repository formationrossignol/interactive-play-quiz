import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { getCurrentUser, updateProfile, User as AuthUser, type Theme, type Language } from "@/lib/auth";
import { type Plan, CONTENT_KIND_LABELS, type ContentKind } from "@/lib/plans";
import { getContentUsage, type ContentUsage } from "@/lib/planUsage";
import { openBillingPortal, pollForPlanUpgrade } from "@/lib/billing";
import { getUserQuizzes } from "@/lib/quizStorage";
import { setLanguage as setI18nLanguage, getLanguage, t } from "@/lib/i18n";
import { SITE_THEMES, applySiteTheme, normalizeSiteTheme, type SiteTheme } from "@/lib/siteTheme";
import { DENSITIES, applyDensity, normalizeDensity, type Density } from "@/lib/density";
import { AppLayout } from "@/components/AppLayout";
import { SecuritySection } from "@/components/SecuritySection";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { ButtonShimmerLabel } from "@/components/ui/skeleton";
import { uploadAvatar, validateAvatarFile } from "@/lib/avatarRepo";
import { AlertCircle, Check, Save, Trophy, BookOpen, Clock, Sun, Moon, Zap, Building2, User, Camera } from "lucide-react";
import { toast } from "sonner";

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--ap-font-body)",
  fontWeight: 700,
  fontSize: "14px",
  color: "var(--ap-ink)",
  background: "var(--ap-card)",
  border: "var(--ap-border-w) solid var(--ap-line)",
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
  border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)",
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
  starter: {
    label: 'Starter',
    color: '--ap-brand',
    colorDeep: '--ap-brand-deep',
    icon: User,
    features: [
      '5 quiz, sondages, jeux de cartes et présentations',
      '1 cours',
      "Jusqu'à 20 participants en direct",
      'Types de questions classiques',
    ],
  },
  pro: {
    label: 'Pro',
    color: '--ap-poll',
    colorDeep: '--ap-poll-deep',
    icon: Zap,
    features: [
      'Quiz, sondages, jeux de cartes, présentations, examens et cours illimités',
      "Jusqu'à 200 participants en direct",
      'Tous les types de questions',
      'Statistiques avancées',
    ],
  },
  entreprise: {
    label: 'Entreprise',
    color: '--ap-pres',
    colorDeep: '--ap-pres-deep',
    icon: Building2,
    features: [
      'Tout Pro inclus',
      'Participants illimités',
      'Single sign-on (SSO)',
      'Marque blanche et templates personnalisés',
    ],
  },
};

const statCards = [
  { key: "totalQuizzes",   labelKey: "quizzesCreated", icon: Trophy,   accent: "--ap-brand" },
  { key: "publicQuizzes",  labelKey: "publicQuizzes",  icon: BookOpen, accent: "--ap-poll" },
  { key: "totalQuestions", labelKey: "questions",      icon: Clock,    accent: "--ap-pres" },
] as const;

const ProfilePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [siteTheme, setSiteTheme] = useState<SiteTheme>("arcade");
  const [density, setDensity] = useState<Density>("standard");
  const [language, setLanguage] = useState<Language>("en");
  const [plan, setPlan] = useState<Plan>("starter");
  const [stats, setStats] = useState({ totalQuizzes: 0, publicQuizzes: 0, totalQuestions: 0 });
  const [usage, setUsage] = useState<Record<ContentKind, ContentUsage> | null>(null);
  const [accountTab, setAccountTab] = useState("account");
  const [notificationPrefs, setNotificationPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem("brivia:notification-preferences");
      return saved ? JSON.parse(saved) as Record<string, boolean> : { product: true, grading: true, digest: false };
    } catch {
      return { product: true, grading: true, digest: false };
    }
  });

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) { navigate("/auth"); return; }
    setUser(currentUser);
    setUsername(currentUser.username);
    setEmail(currentUser.email);
    setRoleLabel(currentUser.roleLabel || "");
    setAvatarUrl(currentUser.avatarUrl);
    setTheme(currentUser.theme || "light");
    setSiteTheme(normalizeSiteTheme(currentUser.siteTheme));
    setDensity(normalizeDensity(currentUser.density));
    setLanguage(currentUser.language || "en");
    setPlan(currentUser.plan || "starter");
    getContentUsage(currentUser.id, currentUser.plan || "starter").then(setUsage);
    const userQuizzes = getUserQuizzes(currentUser.id).filter((q) => q.type === "quiz");
    setStats({
      totalQuizzes: userQuizzes.length,
      publicQuizzes: userQuizzes.filter((q) => q.isPublic).length,
      totalQuestions: userQuizzes.reduce((sum, q) => sum + q.questions.length, 0),
    });
  }, [navigate]);

  useEffect(() => {
    if (searchParams.get("checkout") !== "success" || !user) return;
    let cancelled = false;
    (async () => {
      const upgraded = await pollForPlanUpgrade(user.id);
      if (cancelled) return;
      if (upgraded) {
        const refreshed = getCurrentUser();
        if (refreshed) {
          setUser(refreshed);
          setPlan(refreshed.plan || "starter");
          setUsage(await getContentUsage(refreshed.id, refreshed.plan || "starter"));
        }
        toast.success("Abonnement Pro activé !");
      } else {
        toast.message("Paiement en cours de traitement, actualisez la page dans un instant.");
      }
      setSearchParams(
        (prev) => {
          prev.delete("checkout");
          return prev;
        },
        { replace: true }
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const usernameError = usernameTouched && !username.trim() ? t("usernameRequired") : undefined;

  const handleSave = async () => {
    if (!user) return;
    if (!username.trim()) {
      setUsernameTouched(true);
      toast.error(t("usernameRequired"));
      usernameRef.current?.focus();
      return;
    }
    const updatedUser = await updateProfile({
      username: username.trim(),
      theme,
      siteTheme,
      density,
      language,
      roleLabel: roleLabel.trim(),
    });
    if (!updatedUser) { toast.error(t("loginError")); return; }
    setUser(updatedUser);
    setI18nLanguage(language);
    document.documentElement.classList.toggle("dark", theme === "dark");
    applySiteTheme(siteTheme);
    applyDensity(density);
    toast.success(t("profileUpdated"));
    setTimeout(() => window.location.reload(), 500);
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const validation = validateAvatarFile(file);
    if (validation.ok === false) { toast.error(validation.error); return; }
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      const updatedUser = await updateProfile({ avatarUrl: url });
      if (!updatedUser) { toast.error(t("loginError")); return; }
      setUser(updatedUser);
      setAvatarUrl(updatedUser.avatarUrl);
      toast.success(t("profileUpdated"));
    } catch {
      toast.error("Échec de l'envoi de la photo, réessayez.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-brand)";
    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-line)";
    e.currentTarget.style.boxShadow = "none";
  };

  const setNotificationPreference = (key: string, checked: boolean) => {
    const next = { ...notificationPrefs, [key]: checked };
    setNotificationPrefs(next);
    localStorage.setItem("brivia:notification-preferences", JSON.stringify(next));
  };

  if (!user) return null;

  return (
    <AppLayout subtitle={t("myProfile")}>
      <div className="product-page product-page--medium">

        {/* Page header */}
        <div className="product-profile-hero">
          <div className="product-profile-avatar-wrap">
            <div className="product-profile-avatar" aria-hidden="true">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="product-profile-avatar__img" />
                : (user.username?.[0] ?? "?")}
            </div>
            <button
              type="button"
              className="product-profile-avatar__edit"
              aria-label="Changer la photo de profil"
              title="Changer la photo de profil"
              disabled={avatarUploading}
              onClick={() => avatarInputRef.current?.click()}
            >
              <ButtonShimmerLabel loading={avatarUploading}>
                <Camera className="h-3.5 w-3.5" />
              </ButtonShimmerLabel>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={handleAvatarPick}
            />
          </div>
          <div>
            <h1>{user.username}</h1>
            <p>{roleLabel || user.email}</p>
          </div>
          <span className="product-profile-plan">
            {(() => {
              const PlanIcon = PLAN_META[plan].icon;
              return <PlanIcon className="h-4 w-4" />;
            })()}
            Offre {PLAN_META[plan].label}
          </span>
        </div>

        <Tabs value={accountTab} onValueChange={setAccountTab} className="product-account-tabs">
          <TabsList className="product-account-tabs__list" aria-label="Réglages du compte">
            <TabsTrigger value="account"><MaterialSymbol name="account_circle" size={19} /> Compte</TabsTrigger>
            <TabsTrigger value="notifications"><MaterialSymbol name="notifications_none" size={19} /> Notifications</TabsTrigger>
            <TabsTrigger value="billing"><MaterialSymbol name="receipt_long" size={19} /> Facturation</TabsTrigger>
            <TabsTrigger value="security"><MaterialSymbol name="lock" size={19} /> Sécurité</TabsTrigger>
          </TabsList>

          <div className="product-settings-stack" role="tabpanel" aria-live="polite">

          {/* Stats */}
          {accountTab === "account" && <div className="product-metric-grid">
            {statCards.map(({ key, labelKey, icon: Icon, accent }) => (
              <div key={key} className="product-metric">
                <div className="product-metric__icon" style={{ color: `var(${accent})` }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <strong>{stats[key]}</strong>
                  <small>{t(labelKey as Parameters<typeof t>[0])}</small>
                </div>
              </div>
            ))}
          </div>}

          {/* Account plan */}
          {accountTab === "billing" && (() => {
            const meta = PLAN_META[plan];
            const PlanIcon = meta.icon;
            return (
              <div className="product-settings-panel product-settings-panel--wide">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
                  <h2 className="ap-h3" style={{ margin: 0 }}>Mon compte</h2>
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      background: `var(${meta.color})`, color: "#fff",
                      fontFamily: "var(--ap-font-display)", fontWeight: 700,
                      fontSize: "13px", padding: "5px 14px", borderRadius: "var(--ap-r-sm)",
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
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: `var(${meta.color})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Check className="h-3 w-3" strokeWidth={2.4} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                {plan === 'starter' && usage && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                    {(Object.keys(usage) as ContentKind[]).map((kind) => {
                      const { used, cap } = usage[kind];
                      if (cap === null) return null;
                      const pct = Math.min(100, (used / cap) * 100);
                      return (
                        <div key={kind}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, color: "var(--ap-muted)", marginBottom: "4px", textTransform: "capitalize" }}>
                            <span>{CONTENT_KIND_LABELS[kind]}</span>
                            <span>{used} / {cap}</span>
                          </div>
                          <div style={{ height: "6px", borderRadius: "var(--ap-r-sm)", background: "var(--ap-line)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: used >= cap ? "var(--ap-flash)" : "var(--ap-brand)", borderRadius: "var(--ap-r-sm)" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {plan === 'pro' && (
                  <button
                    className="ap-btn ap-btn--pill"
                    style={{ gap: "8px" }}
                    onClick={async () => {
                      const result = await openBillingPortal();
                      if (!result.ok) toast.error(result.error ?? "Erreur lors de l'ouverture de la gestion d'abonnement.");
                    }}
                  >
                    <Zap style={{ width: 15, height: 15 }} />
                    Gérer mon abonnement
                  </button>
                )}
                {plan === 'starter' && (
                  <button
                    className="ap-btn ap-btn--pill"
                    style={{ gap: "8px" }}
                    onClick={() => { window.location.href = "/pricing"; }}
                  >
                    <Zap style={{ width: 15, height: 15 }} />
                    Passer à Pro
                  </button>
                )}
              </div>
            );
          })()}

          {/* Profile info */}
          {accountTab === "account" && <div className="product-settings-panel product-settings-panel--wide product-settings-panel--profile">
            <h2 className="ap-h3" style={{ marginBottom: "20px" }}>{t("profileInfo")}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle} htmlFor="profile-username">{t("username")}</label>
                <input
                  id="profile-username"
                  ref={usernameRef}
                  style={{ ...inputStyle, borderColor: usernameError ? "var(--ap-danger)" : "var(--ap-line)" }}
                  value={username}
                  aria-invalid={!!usernameError}
                  aria-describedby={usernameError ? "profile-username-error" : undefined}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={(e) => { if (!usernameError) onFocus(e); }}
                  onBlur={(e) => { setUsernameTouched(true); if (!usernameError) onBlur(e); }}
                />
                {usernameError && (
                  <p id="profile-username-error" role="alert" style={{ margin: "8px 0 0", fontSize: "12.5px", fontWeight: 800, color: "var(--ap-danger-deep)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertCircle className="h-4 w-4" />
                    {usernameError}
                  </p>
                )}
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
              <div>
                <label style={labelStyle} htmlFor="profile-role-label">Rôle</label>
                <input
                  id="profile-role-label"
                  style={inputStyle}
                  value={roleLabel}
                  placeholder="Ex. Formateur, Étudiant, RH…"
                  maxLength={60}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
                <p className="ap-muted" style={{ fontSize: "11px", marginTop: "5px" }}>Affiché sur votre profil, sans effet sur vos permissions.</p>
              </div>
            </div>
          </div>}

          {/* Preferences */}
          {accountTab === "account" && <div className="product-settings-panel product-settings-panel--wide product-settings-panel--preferences">
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
                          // Aperçu instantané, persisté définitivement au clic sur Enregistrer
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
                          {def.id === "material" ? <MaterialSymbol name="palette" size={24} filled /> : "Aa"}
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
                    // Aperçu instantané, persisté définitivement au clic sur Enregistrer
                    document.documentElement.classList.toggle("dark", v === "dark");
                  }}
                >
                  <SelectTrigger style={{ ...triggerStyle, marginTop: "8px" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
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
                <label style={labelStyle}>{t("density")}</label>
                <Select
                  value={density}
                  onValueChange={(v: Density) => {
                    setDensity(v);
                    // Aperçu instantané, persisté définitivement au clic sur Enregistrer
                    applyDensity(v);
                  }}
                >
                  <SelectTrigger style={{ ...triggerStyle, marginTop: "8px" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                    {DENSITIES.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.label[getLanguage()]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="ap-muted" style={{ fontSize: "11px", marginTop: "6px" }}>{t("densityHint")}</p>
              </div>

              <div>
                <label style={labelStyle}>{t("language")}</label>
                <Select value={language} onValueChange={(v: Language) => setLanguage(v)}>
                  <SelectTrigger style={{ ...triggerStyle, marginTop: "8px" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-md)" }}>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
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
          </div>}

          {accountTab === "notifications" && (
            <div className="product-settings-panel product-settings-panel--wide product-notification-settings">
              <h2 className="ap-h3">Préférences de notifications</h2>
              <p className="product-settings-panel__intro">Choisissez les événements qui méritent votre attention. Les alertes critiques de sécurité restent toujours actives.</p>
              {[
                { key: "product", icon: "campaign", title: "Actualités produit", copy: "Nouveautés, améliorations et changements importants de Brivia." },
                { key: "grading", icon: "fact_check", title: "Corrections et résultats", copy: "Travaux à corriger, résultats publiés et activité des apprenants." },
                { key: "digest", icon: "mark_email_unread", title: "Résumé hebdomadaire", copy: "Un récapitulatif compact de votre activité chaque lundi." },
              ].map((preference) => (
                <div className="product-notification-setting" key={preference.key}>
                  <span className="product-notification-setting__icon"><MaterialSymbol name={preference.icon} size={21} /></span>
                  <span className="product-notification-setting__copy">
                    <strong>{preference.title}</strong>
                    <small>{preference.copy}</small>
                  </span>
                  <Switch
                    checked={Boolean(notificationPrefs[preference.key])}
                    onCheckedChange={(checked) => setNotificationPreference(preference.key, checked)}
                    aria-label={preference.title}
                  />
                </div>
              ))}
            </div>
          )}

          {accountTab === "security" && <SecuritySection />}

          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
