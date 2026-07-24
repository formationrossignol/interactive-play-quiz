import { useEffect, useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { login, register, requestPasswordReset, verifyMfaLogin, getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { BrandMonogram } from "@/components/BrandMonogram";
import { BrandWordmark } from "@/components/BrandWordmark";

type View = "login" | "register" | "mfa" | "forgot" | "confirm-email";

const AuthPage = () => {
  useSEO({ title: "Connexion", path: "/auth", noindex: true });
  const [view, setView] = useState<View>("login");
  const [busy, setBusy] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ email: "", username: "", password: "" });
  const [mfaCode, setMfaCode] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Already signed in (e.g. arriving from the email confirmation link)
  useEffect(() => {
    if (getCurrentUser()) window.location.href = "/";
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await login(loginData.email, loginData.password);
    setBusy(false);
    if (result.status === "ok") {
      toast.success(t("loginSuccess"));
      window.location.href = "/";
    } else if (result.status === "mfa_required") {
      setView("mfa");
    } else if (result.status === "email_not_confirmed") {
      toast.error(t("emailNotConfirmed"));
    } else if (result.status === "invalid_credentials") {
      toast.error(t("invalidCredentials"));
    } else {
      toast.error(result.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.password.length < 8) { toast.error(t("passwordTooShort")); return; }
    setBusy(true);
    const result = await register(registerData.email, registerData.username, registerData.password);
    setBusy(false);
    if (result.status === "ok") {
      toast.success(t("registerSuccess"));
      window.location.href = "/";
    } else if (result.status === "confirm_email") {
      setView("confirm-email");
    } else if (result.status === "email_in_use") {
      toast.error(t("emailAlreadyUsed"));
    } else {
      toast.error(result.message);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const user = await verifyMfaLogin(mfaCode);
    setBusy(false);
    if (user) {
      toast.success(t("loginSuccess"));
      window.location.href = "/";
    } else {
      toast.error(t("mfaInvalidCode"));
      setMfaCode("");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await requestPasswordReset(forgotEmail);
    setBusy(false);
    toast.success(t("resetEmailSent"));
    setView("login");
  };

  const comingSoon = (provider: string) =>
    toast(`Connexion ${provider} bientôt disponible`, {
      description: "Pour l'instant, utilisez votre email ci-dessous.",
    });

  /* ── Shared field styles ──────────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    width: "100%",
    fontFamily: "var(--ap-font-body)",
    fontWeight: 700,
    fontSize: "15px",
    color: "var(--ap-ink)",
    background: "var(--ap-card)",
    border: "var(--ap-border-w) solid var(--ap-line)",
    borderRadius: "var(--ap-r-sm)",
    padding: "12px 15px",
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

  const linkButtonStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 800,
    color: "var(--ap-brand)",
    fontFamily: "var(--ap-font-body)",
    padding: 0,
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-brand)";
    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-line)";
    e.currentTarget.style.boxShadow = "none";
  };

  // Live password-length hint (mirrors the mockup)
  const pwValue = view === "register" ? registerData.password : loginData.password;
  const pwMissing = 8 - pwValue.length;
  const showPwHint = pwValue.length > 0 && pwValue.length < 8;

  const socialButton = (provider: string, logo: React.ReactNode) => (
    <button
      type="button"
      onClick={() => comingSoon(provider)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        width: "100%",
        padding: "12px 16px",
        fontFamily: "var(--ap-font-display)",
        fontWeight: 600,
        fontSize: "14.5px",
        color: "var(--ap-ink)",
        background: "var(--ap-card)",
        border: "var(--ap-border-w) solid var(--ap-line)",
        borderRadius: "var(--ap-r-pill)",
        cursor: "pointer",
        boxShadow: "0 3px 0 var(--ap-line)",
        transition: "transform .1s var(--ap-ease), box-shadow .1s var(--ap-ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 4px 0 var(--ap-line-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "0 3px 0 var(--ap-line)";
      }}
    >
      {logo}
      Continuer avec {provider}
    </button>
  );

  const googleLogo = (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );

  const microsoftLogo = (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );

  const passwordField = (
    <div>
      <label style={labelStyle}>Mot de passe</label>
      <div style={{ position: "relative" }}>
        <input
          type={showPassword ? "text" : "password"}
          required
          minLength={view === "register" ? 8 : undefined}
          value={pwValue}
          onChange={(e) =>
            view === "register"
              ? setRegisterData({ ...registerData, password: e.target.value })
              : setLoginData({ ...loginData, password: e.target.value })
          }
          style={{
            ...inputStyle,
            paddingRight: "46px",
            borderColor: showPwHint ? "var(--ap-quiz)" : "var(--ap-line)",
          }}
          placeholder="••••••••"
          onFocus={(e) => {
            if (!showPwHint) onFocus(e);
          }}
          onBlur={(e) => {
            if (!showPwHint) onBlur(e);
          }}
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          style={{
            position: "absolute",
            right: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ap-muted)",
            display: "flex",
            padding: "6px",
          }}
        >
          {showPassword ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {showPwHint && (
        <p style={{ margin: "8px 0 0", fontSize: "12.5px", fontWeight: 800, color: "var(--ap-quiz-deep)", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
          </svg>
          8 caractères minimum — il en manque {pwMissing}
        </p>
      )}
    </div>
  );

  /* ── Right column: the auth card ──────────────────────────── */
  const authCard = (
    <div className="ap-card ap-card--floaty" style={{ padding: "34px", width: "100%", maxWidth: "440px" }}>
      {(view === "login" || view === "register") && (
        <>
          <div className="ap-seg" style={{ marginBottom: "22px" }}>
            <button className={view === "login" ? "is-on" : ""} onClick={() => setView("login")}>
              Connexion
            </button>
            <button className={view === "register" ? "is-on" : ""} onClick={() => setView("register")}>
              Inscription
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
            {socialButton("Google", googleLogo)}
            {socialButton("Microsoft", microsoftLogo)}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0 18px" }}>
            <span style={{ flex: 1, height: "2px", background: "var(--ap-line)", borderRadius: "2px" }} />
            <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--ap-muted)" }}>ou par email</span>
            <span style={{ flex: 1, height: "2px", background: "var(--ap-line)", borderRadius: "2px" }} />
          </div>
        </>
      )}

      {view === "login" && (
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              required
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              style={inputStyle}
              placeholder="votre@email.com"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
          {passwordField}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13.5px", fontWeight: 700, color: "var(--ap-ink)" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: "16px", height: "16px", accentColor: "var(--ap-brand)", cursor: "pointer" }}
              />
              Rester connecté
            </label>
            <button type="button" onClick={() => setView("forgot")} style={linkButtonStyle}>
              {t("forgotPassword")}
            </button>
          </div>
          <button type="submit" className="ap-btn ap-btn--pill" disabled={busy} style={{ width: "100%", marginTop: "4px" }}>
            Se connecter
          </button>
        </form>
      )}

      {view === "register" && (
        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nom d'utilisateur</label>
            <input
              type="text"
              required
              value={registerData.username}
              onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
              style={inputStyle}
              placeholder="JohnDoe"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              required
              value={registerData.email}
              onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
              style={inputStyle}
              placeholder="votre@email.com"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
          {passwordField}
          <button type="submit" className="ap-btn ap-btn--pill" disabled={busy} style={{ width: "100%", marginTop: "4px" }}>
            S'inscrire
          </button>
        </form>
      )}

      {view === "mfa" && (
        <form onSubmit={handleMfaVerify} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p className="ap-muted" style={{ fontSize: "14px", margin: 0 }}>{t("mfaLoginPrompt")}</p>
          <div>
            <label style={labelStyle}>{t("mfaCodeLabel")}</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              style={{ ...inputStyle, textAlign: "center", fontSize: "22px", letterSpacing: "8px" }}
              placeholder="000000"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
          <button type="submit" className="ap-btn ap-btn--pill" disabled={busy} style={{ width: "100%" }}>
            {t("verify")}
          </button>
          <button type="button" onClick={() => setView("login")} style={{ ...linkButtonStyle, color: "var(--ap-muted)", alignSelf: "center" }}>
            {t("backToLogin")}
          </button>
        </form>
      )}

      {view === "forgot" && (
        <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              required
              autoFocus
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              style={inputStyle}
              placeholder="votre@email.com"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
          <button type="submit" className="ap-btn ap-btn--pill" disabled={busy} style={{ width: "100%" }}>
            {t("send")}
          </button>
          <button type="button" onClick={() => setView("login")} style={{ ...linkButtonStyle, color: "var(--ap-muted)", alignSelf: "center" }}>
            {t("backToLogin")}
          </button>
        </form>
      )}

      {view === "confirm-email" && (
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h2 className="ap-h3" style={{ margin: 0 }}>{t("confirmEmailTitle")}</h2>
          <p className="ap-muted" style={{ fontSize: "14px", margin: 0 }}>{t("confirmEmailBody")}</p>
          <button type="button" onClick={() => setView("login")} style={{ ...linkButtonStyle, alignSelf: "center" }}>
            {t("backToLogin")}
          </button>
        </div>
      )}

      {(view === "login" || view === "register") && (
        <p style={{ marginTop: "20px", textAlign: "center", fontSize: "12px", fontWeight: 700, color: "var(--ap-muted)", lineHeight: 1.55 }}>
          Données hébergées en Europe · conforme RGPD.
          <br />
          En continuant, vous acceptez les{" "}
          <a href="/cgu" style={{ color: "var(--ap-brand)", fontWeight: 800 }}>CGU</a>{" "}
          et la{" "}
          <a href="/confidentialite" style={{ color: "var(--ap-brand)", fontWeight: 800 }}>politique de confidentialité</a>.
        </p>
      )}
    </div>
  );

  /* ── Left column: the brand hero ──────────────────────────── */
  const features: { icon: React.ReactNode; text: React.ReactNode }[] = [
    {
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
          <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z" />
        </svg>
      ),
      text: (
        <>Créez un quiz en 5 minutes — ou générez-le par IA depuis vos supports de cours</>
      ),
    },
    {
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      text: (
        <>Jusqu'à 200 participants en direct, sur leur propre téléphone, sans installation</>
      ),
    },
    {
      icon: (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      text: (
        <>Analytics par question : sachez exactement quoi réexpliquer</>
      ),
    },
  ];

  const heroPanel = (
    <div
      className="auth-hero"
      style={{
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(150deg, #7e57ff 0%, #6a3ff0 45%, #4f2fd0 100%)",
        color: "#fff",
        padding: "56px 52px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {/* dot texture overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,.14) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", maxWidth: "460px" }}>
        {/* Brand */}
        <div
          style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "44px", cursor: "pointer" }}
          onClick={() => { window.location.href = "/"; }}
        >
          <span style={{ width: 46, height: 46, borderRadius: "14px", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
            <BrandMonogram size={24} diamondColor="#b4a9ff" />
          </span>
          <BrandWordmark size={26} color="#fff" />
        </div>

        <h1 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: "clamp(30px, 3.4vw, 42px)", lineHeight: 1.08, letterSpacing: "-1px", margin: "0 0 34px" }}>
          Vos cours deviennent<br />des moments dont<br />on se souvient.
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginBottom: "38px" }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <span style={{ width: 38, height: 38, borderRadius: "11px", background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", marginTop: "1px" }}>
                {f.icon}
              </span>
              <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, lineHeight: 1.45, color: "rgba(255,255,255,.94)" }}>{f.text}</p>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div style={{ background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.18)", borderRadius: "18px", padding: "20px 22px", backdropFilter: "blur(4px)" }}>
          <p style={{ margin: "0 0 12px", fontSize: "14.5px", fontWeight: 700, lineHeight: 1.5, color: "#fff" }}>
            « Mes M2 réclament le quiz Brivia à chaque fin de module. Le taux de réussite à l'examen a gagné 12 points. »
          </p>
          <p style={{ margin: 0, fontSize: "12.5px", fontWeight: 800, color: "rgba(255,255,255,.75)" }}>
            — Formatrice cloud &amp; DevOps, Toulouse
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="auth-split" style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      {heroPanel}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        {authCard}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .auth-split { grid-template-columns: 1fr; }
          .auth-hero { display: none; }
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
