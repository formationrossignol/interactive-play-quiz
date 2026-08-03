"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ProductGlyph, type ProductGlyphName } from "@/components/ProductGlyph";
import styles from "./SignatureProductScene.module.css";

const STAGES = [
  {
    id: "compose",
    number: "01",
    label: "Concevoir",
    title: "La question prend forme.",
    description: "Le contenu, le rythme et l’intention pédagogique restent réunis dans un même espace.",
    glyph: "creation",
  },
  {
    id: "join",
    number: "02",
    label: "Rejoindre",
    title: "La salle devient active.",
    description: "Un code, un QR, aucun compte participant : l’attention reste sur la session.",
    glyph: "qr",
  },
  {
    id: "respond",
    number: "03",
    label: "Répondre",
    title: "Chaque réponse devient un signal.",
    description: "Questions, réactions et progression se lisent pendant que le groupe avance.",
    glyph: "live",
  },
  {
    id: "understand",
    number: "04",
    label: "Comprendre",
    title: "Le direct devient une décision.",
    description: "Les résultats prolongent la session avec une lecture claire et des exports exploitables.",
    glyph: "analytics",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  number: string;
  label: string;
  title: string;
  description: string;
  glyph: ProductGlyphName;
}>;

function ComposePanel() {
  return <div className={styles.composePanel}>
    <div className={styles.windowLabel}><span>Question / 01</span><strong>Brouillon enregistré</strong></div>
    <h3>Quel concept voulez-vous vérifier ?</h3>
    <div className={styles.composerAnswers}>
      <span><i />Une réponse précise</span>
      <span><i />Une alternative crédible</span>
      <span><i />Une idée à discuter</span>
      <span><i />Une réponse libre</span>
    </div>
    <div className={styles.composerFooter}><span>Temps · 30 s</span><span>Points · 1 000</span><strong>Prêt à lancer</strong></div>
  </div>;
}

function JoinPanel() {
  return <div className={styles.joinPanel}>
    <div className={styles.joinCopy}>
      <span className={styles.windowEyebrow}>Entrée instantanée</span>
      <h3>La salle rejoint le même rythme.</h3>
      <div className={styles.codeTiles} aria-label="Code de démonstration BRIVIA">
        {"BRIVIA".split("").map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}
      </div>
      <div className={styles.participantLine}>
        <div aria-hidden="true"><i /><i /><i /><i /></div>
        <span>Participants connectés</span>
      </div>
    </div>
    <div className={styles.qrObject}><ProductGlyph name="qr" /><span>Scanner pour rejoindre</span></div>
  </div>;
}

function RespondPanel() {
  return <div className={styles.respondPanel}>
    <div className={styles.questionProgress}><span>Question 03 / 08</span><i><b /></i></div>
    <h3>Quel mécanisme protège un compte avec un second facteur ?</h3>
    <div className={styles.liveAnswers}>
      <span className={styles.answerCoral}><i>01</i>MFA</span>
      <span className={styles.answerBlue}><i>02</i>VPN</span>
      <span className={styles.answerGreen}><i>03</i>WAF</span>
      <span className={styles.answerAmber}><i>04</i>RBAC</span>
    </div>
    <div className={styles.reactionStream} aria-label="Réactions en direct"><span>✦</span><span>●</span><span>♥</span><small>Réactions en direct</small></div>
  </div>;
}

function UnderstandPanel() {
  return <div className={styles.understandPanel}>
    <div className={styles.resultLead}><span>Lecture instantanée</span><h3>La compréhension devient visible.</h3></div>
    <div className={styles.resultChart} aria-label="Aperçu illustratif de résultats">
      <div><span>Bonne réponse</span><i><b className={styles.barStrong} /></i><strong>Majoritaire</strong></div>
      <div><span>À réexpliquer</span><i><b className={styles.barMedium} /></i><strong>À revoir</strong></div>
      <div><span>Sans réponse</span><i><b className={styles.barSoft} /></i><strong>Faible</strong></div>
    </div>
    <div className={styles.resultInsight}><ProductGlyph name="analytics" /><span><small>Signal utile</small><strong>Consolider le second facteur avant la suite.</strong></span></div>
  </div>;
}

export function SignatureProductScene() {
  const [activeStage, setActiveStage] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const sceneRef = useRef<HTMLElement>(null);
  const active = STAGES[activeStage];

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.28 });
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isVisible || isPaused || manualPaused || reduceMotion) return;
    const interval = window.setInterval(() => setActiveStage((current) => (current + 1) % STAGES.length), 5200);
    return () => window.clearInterval(interval);
  }, [isPaused, isVisible, manualPaused]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let next = activeStage;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = STAGES.length - 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (activeStage + 1) % STAGES.length;
    else next = (activeStage - 1 + STAGES.length) % STAGES.length;
    setActiveStage(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus();
  };

  return (
    <section
      ref={sceneRef}
      id="experience-signature"
      className={styles.scene}
      aria-labelledby="signature-title"
      onPointerEnter={() => setIsPaused(true)}
      onPointerLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className={styles.sceneGlow} aria-hidden="true" />
      <div className={styles.intro}>
        <div>
          <p>Le système Brivia</p>
          <h2 id="signature-title">Une idée entre. <span>Toute la salle répond.</span></h2>
        </div>
        <div className={styles.introCopy}>
          <p>De la première question à la lecture des résultats, chaque étape prolonge la précédente sans casser le rythme.</p>
          <span><i aria-hidden="true" /> Expérience produit · quatre actes</span>
        </div>
      </div>

      <div className={styles.stageShell}>
        <div className={styles.stageCore}>
          <div className={styles.stepRail} role="tablist" aria-label="Étapes de l’expérience Brivia" onKeyDown={onKeyDown}>
            <div className={styles.railHeader}>
              <span>Flux actif</span>
              <button type="button" className={styles.pauseControl} aria-pressed={manualPaused} onClick={() => setManualPaused((paused) => !paused)}>
                {manualPaused ? "Reprendre" : "Pause"}
              </button>
              <strong>{active.number} / 04</strong>
            </div>
            {STAGES.map((stage, index) => (
              <button
                key={stage.id}
                id={`signature-tab-${stage.id}`}
                type="button"
                role="tab"
                aria-selected={activeStage === index}
                aria-controls={`signature-panel-${stage.id}`}
                tabIndex={activeStage === index ? 0 : -1}
                className={activeStage === index ? styles.stepActive : undefined}
                onClick={() => setActiveStage(index)}
              >
                <span>{stage.number}</span>
                <i><ProductGlyph name={stage.glyph} /></i>
                <strong>{stage.label}</strong>
              </button>
            ))}
            <div className={`${styles.railProgress} ${isPaused || manualPaused ? styles.railProgressPaused : ""}`} aria-hidden="true"><i key={activeStage} /></div>
          </div>

          <div
            id={`signature-panel-${active.id}`}
            className={styles.visualStage}
            role="tabpanel"
            aria-labelledby={`signature-tab-${active.id}`}
            tabIndex={0}
          >
            <svg className={styles.signalPath} viewBox="0 0 960 720" fill="none" aria-hidden="true">
              <path d="M34 592C178 592 198 118 401 118c161 0 138 386 318 386 89 0 121-86 207-86" />
              <circle cx="34" cy="592" r="5" /><circle cx="401" cy="118" r="5" /><circle cx="719" cy="504" r="5" /><circle cx="926" cy="418" r="5" />
            </svg>
            <div className={styles.productBezel} data-stage={active.id}>
              <div className={styles.productWindow}>
                <div className={styles.productBar}>
                  <span className={styles.productBrand}><i><ProductGlyph name="live" /></i> Brivia</span>
                  <span className={styles.sessionStatus}><i /> Session active</span>
                  <span className={styles.productMeta}>Atelier / Session 01</span>
                </div>
                <div className={styles.panelStack}>
                  <div className={`${styles.productPanel} ${active.id === "compose" ? styles.panelActive : ""}`} aria-hidden={active.id !== "compose"}><ComposePanel /></div>
                  <div className={`${styles.productPanel} ${active.id === "join" ? styles.panelActive : ""}`} aria-hidden={active.id !== "join"}><JoinPanel /></div>
                  <div className={`${styles.productPanel} ${active.id === "respond" ? styles.panelActive : ""}`} aria-hidden={active.id !== "respond"}><RespondPanel /></div>
                  <div className={`${styles.productPanel} ${active.id === "understand" ? styles.panelActive : ""}`} aria-hidden={active.id !== "understand"}><UnderstandPanel /></div>
                </div>
              </div>
            </div>
            <div className={styles.stageCaption} key={active.id}>
              <span>{active.number} — {active.label}</span>
              <h3>{active.title}</h3>
              <p>{active.description}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
