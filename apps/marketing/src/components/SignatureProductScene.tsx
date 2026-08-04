"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ProductGlyph, type ProductGlyphName } from "@/components/ProductGlyph";
import styles from "./SignatureProductScene.module.css";

type SceneStage = {
  id: string;
  number: string;
  label: string;
  title: string;
  description: string;
  glyph: ProductGlyphName;
};

type ComposeCopy = { draftSaved: string; question: string; answerPrecise: string; answerAlternative: string; answerDiscuss: string; answerOpen: string; time: string; points: string; ready: string };
type JoinCopy = { instantEntry: string; title: string; codeAriaLabel: string; connected: string; scanToJoin: string };
type RespondCopy = { question: string; reactionsAriaLabel: string; liveReactions: string };
type UnderstandCopy = { instantReading: string; title: string; chartAriaLabel: string; correctAnswer: string; majority: string; needsExplanation: string; review: string; noAnswer: string; low: string; usefulSignal: string; insight: string };

export type SignatureProductSceneContent = {
  eyebrow: string;
  titleStart: string;
  titleAccent: string;
  intro: string;
  introBadge: string;
  stepsAriaLabel: string;
  activeFlow: string;
  resume: string;
  pause: string;
  brandName: string;
  activeSessionLabel: string;
  workshopMeta: string;
  stages: ReadonlyArray<SceneStage>;
  compose: ComposeCopy;
  join: JoinCopy;
  respond: RespondCopy;
  understand: UnderstandCopy;
};

function ComposePanel({ copy }: { copy: ComposeCopy }) {
  return <div className={styles.composePanel}>
    <div className={styles.windowLabel}><span>Question / 01</span><strong>{copy.draftSaved}</strong></div>
    <h3>{copy.question}</h3>
    <div className={styles.composerAnswers}>
      <span><i />{copy.answerPrecise}</span>
      <span><i />{copy.answerAlternative}</span>
      <span><i />{copy.answerDiscuss}</span>
      <span><i />{copy.answerOpen}</span>
    </div>
    <div className={styles.composerFooter}><span>{copy.time}</span><span>{copy.points}</span><strong>{copy.ready}</strong></div>
  </div>;
}

function JoinPanel({ copy }: { copy: JoinCopy }) {
  return <div className={styles.joinPanel}>
    <div className={styles.joinCopy}>
      <span className={styles.windowEyebrow}>{copy.instantEntry}</span>
      <h3>{copy.title}</h3>
      <div className={styles.codeTiles} aria-label={copy.codeAriaLabel}>
        {"BRIVIA".split("").map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}
      </div>
      <div className={styles.participantLine}>
        <div aria-hidden="true"><i /><i /><i /><i /></div>
        <span>{copy.connected}</span>
      </div>
    </div>
    <div className={styles.qrObject}><ProductGlyph name="qr" /><span>{copy.scanToJoin}</span></div>
  </div>;
}

function RespondPanel({ copy }: { copy: RespondCopy }) {
  return <div className={styles.respondPanel}>
    <div className={styles.questionProgress}><span>Question 03 / 08</span><i><b /></i></div>
    <h3>{copy.question}</h3>
    <div className={styles.liveAnswers}>
      <span className={styles.answerCoral}><i>01</i>MFA</span>
      <span className={styles.answerBlue}><i>02</i>VPN</span>
      <span className={styles.answerGreen}><i>03</i>WAF</span>
      <span className={styles.answerAmber}><i>04</i>RBAC</span>
    </div>
    <div className={styles.reactionStream} aria-label={copy.reactionsAriaLabel}><span>✦</span><span>●</span><span>♥</span><small>{copy.liveReactions}</small></div>
  </div>;
}

function UnderstandPanel({ copy }: { copy: UnderstandCopy }) {
  return <div className={styles.understandPanel}>
    <div className={styles.resultLead}><span>{copy.instantReading}</span><h3>{copy.title}</h3></div>
    <div className={styles.resultChart} aria-label={copy.chartAriaLabel}>
      <div><span>{copy.correctAnswer}</span><i><b className={styles.barStrong} /></i><strong>{copy.majority}</strong></div>
      <div><span>{copy.needsExplanation}</span><i><b className={styles.barMedium} /></i><strong>{copy.review}</strong></div>
      <div><span>{copy.noAnswer}</span><i><b className={styles.barSoft} /></i><strong>{copy.low}</strong></div>
    </div>
    <div className={styles.resultInsight}><ProductGlyph name="analytics" /><span><small>{copy.usefulSignal}</small><strong>{copy.insight}</strong></span></div>
  </div>;
}

export function SignatureProductScene({ content }: { content: SignatureProductSceneContent }) {
  const { stages } = content;
  const [activeStage, setActiveStage] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const sceneRef = useRef<HTMLElement>(null);
  const active = stages[activeStage];

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
    const interval = window.setInterval(() => setActiveStage((current) => (current + 1) % stages.length), 5200);
    return () => window.clearInterval(interval);
  }, [isPaused, isVisible, manualPaused, stages.length]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let next = activeStage;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = stages.length - 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (activeStage + 1) % stages.length;
    else next = (activeStage - 1 + stages.length) % stages.length;
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
          <p>{content.eyebrow}</p>
          <h2 id="signature-title">{content.titleStart} <span>{content.titleAccent}</span></h2>
        </div>
        <div className={styles.introCopy}>
          <p>{content.intro}</p>
          <span><i aria-hidden="true" /> {content.introBadge}</span>
        </div>
      </div>

      <div className={styles.stageShell}>
        <div className={styles.stageCore}>
          <div className={styles.stepRail} role="tablist" aria-label={content.stepsAriaLabel} onKeyDown={onKeyDown}>
            <div className={styles.railHeader}>
              <span>{content.activeFlow}</span>
              <button type="button" className={styles.pauseControl} aria-pressed={manualPaused} onClick={() => setManualPaused((paused) => !paused)}>
                {manualPaused ? content.resume : content.pause}
              </button>
              <strong>{active.number} / 04</strong>
            </div>
            {stages.map((stage, index) => (
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
                  <span className={styles.productBrand}><i><ProductGlyph name="live" /></i> {content.brandName}</span>
                  <span className={styles.sessionStatus}><i /> {content.activeSessionLabel}</span>
                  <span className={styles.productMeta}>{content.workshopMeta}</span>
                </div>
                <div className={styles.panelStack}>
                  <div className={`${styles.productPanel} ${active.id === "compose" ? styles.panelActive : ""}`} aria-hidden={active.id !== "compose"}><ComposePanel copy={content.compose} /></div>
                  <div className={`${styles.productPanel} ${active.id === "join" ? styles.panelActive : ""}`} aria-hidden={active.id !== "join"}><JoinPanel copy={content.join} /></div>
                  <div className={`${styles.productPanel} ${active.id === "respond" ? styles.panelActive : ""}`} aria-hidden={active.id !== "respond"}><RespondPanel copy={content.respond} /></div>
                  <div className={`${styles.productPanel} ${active.id === "understand" ? styles.panelActive : ""}`} aria-hidden={active.id !== "understand"}><UnderstandPanel copy={content.understand} /></div>
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
