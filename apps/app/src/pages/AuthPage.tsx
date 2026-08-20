import { useEffect, useRef, useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { login, register, requestPasswordReset, verifyMfaLogin, getCurrentUser } from "@/lib/auth";
import { acceptOrgInvitation, myOrgMemberships } from "@/lib/org/orgRepo";
import { buildSsoLoginUrl, resolveSsoConnectionForEmail } from "@/lib/lms/integrations";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { BrandMonogram } from "ui/BrandMonogram";
import { BrandWordmark } from "ui/BrandWordmark";
import { marketingUrl } from "@/lib/marketingOrigin";
import "@fontsource-variable/plus-jakarta-sans";
import styles from "./AuthPage.module.css";

type View = "login" | "register" | "mfa" | "forgot" | "confirm-email";

const AuthPage = () => {
  useSEO({ title: "Connexion", path: "/auth", noindex: true });
  const [view, setView] = useState<View>("login");
  const changeView = (v: View) => { setFieldErrors({}); setView(v); };
  const [busy, setBusy] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ email: "", username: "", password: "" });
  const [mfaCode, setMfaCode] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // INT-002: offers "Se connecter avec {provider}" once the typed email's
  // domain matches an org's active SSO connection — resolve_sso_connection_for_email
  // is the one deliberately public read of identity_domains/identity_connections
  // (see its migration comment). Password login stays usable regardless of
  // mode — enforcing `required_for_domains` by actually blocking password
  // submission server-side is a separate, bigger change, not attempted here.
  const [ssoOption, setSsoOption] = useState<{ connection_id: string; display_name: string } | null>(null);
  const checkSsoForEmail = async (email: string) => {
    try {
      setSsoOption(await resolveSsoConnectionForEmail(email));
    } catch {
      setSsoOption(null);
    }
  };

  const loginEmailRef = useRef<HTMLInputElement>(null);
  const registerUsernameRef = useRef<HTMLInputElement>(null);
  const registerEmailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const forgotEmailRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  const clearFieldError = (field: string) =>
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const runFieldValidation = (field: string, value: string, validator: (v: string) => string | undefined) => {
    const err = validator(value);
    setFieldErrors((prev) => {
      if (!err) {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: err };
    });
  };

  const emailError = (v: string): string | undefined => {
    if (!v.trim()) return t("emailRequired");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return t("emailInvalid");
    return undefined;
  };
  const usernameError = (v: string): string | undefined => {
    if (!v.trim()) return t("usernameRequired");
    if (v.trim().length < 3) return t("usernameTooShort");
    return undefined;
  };
  const passwordError = (v: string, minEight: boolean): string | undefined => {
    if (!v) return t("passwordRequired");
    if (minEight && v.length < 8) return t("passwordTooShort");
    return undefined;
  };

  // Already signed in (e.g. arriving from the email confirmation link)
  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView === "register" || requestedView === "signup") {
      setView("register");
    }
    if (getCurrentUser()) window.location.href = "/";
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    const emailErr = emailError(loginData.email);
    const pwErr = passwordError(loginData.password, false);
    if (emailErr) errors.loginEmail = emailErr;
    if (pwErr) errors.password = pwErr;
    if (emailErr || pwErr) {
      setFieldErrors(errors);
      (emailErr ? loginEmailRef : passwordRef).current?.focus();
      return;
    }
    setFieldErrors({});
    setBusy(true);
    const result = await login(loginData.email, loginData.password, rememberMe);
    setBusy(false);
    if (result.status === "ok") {
      toast.success(t("loginSuccess"));
      const inviteToken = new URLSearchParams(window.location.search).get("invite");
      if (inviteToken) {
        try {
          await acceptOrgInvitation(inviteToken);
        } catch {
          // stale/expired invite — user is still logged in, proceed
        }
      }
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
    const errors: Record<string, string> = {};
    const usernameErr = usernameError(registerData.username);
    const emailErr = emailError(registerData.email);
    const pwErr = passwordError(registerData.password, true);
    const termsErr = acceptTerms ? undefined : t("termsRequired");
    if (usernameErr) errors.registerUsername = usernameErr;
    if (emailErr) errors.registerEmail = emailErr;
    if (pwErr) errors.password = pwErr;
    if (termsErr) errors.terms = termsErr;
    if (usernameErr || emailErr || pwErr || termsErr) {
      setFieldErrors(errors);
      (usernameErr ? registerUsernameRef : emailErr ? registerEmailRef : pwErr ? passwordRef : termsRef).current?.focus();
      return;
    }
    setFieldErrors({});
    setBusy(true);
    const result = await register(registerData.email, registerData.username, registerData.password);
    setBusy(false);
    if (result.status === "ok") {
      toast.success(t("registerSuccess"));
      const inviteToken = new URLSearchParams(window.location.search).get("invite");
      if (inviteToken) {
        try {
          await acceptOrgInvitation(inviteToken);
        } catch {
          // Invitation may be stale/expired; the user still has an account —
          // fall through to onboarding rather than blocking signup on it.
        }
        window.location.href = "/";
        return;
      }
      let hasOrg = true;
      try {
        hasOrg = (await myOrgMemberships()).length > 0;
      } catch {
        // If the check itself fails, don't strand the user — send them
        // through the normal path rather than blocking on onboarding.
      }
      window.location.href = hasOrg ? "/" : "/onboarding/org";
    } else if (result.status === "confirm_email") {
      setView("confirm-email");
    } else if (result.status === "email_in_use") {
      setFieldErrors({ registerEmail: t("emailAlreadyUsed") });
      registerEmailRef.current?.focus();
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
    const emailErr = emailError(forgotEmail);
    if (emailErr) {
      setFieldErrors({ forgotEmail: emailErr });
      forgotEmailRef.current?.focus();
      return;
    }
    setFieldErrors({});
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
    fontFamily: "var(--auth-font)",
    fontWeight: 600,
    fontSize: "15px",
    color: "var(--ap-ink)",
    background: "var(--ap-card)",
    border: "1px solid var(--ap-line)",
    borderRadius: "10px",
    padding: "12px 15px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color .12s, box-shadow .12s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: 700,
    fontSize: "13px",
    letterSpacing: 0,
    color: "var(--ap-ink)",
    marginBottom: "7px",
    fontFamily: "var(--auth-font)",
  };

  const linkButtonStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 800,
    color: "var(--ap-brand)",
    fontFamily: "var(--auth-font)",
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

  // Inline field error — same visual language as the password-length hint
  // below, wired to aria-invalid/aria-describedby on the matching input.
  const FieldError = ({ id, message }: { id: string; message?: string }) => {
    if (!message) return null;
    return (
      <p id={id} role="alert" style={{ margin: "8px 0 0", fontSize: "12.5px", fontWeight: 800, color: "var(--ap-danger-deep)", display: "flex", alignItems: "center", gap: "6px" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
        </svg>
        {message}
      </p>
    );
  };

  // Live password-length hint (mirrors the mockup)
  const pwValue = view === "register" ? registerData.password : loginData.password;
  const pwMissing = 8 - pwValue.length;
  const showPwHint = pwValue.length > 0 && pwValue.length < 8;

  const socialButton = (provider: string, logo: React.ReactNode) => (
    <button
      type="button"
      onClick={() => comingSoon(provider)}
      className={styles.socialButton}
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

  const passwordHasError = showPwHint || !!fieldErrors.password;
  const passwordField = (
    <div>
      <label style={labelStyle} htmlFor="auth-password">Mot de passe</label>
      <div style={{ position: "relative" }}>
        <input
          id="auth-password"
          ref={passwordRef}
          type={showPassword ? "text" : "password"}
          required
          minLength={view === "register" ? 8 : undefined}
          value={pwValue}
          aria-invalid={passwordHasError}
          aria-describedby={fieldErrors.password ? "auth-password-error" : undefined}
          onChange={(e) => {
            if (view === "register") setRegisterData({ ...registerData, password: e.target.value });
            else setLoginData({ ...loginData, password: e.target.value });
          }}
          style={{
            ...inputStyle,
            paddingRight: "46px",
            borderColor: passwordHasError ? "var(--ap-danger)" : "var(--ap-line)",
          }}
          placeholder="••••••••"
          onFocus={(e) => {
            if (!passwordHasError) onFocus(e);
          }}
          onBlur={(e) => {
            if (!passwordHasError) onBlur(e);
            runFieldValidation("password", e.target.value, (v) => passwordError(v, view === "register"));
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
      {showPwHint ? (
        <p id="auth-password-error" role="alert" style={{ margin: "8px 0 0", fontSize: "12.5px", fontWeight: 800, color: "var(--ap-danger-deep)", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
          </svg>
          8 caractères minimum, il en manque {pwMissing}
        </p>
      ) : (
        <FieldError id="auth-password-error" message={fieldErrors.password} />
      )}
    </div>
  );

  /* ── Right column: the auth card ──────────────────────────── */
  const authCard = (
    <div className={styles.authCard}>
      {(view === "login" || view === "register") && (
        <>
          <div className={`${styles.authTabs} ap-seg`}>
            <button className={view === "login" ? "is-on" : ""} onClick={() => changeView("login")}>
              Connexion
            </button>
            <button className={view === "register" ? "is-on" : ""} onClick={() => changeView("register")}>
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
            <label style={labelStyle} htmlFor="login-email">Email</label>
            <input
              id="login-email"
              ref={loginEmailRef}
              type="email"
              required
              value={loginData.email}
              aria-invalid={!!fieldErrors.loginEmail}
              aria-describedby={fieldErrors.loginEmail ? "login-email-error" : undefined}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              style={{ ...inputStyle, borderColor: fieldErrors.loginEmail ? "var(--ap-danger)" : "var(--ap-line)" }}
              placeholder="votre@email.com"
              onFocus={onFocus}
              onBlur={(e) => { onBlur(e); runFieldValidation("loginEmail", e.target.value, emailError); void checkSsoForEmail(e.target.value); }}
            />
            <FieldError id="login-email-error" message={fieldErrors.loginEmail} />
          </div>
          {ssoOption && (
            <button
              type="button"
              className={`${styles.submitButton} ap-btn`}
              style={{ background: "transparent", border: "1px solid var(--ap-line)", color: "var(--ap-ink)" }}
              onClick={() => { window.location.href = buildSsoLoginUrl(ssoOption.connection_id, window.location.origin + "/dashboard"); }}
            >
              Se connecter avec {ssoOption.display_name}
            </button>
          )}
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
            <button type="button" onClick={() => changeView("forgot")} style={linkButtonStyle}>
              {t("forgotPassword")}
            </button>
          </div>
          <button type="submit" className={`${styles.submitButton} ap-btn`} disabled={busy}>
            Se connecter
          </button>
        </form>
      )}

      {view === "register" && (
        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle} htmlFor="register-username">Nom d'utilisateur</label>
            <input
              id="register-username"
              ref={registerUsernameRef}
              type="text"
              required
              value={registerData.username}
              aria-invalid={!!fieldErrors.registerUsername}
              aria-describedby={fieldErrors.registerUsername ? "register-username-error" : undefined}
              onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
              style={{ ...inputStyle, borderColor: fieldErrors.registerUsername ? "var(--ap-danger)" : "var(--ap-line)" }}
              placeholder="JohnDoe"
              onFocus={onFocus}
              onBlur={(e) => { onBlur(e); runFieldValidation("registerUsername", e.target.value, usernameError); }}
            />
            <FieldError id="register-username-error" message={fieldErrors.registerUsername} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="register-email">Email</label>
            <input
              id="register-email"
              ref={registerEmailRef}
              type="email"
              required
              value={registerData.email}
              aria-invalid={!!fieldErrors.registerEmail}
              aria-describedby={fieldErrors.registerEmail ? "register-email-error" : undefined}
              onChange={(e) => { setRegisterData({ ...registerData, email: e.target.value }); clearFieldError("registerEmail"); }}
              style={{ ...inputStyle, borderColor: fieldErrors.registerEmail ? "var(--ap-danger)" : "var(--ap-line)" }}
              placeholder="votre@email.com"
              onFocus={onFocus}
              onBlur={(e) => { onBlur(e); runFieldValidation("registerEmail", e.target.value, emailError); }}
            />
            <FieldError id="register-email-error" message={fieldErrors.registerEmail} />
          </div>
          {passwordField}
          <div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "var(--ap-ink)", lineHeight: 1.5 }}>
              <input
                ref={termsRef}
                type="checkbox"
                checked={acceptTerms}
                aria-invalid={!!fieldErrors.terms}
                aria-describedby={fieldErrors.terms ? "register-terms-error" : undefined}
                onChange={(e) => { setAcceptTerms(e.target.checked); clearFieldError("terms"); }}
                style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0, accentColor: "var(--ap-brand)", cursor: "pointer" }}
              />
              <span>
                J'accepte les{" "}
                <a href="/cgu" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ap-brand)", fontWeight: 800 }}>CGU</a>{" "}
                et la{" "}
                <a href="/confidentialite" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ap-brand)", fontWeight: 800 }}>politique de confidentialité</a>
              </span>
            </label>
            <FieldError id="register-terms-error" message={fieldErrors.terms} />
          </div>
          <button type="submit" className={`${styles.submitButton} ap-btn`} disabled={busy}>
            S'inscrire
          </button>
        </form>
      )}

      {view === "mfa" && (
        <form onSubmit={handleMfaVerify} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p className="ap-muted" style={{ fontSize: "14px", margin: 0 }}>{t("mfaLoginPrompt")}</p>
          <div>
            <label style={labelStyle} htmlFor="mfa-code">{t("mfaCodeLabel")}</label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              style={{ ...inputStyle, textAlign: "center", fontSize: "22px", letterSpacing: "8px" }}
              placeholder="000000"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
          <button type="submit" className={`${styles.submitButton} ap-btn`} disabled={busy}>
            {t("verify")}
          </button>
          <button type="button" onClick={() => changeView("login")} style={{ ...linkButtonStyle, color: "var(--ap-muted)", alignSelf: "center" }}>
            {t("backToLogin")}
          </button>
        </form>
      )}

      {view === "forgot" && (
        <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle} htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              ref={forgotEmailRef}
              type="email"
              required
              value={forgotEmail}
              aria-invalid={!!fieldErrors.forgotEmail}
              aria-describedby={fieldErrors.forgotEmail ? "forgot-email-error" : undefined}
              onChange={(e) => setForgotEmail(e.target.value)}
              style={{ ...inputStyle, borderColor: fieldErrors.forgotEmail ? "var(--ap-danger)" : "var(--ap-line)" }}
              placeholder="votre@email.com"
              onFocus={onFocus}
              onBlur={(e) => { onBlur(e); runFieldValidation("forgotEmail", e.target.value, emailError); }}
            />
            <FieldError id="forgot-email-error" message={fieldErrors.forgotEmail} />
          </div>
          <button type="submit" className={`${styles.submitButton} ap-btn`} disabled={busy}>
            {t("send")}
          </button>
          <button type="button" onClick={() => changeView("login")} style={{ ...linkButtonStyle, color: "var(--ap-muted)", alignSelf: "center" }}>
            {t("backToLogin")}
          </button>
        </form>
      )}

      {view === "confirm-email" && (
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h2 className="ap-h3" style={{ margin: 0 }}>{t("confirmEmailTitle")}</h2>
          <p className="ap-muted" style={{ fontSize: "14px", margin: 0 }}>{t("confirmEmailBody")}</p>
          <button type="button" onClick={() => changeView("login")} style={{ ...linkButtonStyle, alignSelf: "center" }}>
            {t("backToLogin")}
          </button>
        </div>
      )}

      {view === "login" && (
        <p style={{ marginTop: "20px", textAlign: "center", fontSize: "12px", fontWeight: 700, color: "var(--ap-muted)", lineHeight: 1.55 }}>
          Données hébergées en Europe · conforme RGPD.
          <br />
          En continuant, vous acceptez les{" "}
          <a href="/cgu" style={{ color: "var(--ap-brand)", fontWeight: 800 }}>CGU</a>{" "}
          et la{" "}
          <a href="/confidentialite" style={{ color: "var(--ap-brand)", fontWeight: 800 }}>politique de confidentialité</a>.
        </p>
      )}

      {view === "register" && (
        <p style={{ marginTop: "20px", textAlign: "center", fontSize: "12px", fontWeight: 700, color: "var(--ap-muted)", lineHeight: 1.55 }}>
          Données hébergées en Europe · conforme RGPD.
        </p>
      )}
    </div>
  );

  const pageTitle = view === "register"
    ? "Créez votre espace Brivia"
    : view === "forgot"
      ? "Retrouvez l’accès à votre compte"
      : view === "mfa"
        ? "Vérification de sécurité"
        : "Bienvenue sur Brivia";

  const pageDescription = view === "register"
    ? "Commencez à créer vos premières activités interactives."
    : view === "forgot"
      ? "Nous vous enverrons un lien de réinitialisation sécurisé."
      : view === "mfa"
        ? "Saisissez le code à six chiffres de votre application."
        : "Connectez-vous pour retrouver vos contenus et vos sessions.";

  const heroPanel = (
    <section className={styles.visual} aria-label="Présentation de Brivia">
      <img
        className={styles.visualImage}
        src="/images/auth-training-session.jpg"
        alt="Une formatrice anime une activité Brivia avec son groupe"
      />
      <div className={styles.visualScrim} aria-hidden="true" />
      <a
        className={styles.visualBrand}
        aria-label="Retour à l’accueil"
        href={marketingUrl("/")}
      >
        <span className={styles.brandMark}>
          <BrandMonogram size={22} diamondColor="#c7d2fe" />
        </span>
        <BrandWordmark size={24} color="#fff" />
      </a>
      <div className={styles.visualCopy}>
        <h1>Créez une session qui fait participer.</h1>
        <p>Quiz, sondages, présentations et évaluations réunis dans un même espace de travail.</p>
      </div>
    </section>
  );

  return (
    <main className={styles.shell}>
      {heroPanel}
      <section className={styles.formSide} aria-labelledby="auth-page-title">
        <div className={styles.formWrap}>
          <header className={styles.formIntro}>
            <h2 id="auth-page-title">{pageTitle}</h2>
            <p>{pageDescription}</p>
          </header>
          {authCard}
        </div>
      </section>
    </main>
  );
};

export default AuthPage;
