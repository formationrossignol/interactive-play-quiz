import { AppLayout } from "@/components/AppLayout";

const NotFound = () => {
  return (
    <AppLayout>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "128px 24px", textAlign: "center" }}>
        <p
          style={{
            fontFamily: "var(--ap-font-display)", fontWeight: 600,
            fontSize: "96px", color: "var(--ap-line)", marginBottom: "16px", lineHeight: 1,
          }}
        >
          404
        </p>
        <h1 className="ap-h2" style={{ marginBottom: "12px", fontSize: "28px" }}>Page introuvable</h1>
        <p className="ap-muted" style={{ marginBottom: "32px", fontSize: "16px" }}>
          La page que vous cherchez n'existe pas.
        </p>
        {/* / now lives in apps/marketing — full navigation. */}
        <a className="ap-btn ap-btn--pill" href="/">
          Retour à l'accueil
        </a>
      </div>
    </AppLayout>
  );
};

export default NotFound;
