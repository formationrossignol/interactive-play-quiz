import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateCourseFromFile } from "@/lib/courseGenerator";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

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
    setPhase("loading"); setError("");

    try {
      const courseId = await generateCourseFromFile(file, (msg) => setProgress(msg));
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
            border:"var(--ap-border-w) solid var(--ap-line)", boxShadow:"0 8px 0 var(--ap-line), 0 40px 80px rgba(36,27,58,.25)",
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
              <span key={c.ext} style={{ fontSize:11, fontWeight:800, letterSpacing:".06em", padding:"4px 10px", borderRadius:"var(--ap-r-sm)", color:c.color, background:c.bg }}>
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

          {/* Loading state */}
          {phase === "loading" && (
            <div style={{ padding:"32px 0", textAlign:"center" }}>
              <div role="status" aria-label="Génération du cours en cours">
                <Skeleton className="mx-auto mb-5 h-14 w-14 rounded-full" />
                <Skeleton className="mx-auto mb-3 h-6 w-52" />
                <Skeleton className="mx-auto mb-5 h-4 w-64 max-w-full" />
                <Skeleton className="mx-auto h-2.5 w-4/5 rounded-full" />
              </div>
              <p style={{ fontSize:13, fontWeight:700, color:"var(--ap-muted)", marginTop:14 }}>{progress}</p>
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
                    flex:1, padding:"13px 0", borderRadius:"var(--ap-r-sm)", border:"var(--ap-border-w) solid var(--ap-line)",
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
                  flex:1, padding:"13px 0", borderRadius:"var(--ap-r-sm)", border:"none",
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
