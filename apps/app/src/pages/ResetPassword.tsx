import { useState } from "react";
import { updatePassword } from "@/lib/auth";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { PublicAccessShell } from "@/components/PublicAccessShell";
import styles from "@/components/PublicAccessShell.module.css";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("passwordsDontMatch"));
      return;
    }

    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.ok) {
      toast.success(t("passwordUpdated"));
      window.location.href = "/";
    } else {
      setError(result.message ?? t("loginError"));
    }
  };

  return (
    <PublicAccessShell
      title={t("newPasswordTitle")}
      description="Choisissez un mot de passe unique d’au moins huit caractères."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-password">{t("newPassword")}</label>
          <input
            id="new-password"
            className={styles.input}
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8 caractères minimum"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="confirm-password">{t("confirmNewPassword")}</label>
          <input
            id="confirm-password"
            className={styles.input}
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Saisissez-le à nouveau"
          />
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" className={styles.primaryButton} disabled={busy}>
          {busy ? "Enregistrement..." : t("saveChanges")}
        </button>
      </form>
    </PublicAccessShell>
  );
};

export default ResetPassword;
