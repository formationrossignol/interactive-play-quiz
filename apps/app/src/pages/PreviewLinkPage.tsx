import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeletons";
import { resolvePreviewLink, type ResolvedPreview } from "@/lib/lms/previewLinks";

/** PUB-004 — the reviewer's whole path, no Brivia account needed. Renders a
 *  *generic* read-only view of the content snapshot (title + a structured
 *  dump), not a rich per-type player: reusing each builder's actual player
 *  component for an unauthenticated, sandboxed context is its own project,
 *  not guessed at here — same posture as contentDiff.ts's generic diff. */
function GenericSnapshotView({ snapshot }: { snapshot: Record<string, unknown> }) {
  const title = typeof snapshot.title === "string" ? snapshot.title : null;
  const { title: _omit, ...rest } = snapshot;
  return (
    <div className="space-y-3">
      {title && <h1 className="text-xl font-semibold">{title}</h1>}
      <pre className="rounded-md border p-4 text-xs overflow-x-auto whitespace-pre-wrap" style={{ borderColor: "var(--ap-line)" }}>
        {JSON.stringify(rest, null, 2)}
      </pre>
    </div>
  );
}

export default function PreviewLinkPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "needs_password" | "error" | "ready">("loading");
  const [preview, setPreview] = useState<ResolvedPreview | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const attempt = async (pwd?: string) => {
    if (!token) return;
    try {
      const resolved = await resolvePreviewLink(token, pwd);
      setPreview(resolved);
      setState("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "Mot de passe incorrect.") {
        setState("needs_password");
        setError(pwd ? message : "");
      } else {
        setState("error");
        setError(message);
      }
    }
  };

  useEffect(() => {
    void attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await attempt(password);
    setSubmitting(false);
  };

  if (state === "loading") {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <PageSkeleton />
      </div>
    );
  }

  if (state === "needs_password") {
    return (
      <div className="max-w-sm mx-auto p-6 mt-16 text-center space-y-4">
        <Lock size={28} className="mx-auto text-muted-foreground" />
        <h1 className="text-lg font-semibold">Aperçu protégé</h1>
        <form onSubmit={handleSubmitPassword} className="space-y-2">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" />
          {error && <p className="text-sm" style={{ color: "var(--ap-danger, #b91c1c)" }}>{error}</p>}
          <Button type="submit" loading={submitting} className="w-full">Accéder</Button>
        </form>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="max-w-sm mx-auto p-6 mt-16 text-center space-y-3">
        <ShieldAlert size={28} className="mx-auto text-muted-foreground" />
        <h1 className="text-lg font-semibold">Aperçu indisponible</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="relative max-w-3xl mx-auto p-6">
      {preview.watermark && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden select-none"
          style={{ opacity: 0.08 }}
        >
          <div style={{ transform: "rotate(-30deg)", fontSize: "3rem", fontWeight: 700, whiteSpace: "nowrap", color: "var(--ap-ink)" }}>
            {"APERÇU — NE PAS DIFFUSER  ".repeat(6)}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground mb-3">Aperçu — v{preview.version} · {preview.type}</p>
      <GenericSnapshotView snapshot={preview.snapshot} />
    </div>
  );
}
