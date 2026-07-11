import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { login, register, requestPasswordReset, verifyMfaLogin, getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

type View = "login" | "register" | "mfa" | "forgot" | "confirm-email";

const AuthPage = () => {
  const navigate = useNavigate();
  useSEO({ title: "Connexion", path: "/auth", noindex: true });
  const [view, setView] = useState<View>("login");
  const [busy, setBusy] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ email: "", username: "", password: "" });
  const [mfaCode, setMfaCode] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");

  // Already signed in (e.g. arriving from the email confirmation link)
  useEffect(() => {
    if (getCurrentUser()) navigate("/");
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await login(loginData.email, loginData.password);
    setBusy(false);
    if (result.status === "ok") {
      toast.success(t("loginSuccess"));
      navigate("/");
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
      navigate("/");
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
      navigate("/");
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    fontFamily: "var(--ap-font-body)",
    fontWeight: 700,
    fontSize: "15px",
    color: "var(--ap-ink)",
    background: "var(--ap-card)",
    border: "2px solid var(--ap-line)",
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
    fontWeight: 700,
    color: "var(--ap-brand)",
    fontFamily: "var(--ap-font-body)",
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-brand)";
    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "var(--ap-line)";
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--ap-paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Logo */}
        <div style={{ marginBottom: "32px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <span
              className="ap-logo"
              style={{ width: 58, height: 58, borderRadius: "18px", cursor: "pointer" }}
              onClick={() => navigate("/")}
            >
              <svg viewBox="0 0 24 24"><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"/></svg>
            </span>
          </div>
          <h1 className="ap-h2" style={{ fontSize: "28px", marginBottom: "6px" }}>Ludiq</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>Bienvenue sur la plateforme de quiz interactifs</p>
        </div>

        {/* Card */}
        <div className="ap-card ap-card--floaty" style={{ padding: "32px" }}>
          {/* Tab switcher — only for the two main views */}
          {(view === "login" || view === "register") && (
            <div className="ap-seg" style={{ marginBottom: "24px" }}>
              <button
                className={view === "login" ? "is-on" : ""}
                onClick={() => setView("login")}
              >
                Se connecter
              </button>
              <button
                className={view === "register" ? "is-on" : ""}
                onClick={() => setView("register")}
              >
                S'inscrire
              </button>
            </div>
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
              <div>
                <label style={labelStyle}>Mot de passe</label>
                <input
                  type="password"
                  required
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  style={inputStyle}
                  placeholder="••••••••"
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>
              <button
                type="submit"
                className="ap-btn ap-btn--pill"
                disabled={busy}
                style={{ width: "100%", marginTop: "4px" }}
              >
                Se connecter
              </button>
              <button type="button" onClick={() => setView("forgot")} style={{ ...linkButtonStyle, alignSelf: "center" }}>
                {t("forgotPassword")}
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
              <div>
                <label style={labelStyle}>Mot de passe</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  style={inputStyle}
                  placeholder="••••••••"
                  onFocus={onFocus}
                  onBlur={onBlur}
                />
              </div>
              <button
                type="submit"
                className="ap-btn ap-btn--pill"
                disabled={busy}
                style={{ width: "100%", marginTop: "4px" }}
              >
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
        </div>

        <p
          style={{
            marginTop: "20px",
            textAlign: "center",
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--ap-muted)",
          }}
        >
          En continuant, vous acceptez nos conditions d'utilisation.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
