import { useEffect, useState } from "react";
import { changePassword, enrollMfa, verifyMfaCode, unenrollMfa, getVerifiedTotpFactor, type MfaEnrollment } from "@/lib/auth";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { ShieldCheck, Shield, KeyRound } from "lucide-react";

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

const codeInputStyle: React.CSSProperties = {
  ...inputStyle,
  textAlign: "center",
  fontSize: "20px",
  letterSpacing: "6px",
};

export const SecuritySection = () => {
  /* Password change */
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  /* MFA */
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);

  useEffect(() => {
    void getVerifiedTotpFactor().then((f) => setMfaEnabled(!!f));
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error(t("passwordTooShort")); return; }
    if (newPw !== confirmPw) { toast.error(t("passwordsDontMatch")); return; }
    setPwBusy(true);
    const result = await changePassword(currentPw, newPw);
    setPwBusy(false);
    if (result === "ok") {
      toast.success(t("passwordChanged"));
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } else if (result === "wrong_password") {
      toast.error(t("wrongCurrentPassword"));
    } else {
      toast.error(t("loginError"));
    }
  };

  const handleStartEnroll = async () => {
    setMfaBusy(true);
    const data = await enrollMfa();
    setMfaBusy(false);
    if (data) setEnrollment(data);
    else toast.error(t("loginError"));
  };

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    setMfaBusy(true);
    const ok = await verifyMfaCode(enrollment.factorId, enrollCode);
    setMfaBusy(false);
    if (ok) {
      toast.success(t("mfaActivated"));
      setMfaEnabled(true);
      setEnrollment(null);
      setEnrollCode("");
    } else {
      toast.error(t("mfaInvalidCode"));
      setEnrollCode("");
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaBusy(true);
    const ok = await unenrollMfa(disableCode);
    setMfaBusy(false);
    if (ok) {
      toast.success(t("mfaDeactivated"));
      setMfaEnabled(false);
      setShowDisable(false);
      setDisableCode("");
    } else {
      toast.error(t("mfaInvalidCode"));
      setDisableCode("");
    }
  };

  return (
    <div className="ap-card ap-card--floaty" style={{ padding: "28px 32px" }}>
      <h2 className="ap-h3" style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <KeyRound style={{ width: 18, height: 18 }} />
        {t("security")}
      </h2>

      {/* Change password */}
      <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "28px" }}>
        <div>
          <label style={labelStyle}>{t("currentPassword")}</label>
          <input type="password" required autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t("newPassword")}</label>
          <input type="password" required minLength={8} autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>{t("confirmNewPassword")}</label>
          <input type="password" required autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} style={inputStyle} />
        </div>
        <button type="submit" className="ap-btn ap-btn--pill" disabled={pwBusy} style={{ alignSelf: "flex-start" }}>
          {t("changePasswordAction")}
        </button>
      </form>

      {/* MFA */}
      <div style={{ borderTop: "2px solid var(--ap-line)", paddingTop: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          {mfaEnabled
            ? <ShieldCheck style={{ width: 18, height: 18, color: "var(--ap-quiz)" }} />
            : <Shield style={{ width: 18, height: 18, color: "var(--ap-muted)" }} />}
          <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 700, fontSize: "15px", color: "var(--ap-ink)" }}>{t("mfaTitle")}</span>
        </div>
        <p className="ap-muted" style={{ fontSize: "13px", marginBottom: "16px" }}>
          {mfaEnabled ? t("mfaStatusOn") : t("mfaStatusOff")}
        </p>

        {mfaEnabled === false && !enrollment && (
          <button className="ap-btn ap-btn--pill" disabled={mfaBusy} onClick={handleStartEnroll}>
            {t("mfaEnable")}
          </button>
        )}

        {enrollment && (
          <form onSubmit={handleVerifyEnroll} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p className="ap-muted" style={{ fontSize: "13px", margin: 0 }}>{t("mfaScanQr")}</p>
            <div style={{ background: "#fff", borderRadius: "var(--ap-r-md)", padding: "12px", width: "fit-content", border: "2px solid var(--ap-line)" }}>
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(enrollment.qrCodeSvg)}`}
                alt="QR code"
                width={180}
                height={180}
              />
            </div>
            <p className="ap-muted" style={{ fontSize: "12px", margin: 0, wordBreak: "break-all" }}>
              {t("mfaSecretFallback")} <code>{enrollment.secret}</code>
            </p>
            <div style={{ maxWidth: "220px" }}>
              <label style={labelStyle}>{t("mfaCodeLabel")}</label>
              <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus value={enrollCode} onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ""))} style={codeInputStyle} placeholder="000000" />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="ap-btn ap-btn--pill" disabled={mfaBusy}>{t("verify")}</button>
              <button type="button" className="ap-btn ap-btn--pill ap-btn--ghost" onClick={() => { setEnrollment(null); setEnrollCode(""); }}>{t("cancel")}</button>
            </div>
          </form>
        )}

        {mfaEnabled && !showDisable && (
          <button className="ap-btn ap-btn--pill ap-btn--ghost" onClick={() => setShowDisable(true)}>
            {t("mfaDisable")}
          </button>
        )}

        {mfaEnabled && showDisable && (
          <form onSubmit={handleDisable} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ maxWidth: "220px" }}>
              <label style={labelStyle}>{t("mfaCodeLabel")}</label>
              <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))} style={codeInputStyle} placeholder="000000" />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="ap-btn ap-btn--pill" disabled={mfaBusy}>{t("mfaDisable")}</button>
              <button type="button" className="ap-btn ap-btn--pill ap-btn--ghost" onClick={() => { setShowDisable(false); setDisableCode(""); }}>{t("cancel")}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
