import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateCourseFromFile } from "@/lib/courseGenerator";
import { toast } from "sonner";

const ACCEPTED = [".pdf", ".docx", ".txt", ".md"];
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
];

const FILE_CHIPS = [
  { ext: "PDF",  color: "#ff5a4d", bg: "#fff3f0" },
  { ext: "DOCX", color: "#2f7bff", bg: "#eef4ff" },
  { ext: "TXT",  color: "#6d6288", bg: "#f3ecdd" },
  { ext: "MD",   color: "#15c08a", bg: "#e8faf3" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

type Phase = "idle" | "loading" | "done" | "error";

export const CourseGeneratorModal = ({ open, onClose }: Props) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  // WARNING: VITE_* env vars are inlined into the public JS bundle by Vite at build time.
  // Never set VITE_ANTHROPIC_API_KEY to a real key in a production deployment — it would be
  // extractable by anyone visiting the site. Only the per-session pasted key (below,
  // stored in sessionStorage) is safe for a publicly deployed instance.
  const [apiKey, setApiKey] = useState(
    () => import.meta.env.VITE_ANTHROPIC_API_KEY || sessionStorage.getItem("anthropic_key") || ""
  );

  const envKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY;

  const accept = (f: File) => {
    const ok = ACCEPTED_MIME.includes(f.type) || ACCEPTED.some((e) => f.name.toLowerCase().endsWith(e));
    if (!ok) { toast.error("Format non supporté (PDF, DOCX, TXT, MD)"); return; }
    setFile(f);
    setError("");
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) accept(f);
  }, []);

  const generate = async () => {
    if (!file) return;
    const key = apiKey.trim();
    if (!key) { setError("Clé API Anthropic requise"); return; }
    if (!envKey) sessionStorage.setItem("anthropic_key", key);

    setPhase("loading"); setError("");

    try {
      const courseId = await generateCourseFromFile(file, key, (msg) => setProgress(msg));
      setPhase("done");
      toast.success("Cours généré !");
      setTimeout(() => {
        onClose();
        navigate(`/course-builder?courseId=${courseId}`);
      }, 900);
    } catch (e) {
      setPhase("error");
      setError((e as Error).message);
    }
  };

  const reset = () => {
    setFile(null); setPhase("idle"); setProgress(""); setError("");
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(36,27,58,.55)", backdropFilter:"blur(4px)" }}
        onClick={() => { if (phase !== "loading") { reset(); onClose(); } }}
      />

      {/* Modal */}
      <div style={{
        position:"fixed", inset:0, zIndex:201, display:"flex", alignItems:"center", justifyContent:"center",
        padding:24, pointerEvents:"none",
      }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents:"auto", width:"100%", maxWidth:520,
            background:"var(--ap-card)", borderRadius:"var(--ap-r-lg)",
            border:"2px solid var(--ap-line)", boxShadow:"0 8px 0 var(--ap-line), 0 40px 80px rgba(36,27,58,.25)",
            padding:32,
            animation:"modal-in .3s cubic-bezier(.2,.7,.3,1.3)",
          }}
        >
          <style>{`@keyframes modal-in{from{opacity:0;transform:scale(.92) translateY(12px)}}`}</style>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
            <div>
              <h2 style={{ fontFamily:"var(--ap-font-display)", fontWeight:600, fontSize:22, marginBottom:4 }}>
                ✨ Générer un cours
              </h2>
              <p style={{ fontSize:13, fontWeight:700, color:"var(--ap-muted)" }}>
                Conforme Qualiopi · progression pédagogique + quiz par module
              </p>
            </div>
            {phase !== "loading" && (
              <button
                onClick={() => { reset(); onClose(); }}
                style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ap-muted)", fontSize:20, lineHeight:1, padding:4, marginTop:-4 }}
              >✕</button>
            )}
          </div>

          {/* File chips */}
          <div style={{ display:"flex", gap:6, marginBottom:20 }}>
            {FILE_CHIPS.map((c) => (
              <span key={c.ext} style={{ fontSize:11, fontWeight:800, letterSpacing:".06em", padding:"4px 10px", borderRadius:999, color:c.color, background:c.bg }}>
                {c.ext}
              </span>
            ))}
          </div>

          {/* Drop zone */}
          {phase === "idle" && (
            <div
              ref={dropRef}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                border:`2px dashed ${dragging ? "var(--ap-brand)" : file ? "var(--ap-pres)" : "var(--ap-line-2)"}`,
                borderRadius:"var(--ap-r-md)", padding:"28px 20px",
                display:"flex", flexDirection:"column", alignItems:"center", gap:10,
                cursor:"pointer", background: file ? "var(--ap-pres-soft)" : dragging ? "var(--ap-brand-soft)" : "var(--ap-paper)",
                transition:"border-color .2s, background .2s",
                marginBottom:16,
              }}
            >
              <input
                ref={inputRef} type="file"
                accept={ACCEPTED.join(",")} style={{ display:"none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) accept(f); }}
              />
              {file ? (
                <>
                  <div style={{ fontSize:36 }}>📄</div>
                  <div style={{ fontWeight:800, fontSize:14, color:"var(--ap-pres-deep)", textAlign:"center" }}>{file.name}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--ap-muted)" }}>
                    {(file.size / 1024).toFixed(0)} Ko · Cliquer pour changer
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:40 }}>📂</div>
                  <div style={{ fontWeight:800, fontSize:14, color:"var(--ap-ink)", textAlign:"center" }}>
                    Glissez votre fichier ici
                  </div>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--ap-muted)" }}>
                    ou cliquez pour parcourir
                  </div>
                </>
              )}
            </div>
          )}

          {/* API key input (if no env var) */}
          {!envKey && phase === "idle" && (
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:800, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ap-muted)", marginBottom:6 }}>
                Clé API Anthropic
              </label>
              <input
                type="password"
                placeholder="sk-ant-api03-…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{
                  width:"100%", padding:"10px 14px",
                  fontFamily:"var(--ap-font-mono)", fontWeight:700, fontSize:13,
                  color:"var(--ap-ink)", background:"var(--ap-paper-2)",
                  border:"2px solid var(--ap-line)", borderRadius:"var(--ap-r-sm)",
                  outline:"none", boxSizing:"border-box",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--ap-brand)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--ap-line)"; }}
              />
              <p style={{ fontSize:11, color:"var(--ap-muted)", fontWeight:700, marginTop:5 }}>
                Clé stockée en session uniquement. Ou ajoutez <code style={{ fontFamily:"var(--ap-font-mono)", background:"var(--ap-paper-2)", padding:"1px 5px", borderRadius:4 }}>VITE_ANTHROPIC_API_KEY</code> dans <code style={{ fontFamily:"var(--ap-font-mono)", background:"var(--ap-paper-2)", padding:"1px 5px", borderRadius:4 }}>.env.local</code>.
              </p>
            </div>
          )}

          {/* Loading state */}
          {phase === "loading" && (
            <div style={{ padding:"32px 0", textAlign:"center" }}>
              <div style={{ marginBottom:20 }}>
                <svg width="48" height="48" viewBox="0 0 48 48" style={{ animation:"spin 1.2s linear infinite" }}>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <circle cx="24" cy="24" r="20" fill="none" stroke="var(--ap-line-2)" strokeWidth="4"/>
                  <circle cx="24" cy="24" r="20" fill="none" stroke="var(--ap-brand)" strokeWidth="4"
                    strokeDasharray="125" strokeDashoffset="90" strokeLinecap="round"/>
                </svg>
              </div>
              <p style={{ fontFamily:"var(--ap-font-display)", fontWeight:600, fontSize:17, marginBottom:8 }}>
                Génération en cours…
              </p>
              <p style={{ fontSize:13, fontWeight:700, color:"var(--ap-muted)" }}>{progress}</p>
              <p style={{ fontSize:11, color:"var(--ap-muted)", marginTop:12, fontWeight:700 }}>
                Peut prendre 20 à 60 secondes selon la taille du document
              </p>
            </div>
          )}

          {/* Done */}
          {phase === "done" && (
            <div style={{ padding:"32px 0", textAlign:"center" }}>
              <div style={{ fontSize:52, marginBottom:12 }}>🎉</div>
              <p style={{ fontFamily:"var(--ap-font-display)", fontWeight:600, fontSize:18 }}>Cours créé !</p>
              <p style={{ fontSize:13, fontWeight:700, color:"var(--ap-muted)", marginTop:6 }}>
                Redirection vers l'éditeur…
              </p>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div style={{
              background:"var(--ap-quiz-soft)", border:"2px solid rgba(255,90,77,.4)",
              borderRadius:"var(--ap-r-md)", padding:"14px 16px", marginBottom:16,
            }}>
              <p style={{ fontSize:13, fontWeight:800, color:"var(--ap-quiz-deep)", marginBottom:4 }}>Erreur</p>
              <p style={{ fontSize:12, fontWeight:700, color:"var(--ap-quiz-deep)", wordBreak:"break-all" }}>{error}</p>
            </div>
          )}

          {/* Error inline (validation) */}
          {error && phase === "idle" && (
            <p style={{ fontSize:12, fontWeight:800, color:"var(--ap-quiz-deep)", marginBottom:12 }}>{error}</p>
          )}

          {/* Actions */}
          {(phase === "idle" || phase === "error") && (
            <div style={{ display:"flex", gap:10, marginTop:4 }}>
              {phase === "error" && (
                <button
                  onClick={reset}
                  style={{
                    flex:1, padding:"13px 0", borderRadius:999, border:"2px solid var(--ap-line)",
                    background:"var(--ap-card)", fontFamily:"var(--ap-font-body)", fontWeight:800, fontSize:15,
                    color:"var(--ap-ink)", cursor:"pointer",
                  }}
                >
                  ← Recommencer
                </button>
              )}
              <button
                onClick={generate}
                disabled={!file}
                style={{
                  flex:1, padding:"13px 0", borderRadius:999, border:"none",
                  background: !file ? "var(--ap-line-2)" : "var(--ap-brand)",
                  color:"#fff", fontFamily:"var(--ap-font-body)", fontWeight:800, fontSize:15,
                  cursor: !file ? "not-allowed" : "pointer",
                  boxShadow: !file ? "none" : "0 4px 0 var(--ap-brand-deep)",
                  transition:"transform .15s, box-shadow .15s, filter .15s",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                }}
                onMouseEnter={(e) => { if (file) { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.filter="brightness(1.06)"; } }}
                onMouseLeave={(e) => { e.currentTarget.style.transform=""; e.currentTarget.style.filter=""; }}
              >
                ✨ Générer le cours
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
