import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { login, register } from "@/lib/auth";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

const AuthPage = () => {
  const navigate = useNavigate();
  usePageTitle("Connexion");
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ email: "", username: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = await login(loginData.email, loginData.password);
    if (user) {
      toast.success(t("loginSuccess"));
      navigate("/");
    } else {
      toast.error(t("loginError"));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = await register(registerData.email, registerData.username, registerData.password);
    if (user) {
      toast.success(t("registerSuccess"));
      navigate("/");
    } else {
      toast.error(t("emailAlreadyUsed"));
    }
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--ap-paper)",
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
          <h1 className="ap-h2" style={{ fontSize: "28px", marginBottom: "6px" }}>QuizMaster</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>Bienvenue sur la plateforme de quiz interactifs</p>
        </div>

        {/* Card */}
        <div className="ap-card ap-card--floaty" style={{ padding: "32px" }}>
          {/* Tab switcher */}
          <div className="ap-seg" style={{ marginBottom: "24px" }}>
            <button
              className={tab === "login" ? "is-on" : ""}
              onClick={() => setTab("login")}
            >
              Se connecter
            </button>
            <button
              className={tab === "register" ? "is-on" : ""}
              onClick={() => setTab("register")}
            >
              S'inscrire
            </button>
          </div>

          {tab === "login" && (
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
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--ap-brand)";
                    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--ap-line)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
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
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--ap-brand)";
                    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--ap-line)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
              <button
                type="submit"
                className="ap-btn ap-btn--pill"
                style={{ width: "100%", marginTop: "4px" }}
              >
                Se connecter
              </button>
            </form>
          )}

          {tab === "register" && (
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
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--ap-brand)";
                    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--ap-line)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
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
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--ap-brand)";
                    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--ap-line)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>Mot de passe</label>
                <input
                  type="password"
                  required
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  style={inputStyle}
                  placeholder="••••••••"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--ap-brand)";
                    e.currentTarget.style.boxShadow = "0 0 0 4px var(--ap-brand-soft)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--ap-line)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
              <button
                type="submit"
                className="ap-btn ap-btn--pill"
                style={{ width: "100%", marginTop: "4px" }}
              >
                S'inscrire
              </button>
            </form>
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
