import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MultiStepProgress } from "@/components/MultiStepProgress";
import { QRCodeGenerator } from "@/components/QRCodeGenerator";
import { AvatarDisplay } from "@/components/BetterAvatars";
import type { SavedQuiz } from "@/lib/quizStorage";
import {
  ensureSessionState,
  ensureSessionInSupabase,
  readSessionState,
  patchSessionState,
  subscribeToSessionState,
  type SharedPlayer,
} from "@/lib/sessionState";
import {
  savePollSession,
  getPollOptions,
  type PollQuestionResult,
  type PollResultSession,
} from "@/lib/pollResults";

interface PollSessionProps {
  poll: SavedQuiz;
}

type PollQuestion = {
  id?: string;
  type: string;
  question?: string;
  answers?: string[];
  allowMultiple?: boolean;
  scale?: string[];
  items?: string[];
  maxStars?: number;
  maxLength?: number;
  minLabel?: string;
  maxLabel?: string;
  image?: string;
};

const POLL_BAR_COLORS = ["#2f7bff", "#15c08a", "#ffb020", "#ff5a4d", "#7048ff", "#0ea5b7"];

export const PollSession = ({ poll }: PollSessionProps) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "live">("lobby");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [players, setPlayers] = useState<SharedPlayer[]>([]);
  const [sessionReady, setSessionReady] = useState(false);
  // bumped whenever a new answer is counted, so live bars re-render
  const [, setResponseVersion] = useState(0);

  const sessionIdRef = useRef(`${poll.id}-${Date.now()}`);
  const startTimeRef = useRef(new Date().toISOString());
  // accumulated answer counts per question: Map<questionIndex, Map<answerKey, count>>
  const responsesRef = useRef<Map<number, Map<string, number>>>(new Map());
  // free-text answers per question: Map<questionIndex, Map<playerId, text>>
  const textResponsesRef = useRef<Map<number, Map<string, string>>>(new Map());
  // track which player+question combos we've already counted
  const seenRef = useRef<Set<string>>(new Set());
  const isAdvancingRef = useRef(false);
  const finishedRef = useRef(false);

  const totalQuestions = poll.questions.length;
  const currentQuestion = useMemo(
    () => poll.questions[currentIndex] as PollQuestion,
    [poll.questions, currentIndex]
  );
  const joinUrl = `${window.location.origin}/join/${poll.id}`;

  const collectAnswers = useCallback((sessionPlayers: SharedPlayer[]) => {
    let changed = false;
    sessionPlayers.forEach((player) => {
      if (typeof player.lastAnswerQuestionIndex !== "number") return;
      const qIdx = player.lastAnswerQuestionIndex;

      // Free-text answers (open-text) — keep latest text per player
      if (player.lastAnswerText) {
        if (!textResponsesRef.current.has(qIdx)) textResponsesRef.current.set(qIdx, new Map());
        const tMap = textResponsesRef.current.get(qIdx)!;
        if (tMap.get(player.id) !== player.lastAnswerText) {
          tMap.set(player.id, player.lastAnswerText);
          changed = true;
        }
      }

      if (player.lastAnswer === undefined || player.lastAnswer === null) return;
      const key = `${player.id}:${qIdx}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      changed = true;

      if (!responsesRef.current.has(qIdx)) {
        responsesRef.current.set(qIdx, new Map());
      }
      const qMap = responsesRef.current.get(qIdx)!;
      const answerKey = String(player.lastAnswer);
      qMap.set(answerKey, (qMap.get(answerKey) ?? 0) + 1);
    });
    if (changed) setResponseVersion((v) => v + 1);
  }, []);

  const buildResults = useCallback((): PollQuestionResult[] => {
    return poll.questions.map((q: PollQuestion, idx: number) => {
      const qMap = responsesRef.current.get(idx);
      const options = getPollOptions(q);
      const distribution = options.map((_, i) => qMap?.get(String(i)) ?? 0);
      const texts = Array.from(textResponsesRef.current.get(idx)?.values() ?? []);
      const totalResponses = distribution.reduce((s, n) => s + n, 0) + (q.type === "open-text" ? texts.length : 0);
      return {
        questionIndex: idx,
        question: q.question ?? `Question ${idx + 1}`,
        type: q.type,
        answers: options,
        distribution,
        totalResponses,
        textResponses: texts.length ? texts : undefined,
      };
    });
  }, [poll.questions]);

  const saveResults = useCallback(() => {
    const session: PollResultSession = {
      sessionId: sessionIdRef.current,
      date: startTimeRef.current,
      totalParticipants: players.length,
      questions: buildResults(),
    };
    savePollSession(poll.id, poll.title, session);
  }, [players.length, buildResults, poll.id, poll.title]);

  useEffect(() => {
    ensureSessionState(poll.id);
    ensureSessionInSupabase(poll.id, { questions: poll.questions, title: poll.title, type: "poll" })
      .then(() => setSessionReady(true))
      .catch(() => toast.error("Erreur Supabase : les participants ne pourront pas rejoindre."));
    patchSessionState(poll.id, { gameState: "waiting", currentQuestionIndex: 0 });

    const initial = readSessionState(poll.id);
    setPlayers(initial.players);
    collectAnswers(initial.players);

    const channel = subscribeToSessionState(poll.id, (state) => {
      setPlayers(state.players);
      collectAnswers(state.players);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [poll.id, poll.title, poll.questions, collectAnswers]);

  // Auto-save results on question change + tell players the session is over if the host leaves
  useEffect(() => {
    if (phase === "live") saveResults();
  }, [currentIndex, phase, saveResults]);

  useEffect(() => {
    return () => {
      saveResults();
      if (!finishedRef.current) {
        patchSessionState(poll.id, { gameState: "abandoned" });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = () => {
    setPhase("live");
    setCurrentIndex(0);
    patchSessionState(poll.id, { gameState: "question", currentQuestionIndex: 0 });
  };

  const goTo = (index: number) => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    setTimeout(() => { isAdvancingRef.current = false; }, 400);
    const next = Math.max(0, Math.min(index, totalQuestions - 1));
    setCurrentIndex(next);
    patchSessionState(poll.id, { gameState: "question", currentQuestionIndex: next });
  };

  const handleFinish = () => {
    finishedRef.current = true;
    patchSessionState(poll.id, { gameState: "final" });
    saveResults();
    navigate(`/poll-results/${poll.id}`);
  };

  /* ── Empty poll ── */
  if (totalQuestions === 0) {
    return (
      <div style={pageSt}>
        <div style={{ maxWidth: 520, margin: "80px auto 0", padding: "0 20px" }}>
          <div className="ap-card" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <h1 className="ap-h3" style={{ fontSize: 22, marginBottom: 8 }}>{poll.title || "Sondage"}</h1>
            <p style={{ fontWeight: 700, color: "var(--ap-muted)", marginBottom: 20 }}>
              Ce sondage ne contient aucune question. Ajoutez des questions dans l'éditeur avant de le lancer.
            </p>
            <button className="ap-btn ap-btn--poll ap-btn--pill" onClick={() => navigate("/my-polls")}>
              Retour à mes sondages
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Lobby ── */
  if (phase === "lobby") {
    return (
      <div style={{ ...pageSt, display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <div style={topbarSt}>
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={logoSt} aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff"><path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8z"/></svg>
            </span>
            <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 19 }}>Ludiq</span>
          </span>
          <span style={{ fontWeight: 800, fontSize: 15, color: "var(--ap-muted)" }}>
            · Sondage : <b style={{ color: "var(--ap-ink)" }}>{poll.title}</b>
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => navigate("/my-polls")}
            style={quitBtnSt}
          >
            🚪 Quitter
          </button>
        </div>

        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "380px 1fr", gap: 26, maxWidth: 1240, margin: "0 auto", width: "100%", padding: "8px 24px 120px", alignItems: "start" }}>
          {/* Join card */}
          <aside style={joinCardSt} aria-label="Comment rejoindre le sondage">
            <h2 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 21, marginBottom: 4 }}>Rejoignez le sondage</h2>
            <p style={{ fontWeight: 800, fontSize: 15, color: "var(--ap-muted)", marginBottom: 18 }}>
              Sur <b style={{ color: "var(--ap-poll-deep)" }}>ludiq.app</b>, entrez le code
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
              <div>
                <p style={smallLabelSt}>Code du sondage</p>
                <div style={{ background: "var(--ap-paper-2)", border: "2px dashed var(--ap-line-2)", borderRadius: "var(--ap-r-md)", padding: "16px 10px", overflow: "hidden" }}>
                  <div style={{ fontFamily: "var(--ap-font-mono)", fontWeight: 700, fontSize: poll.id.length > 8 ? Math.max(14, 32 - (poll.id.length - 6) * 1.8) : 32, letterSpacing: ".08em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, color: "var(--ap-ink)", wordBreak: "break-all" }} aria-label={`Code : ${poll.id}`}>
                    {poll.id.slice(0, 3)}<span style={{ color: "var(--ap-poll)" }}>{poll.id.slice(3)}</span>
                  </div>
                </div>
              </div>
              <span style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 13, color: "var(--ap-line-2)", textTransform: "uppercase" }} aria-hidden="true">ou</span>
              <div>
                <p style={smallLabelSt}>Scannez</p>
                <div style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)", padding: 8, boxShadow: "0 3px 0 var(--ap-line)", display: "grid", placeItems: "center" }}>
                  {sessionReady ? (
                    <QRCodeGenerator gameCode={poll.id} joinUrl={joinUrl} compact compactSize={108} />
                  ) : (
                    <div style={{ width: 108, height: 108, display: "grid", placeItems: "center", color: "var(--ap-muted)", fontSize: 12, fontWeight: 700 }}>Chargement…</div>
                  )}
                </div>
              </div>
            </div>

            {sessionReady && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  className="ap-btn ap-btn--sm ap-btn--ghost"
                  style={{ flex: 1 }}
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(joinUrl); toast.success("Lien copié !"); }
                    catch { toast.error("Échec de la copie"); }
                  }}
                >
                  Copier le lien
                </button>
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, background: "var(--ap-poll-soft)", border: "2px solid rgba(47,123,255,.35)", borderRadius: "var(--ap-r-md)", padding: "10px 14px", textAlign: "left", display: "flex", gap: 9, alignItems: "flex-start", color: "var(--ap-poll-deep)" }}>
              <span aria-hidden="true">💡</span>
              <span>{totalQuestions} question{totalQuestions > 1 ? "s" : ""} · les réponses sont anonymes et agrégées en direct.</span>
            </div>
          </aside>

          {/* Participants */}
          <section aria-label="Participants connectés">
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "4px 2px 16px" }}>
              <h2 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 22, margin: 0 }}>Participants</h2>
              <span style={{ fontFamily: "var(--ap-font-mono)", fontWeight: 700, fontSize: 15, fontVariantNumeric: "tabular-nums", color: "var(--ap-poll-deep)", background: "var(--ap-poll-soft)", border: "2px solid rgba(47,123,255,.4)", borderRadius: 999, padding: "4px 13px" }} role="status" aria-live="polite">
                {players.length}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(128px,1fr))", gap: 13 }}>
              {players.map((player) => (
                <div key={player.id} style={{ background: "var(--ap-card)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)", padding: "15px 10px 13px", textAlign: "center", boxShadow: "0 4px 0 var(--ap-line)" }}>
                  <div style={{ width: 52, height: 52, margin: "0 auto 8px", borderRadius: "50%", background: "var(--ap-paper-2)", border: "2px solid var(--ap-line)", display: "grid", placeItems: "center" }} aria-hidden="true">
                    <AvatarDisplay emoji={player.avatar} size="sm" />
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{player.name}</span>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
                <div key={`ghost-${i}`} style={{ border: "2px dashed var(--ap-line-2)", borderRadius: "var(--ap-r-md)", display: "grid", placeItems: "center", minHeight: 118, color: "var(--ap-line-2)", fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: 22 }} aria-hidden="true">?</div>
              ))}
            </div>
          </section>
        </div>

        {/* Launch bar */}
        <div style={bottomBarSt}>
          <div style={bottomBarInnerSt}>
            <span style={{ fontWeight: 800, fontSize: 14, color: "var(--ap-muted)" }}>
              {players.length === 0 ? "Vous pouvez lancer sans attendre — les participants rejoignent à tout moment." : `${players.length} participant${players.length > 1 ? "s" : ""} prêt${players.length > 1 ? "s" : ""}.`}
            </span>
            <div style={{ flex: 1 }} />
            <button className="ap-btn ap-btn--poll ap-btn--lg ap-btn--pill" onClick={handleStart}>
              Lancer le sondage →
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Live ── */
  const isLast = currentIndex === totalQuestions - 1;
  const options = getPollOptions(currentQuestion);
  const qMap = responsesRef.current.get(currentIndex);
  const counts = options.map((_, i) => qMap?.get(String(i)) ?? 0);
  const totalVotes = counts.reduce((s, n) => s + n, 0);
  const maxCount = Math.max(...counts, 1);
  const texts = Array.from(textResponsesRef.current.get(currentIndex)?.values() ?? []);
  const answeredCount = currentQuestion.type === "open-text" ? texts.length : totalVotes;

  return (
    <div style={{ ...pageSt, paddingBottom: 110 }}>
      {/* Topbar */}
      <div style={{ ...topbarSt, position: "sticky", top: 0, zIndex: 20, background: "var(--ap-card)", borderBottom: "2px solid var(--ap-line)" }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ap-poll-deep)", background: "var(--ap-poll-soft)", border: "2px solid rgba(47,123,255,.35)", padding: "5px 13px", borderRadius: 999 }}>
          📊 Sondage en direct
        </span>
        <span style={{ fontWeight: 800, fontSize: 14, color: "var(--ap-muted)" }}>
          Question {currentIndex + 1} / {totalQuestions}
        </span>
        <div style={{ flex: 1 }} />
        <span
          role="status"
          aria-live="polite"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            fontFamily: "var(--ap-font-mono)", fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums",
            color: answeredCount > 0 && answeredCount >= players.length && players.length > 0 ? "var(--ap-pres-deep)" : "var(--ap-ink)",
            background: answeredCount > 0 && answeredCount >= players.length && players.length > 0 ? "var(--ap-pres-soft)" : "var(--ap-paper-2)",
            border: "2px solid var(--ap-line)", borderRadius: 999, padding: "5px 13px",
          }}
        >
          ✍️ {answeredCount}<span style={{ color: "var(--ap-muted)" }}>/{Math.max(players.length, answeredCount)}</span> réponse{answeredCount > 1 ? "s" : ""}
        </span>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "22px 20px 0" }}>
        <MultiStepProgress totalSteps={totalQuestions} currentStep={currentIndex} className="mb-6" />

        {/* Question card */}
        <div className="ap-card" style={{ padding: "28px 28px 24px" }}>
          <h1 style={{ fontFamily: "var(--ap-font-display)", fontWeight: 600, fontSize: "clamp(20px,3vw,28px)", lineHeight: 1.25, margin: "0 0 6px", textAlign: "center" }}>
            {currentQuestion?.question || `Question ${currentIndex + 1}`}
          </h1>
          {currentQuestion?.image && (
            <div style={{ margin: "14px auto 4px", maxWidth: 480, overflow: "hidden", borderRadius: "var(--ap-r-md)", border: "2px solid var(--ap-line)" }}>
              <img src={currentQuestion.image} alt="Illustration" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
            </div>
          )}

          <div style={{ marginTop: 22 }}>
            {options.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {options.map((option, index) => {
                  const count = counts[index];
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  const barPct = (count / maxCount) * 100;
                  const color = POLL_BAR_COLORS[index % POLL_BAR_COLORS.length];
                  return (
                    <div key={`${option}-${index}`} style={{ position: "relative", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)", overflow: "hidden", background: "var(--ap-paper)" }}>
                      {/* Live fill bar */}
                      <div style={{ position: "absolute", inset: 0, width: `${totalVotes > 0 ? barPct : 0}%`, background: `${color}1f`, borderRight: count > 0 ? `2px solid ${color}55` : "none", transition: "width .5s cubic-bezier(.2,.7,.3,1)" }} aria-hidden="true" />
                      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}>
                        <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14, color: "#fff", background: color, boxShadow: `0 3px 0 ${color}99` }}>
                          {String.fromCharCode(65 + (index % 26))}
                        </span>
                        <span style={{ flex: 1, fontWeight: 800, fontSize: 15 }}>{option}</span>
                        <span style={{ fontFamily: "var(--ap-font-mono)", fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums", color: "var(--ap-muted)" }}>
                          {count} · {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : currentQuestion?.type === "open-text" ? (
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 10 }}>
                  Réponses libres ({texts.length})
                </p>
                {texts.length === 0 ? (
                  <div style={{ border: "2px dashed var(--ap-line-2)", borderRadius: "var(--ap-r-md)", padding: "22px 16px", textAlign: "center", fontWeight: 700, color: "var(--ap-muted)" }}>
                    En attente des premières réponses…
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                    {texts.slice().reverse().map((t, i) => (
                      <div key={i} style={{ background: "var(--ap-paper)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)", padding: "10px 14px", fontWeight: 700, fontSize: 14 }}>
                        💬 {t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : currentQuestion?.type === "ranking" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(currentQuestion.items || []).filter((item) => item?.trim()).map((item, index) => (
                  <div key={`${item}-${index}`} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--ap-paper)", border: "2px solid var(--ap-line)", borderRadius: "var(--ap-r-md)", padding: "12px 16px" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, color: "#fff", background: "var(--ap-poll)" }}>{index + 1}</span>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ border: "2px dashed var(--ap-line-2)", borderRadius: "var(--ap-r-md)", padding: "22px 16px", textAlign: "center", fontWeight: 700, color: "var(--ap-muted)" }}>
                Ce type de question n'a pas d'options configurées.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom control bar */}
      <div style={bottomBarSt}>
        <div style={bottomBarInnerSt}>
          <button
            className="ap-btn ap-btn--ghost ap-btn--sm ap-btn--pill"
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            style={{ opacity: currentIndex === 0 ? 0.45 : 1 }}
          >
            ← Précédent
          </button>
          <div style={{ flex: 1 }} />
          {isLast ? (
            <button className="ap-btn ap-btn--poll ap-btn--lg ap-btn--pill" onClick={handleFinish}>
              🏁 Terminer et voir les résultats
            </button>
          ) : (
            <button className="ap-btn ap-btn--poll ap-btn--lg ap-btn--pill" onClick={() => goTo(currentIndex + 1)}>
              Question suivante →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Shared styles (Arcade Pop) ── */

const pageSt: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--ap-paper)",
  backgroundImage: "radial-gradient(var(--ap-line-2) 1px,transparent 1px)",
  backgroundSize: "28px 28px",
  fontFamily: "var(--ap-font-body)",
  color: "var(--ap-ink)",
  WebkitFontSmoothing: "antialiased",
};

const topbarSt: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 14,
  padding: "14px 24px", maxWidth: 1240, margin: "0 auto", width: "100%",
  boxSizing: "border-box",
};

const logoSt: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 12, background: "var(--ap-poll)",
  display: "grid", placeItems: "center", boxShadow: "0 4px 0 var(--ap-poll-deep)",
  transform: "rotate(-6deg)", flexShrink: 0,
};

const quitBtnSt: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  fontWeight: 800, fontSize: 13, color: "var(--ap-muted)", cursor: "pointer",
  background: "var(--ap-card)", border: "2px solid var(--ap-line)",
  borderRadius: 999, padding: "8px 15px", boxShadow: "0 3px 0 var(--ap-line)",
  fontFamily: "var(--ap-font-body)",
};

const joinCardSt: React.CSSProperties = {
  background: "var(--ap-card)", border: "2px solid var(--ap-line)",
  borderRadius: "var(--ap-r-lg)",
  boxShadow: "0 6px 0 var(--ap-line),0 30px 55px rgba(60,40,120,.1)",
  padding: 26, textAlign: "center", position: "sticky", top: 18,
};

const smallLabelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: ".09em",
  textTransform: "uppercase", color: "var(--ap-muted)", marginBottom: 8,
};

const bottomBarSt: React.CSSProperties = {
  position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30,
  background: "var(--ap-card)", borderTop: "2px solid var(--ap-line)",
  boxShadow: "0 -14px 34px rgba(60,40,120,.08)",
};

const bottomBarInnerSt: React.CSSProperties = {
  maxWidth: 1240, margin: "0 auto", padding: "14px 24px",
  display: "flex", alignItems: "center", gap: 16,
};
