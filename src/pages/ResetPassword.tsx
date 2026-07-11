import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updatePassword } from "@/lib/auth";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

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

// The Supabase recovery link signs the user in on arrival; this page only
// has to collect the new password. An MFA-enrolled user landing at AAL1 gets
// the Supabase error surfaced and can change their password from Settings
// after a normal sign-in instead.
const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error(t("passwordTooShort")); return; }
    if (password !== confirm) { toast.error(t("passwordsDontMatch")); return; }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.ok) {
      toast.success(t("passwordUpdated"));
      navigate("/");
    } else {
      toast.error(result.message ?? t("loginError"));
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div className="ap-card ap-card--floaty" style={{ width: "100%", maxWidth: "420px", padding: "32px" }}>
        <h1 className="ap-h3" style={{ marginBottom: "20px" }}>{t("newPasswordTitle")}</h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>{t("newPassword")}</label>
            <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" />
          </div>
          <div>
            <label style={labelStyle}>{t("confirmNewPassword")}</label>
            <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} placeholder="••••••••" />
          </div>
          <button type="submit" className="ap-btn ap-btn--pill" disabled={busy} style={{ width: "100%" }}>
            {t("saveChanges")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
