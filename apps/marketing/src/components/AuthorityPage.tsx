import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import styles from "./AuthorityPage.module.css";

export type AuthorityChapter = {
  index: string;
  title: string;
  text: string;
  points: string[];
  note?: string;
};

type AuthorityPageProps = {
  eyebrow: string;
  title: string;
  accent: string;
  introduction: string;
  signal: string;
  signalDetail: string;
  facts: { value: string; label: string }[];
  chapters: AuthorityChapter[];
  closingTitle: string;
  closingText: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  tone?: "violet" | "emerald" | "blue" | "amber";
  layout?: "split" | "ledger" | "constellation" | "timeline" | "editorial" | "stage" | "canvas" | "studio";
};

const SignalGlyph = () => (
  <svg viewBox="0 0 48 48" role="img" aria-label="Signal Brivia">
    <path d="M8 31.5c8.5-11 23.5-11 32 0" />
    <path d="M14.5 36c5.3-6.5 13.7-6.5 19 0" />
    <circle cx="24" cy="40" r="2.2" />
    <path d="M24 7v11M18.5 12.5 24 18l5.5-5.5" />
  </svg>
);

type SharedProps = AuthorityPageProps & { primaryLabel: string; primaryHref: string; secondaryLabel: string; secondaryHref: string };

function Actions({ primaryLabel, primaryHref, secondaryLabel, secondaryHref }: Pick<SharedProps, "primaryLabel" | "primaryHref" | "secondaryLabel" | "secondaryHref">) {
  return <div className={styles.actions}>
    <Link className={styles.primary} href={primaryHref}><span>{primaryLabel}</span><i aria-hidden="true">↗</i></Link>
    <Link className={styles.secondary} href={secondaryHref}>{secondaryLabel}</Link>
  </div>;
}

function SignalCard({ signal, signalDetail }: Pick<SharedProps, "signal" | "signalDetail">) {
  return <div className={styles.signalCard}>
    <div className={styles.signalIcon}><SignalGlyph /></div>
    <p>Signal opérationnel</p>
    <strong>{signal}</strong>
    <span>{signalDetail}</span>
    <div className={styles.signalTrack}><i /></div>
  </div>;
}

function Points({ chapter, chapterIndex }: { chapter: AuthorityChapter; chapterIndex: number }) {
  return <div className={styles.chapterCore}>
    {chapter.points.map((point, pointIndex) => (
      <div className={styles.point} key={point}>
        <span aria-hidden="true">{String(chapterIndex + 1).padStart(2, "0")}.{pointIndex + 1}</span>
        <p>{point}</p>
      </div>
    ))}
    {chapter.note && <p className={styles.chapterNote}>{chapter.note}</p>}
  </div>;
}

function SplitLayout(props: SharedProps) {
  return <>
    <section className={styles.hero} aria-labelledby="authority-title">
      <div className={styles.orbit} aria-hidden="true" />
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{props.eyebrow}</p>
          <h1 id="authority-title">{props.title} <span>{props.accent}</span></h1>
          <p className={styles.introduction}>{props.introduction}</p>
          <Actions {...props} />
        </div>
        <div className={styles.signalShell}><SignalCard {...props} /></div>
      </div>
    </section>
    <FactRail facts={props.facts} />
    <section className={styles.chapters}><div className={styles.chapterInner}>
      {props.chapters.map((chapter, index) => <article className={styles.chapter} key={chapter.index}>
        <ChapterHeading chapter={chapter} />
        <div className={styles.chapterShell}><Points chapter={chapter} chapterIndex={index} /></div>
      </article>)}
    </div></section>
  </>;
}

function FactRail({ facts }: Pick<SharedProps, "facts">) {
  return <section className={styles.factRail} aria-label="Repères essentiels"><div className={styles.factInner}>
    {facts.map((fact) => <div className={styles.fact} key={`${fact.value}-${fact.label}`}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}
  </div></section>;
}

function ChapterHeading({ chapter }: { chapter: AuthorityChapter }) {
  return <div className={styles.chapterHeading}><span>{chapter.index}</span><h2>{chapter.title}</h2><p>{chapter.text}</p></div>;
}

function LedgerLayout(props: SharedProps) {
  return <>
    <section className={styles.ledgerHero} aria-labelledby="authority-title">
      <div className={styles.ledgerHeroInner}>
        <p className={styles.eyebrow}>{props.eyebrow}</p>
        <h1 id="authority-title">{props.title} <span>{props.accent}</span></h1>
        <div className={styles.ledgerIntro}><p>{props.introduction}</p><Actions {...props} /></div>
        <div className={styles.ledgerSignal}><span><SignalGlyph /></span><b>{props.signal}</b><p>{props.signalDetail}</p><i>Actif</i></div>
      </div>
    </section>
    <section className={styles.ledgerFacts} aria-label="Repères essentiels">
      {props.facts.map((fact, index) => <div key={fact.value}><span>0{index + 1}</span><strong>{fact.value}</strong><p>{fact.label}</p></div>)}
    </section>
    <section className={styles.ledgerBody}>
      {props.chapters.map((chapter, index) => <article className={styles.ledgerChapter} key={chapter.index}>
        <div className={styles.ledgerIndex}>{chapter.index}</div>
        <div><h2>{chapter.title}</h2><p>{chapter.text}</p></div>
        <ul>{chapter.points.map((point) => <li key={point}>{point}</li>)}</ul>
        {chapter.note && <aside>{chapter.note}</aside>}
        <span className={styles.ledgerStatus}>Contrôle {String(index + 1).padStart(2, "0")}</span>
      </article>)}
    </section>
  </>;
}

function ConstellationLayout(props: SharedProps) {
  return <>
    <section className={styles.constellationHero} aria-labelledby="authority-title">
      <div className={styles.constellationCopy}>
        <p className={styles.eyebrow}>{props.eyebrow}</p>
        <h1 id="authority-title">{props.title} <span>{props.accent}</span></h1>
        <p>{props.introduction}</p><Actions {...props} />
      </div>
      <div className={styles.constellationMap} aria-label="Écosystème disponible">
        <div className={styles.constellationCore}><SignalGlyph /><strong>{props.signal}</strong><span>{props.signalDetail}</span></div>
        {props.facts.map((fact, index) => <div className={`${styles.constellationNode} ${styles[`node${index + 1}`]}`} key={fact.value}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}
      </div>
    </section>
    <section className={styles.constellationGrid}>
      {props.chapters.map((chapter, index) => <article key={chapter.index} className={styles.constellationChapter}>
        <ChapterHeading chapter={chapter} /><Points chapter={chapter} chapterIndex={index} />
      </article>)}
    </section>
  </>;
}

function TimelineLayout(props: SharedProps) {
  return <>
    <section className={styles.timelineHero} aria-labelledby="authority-title">
      <div><p className={styles.eyebrow}>{props.eyebrow}</p><h1 id="authority-title">{props.title} <span>{props.accent}</span></h1></div>
      <div className={styles.timelineLead}><p>{props.introduction}</p><strong>{props.signal}</strong><span>{props.signalDetail}</span><Actions {...props} /></div>
    </section>
    <div className={styles.timelineFacts}>{props.facts.map((fact) => <p key={fact.value}><strong>{fact.value}</strong><span>{fact.label}</span></p>)}</div>
    <section className={styles.timelineBody}>
      <div className={styles.timelineRail} aria-hidden="true"><i /></div>
      {props.chapters.map((chapter, index) => <article className={styles.timelineChapter} key={chapter.index}>
        <span className={styles.timelineMarker}>{index + 1}</span>
        <ChapterHeading chapter={chapter} />
        <Points chapter={chapter} chapterIndex={index} />
      </article>)}
    </section>
  </>;
}

function EditorialLayout(props: SharedProps) {
  return <>
    <section className={styles.editorialHero} aria-labelledby="authority-title">
      <p className={styles.eyebrow}>{props.eyebrow}</p>
      <h1 id="authority-title">{props.title} <em>{props.accent}</em></h1>
      <div className={styles.editorialDeck}><p>{props.introduction}</p><div><strong>{props.signal}</strong><span>{props.signalDetail}</span></div></div>
      <Actions {...props} />
    </section>
    <section className={styles.editorialFacts}>{props.facts.map((fact) => <div key={fact.value}><strong>{fact.value}</strong><p>{fact.label}</p></div>)}</section>
    <section className={styles.editorialBody}>
      {props.chapters.map((chapter, index) => <article className={styles.editorialChapter} key={chapter.index}>
        <span>{chapter.index}</span><h2>{chapter.title}</h2><p>{chapter.text}</p>
        <ol>{chapter.points.map((point) => <li key={point}>{point}</li>)}</ol>
        {chapter.note && <aside>{chapter.note}</aside>}
        <b aria-hidden="true">0{index + 1}</b>
      </article>)}
    </section>
  </>;
}

function StageLayout(props: SharedProps) {
  return <>
    <section className={styles.stageHero} aria-labelledby="authority-title">
      <div className={styles.stageRings} aria-hidden="true" />
      <div className={styles.stageCopy}><p className={styles.eyebrow}>{props.eyebrow}</p><span className={styles.stageSignal}>{props.signal}</span><h1 id="authority-title">{props.title} <strong>{props.accent}</strong></h1><p>{props.introduction}</p><Actions {...props} /></div>
    </section>
    <section className={styles.stageFacts}>{props.facts.map((fact) => <div key={fact.value}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}</section>
    <section className={styles.stageBody}>
      {props.chapters.map((chapter, index) => <article className={styles.stageChapter} key={chapter.index}>
        <div><span>{chapter.index}</span><h2>{chapter.title}</h2><p>{chapter.text}</p></div>
        <div className={styles.stageSteps}>{chapter.points.map((point, pointIndex) => <p key={point}><i>{pointIndex + 1}</i>{point}</p>)}{chapter.note && <aside>{chapter.note}</aside>}</div>
        <b aria-hidden="true">{String(index + 1).padStart(2, "0")}</b>
      </article>)}
    </section>
  </>;
}

function CanvasLayout(props: SharedProps) {
  return <>
    <section className={styles.canvasHero} aria-labelledby="authority-title">
      <div className={styles.canvasCopy}><p className={styles.eyebrow}>{props.eyebrow}</p><h1 id="authority-title">{props.title} <span>{props.accent}</span></h1><p>{props.introduction}</p><Actions {...props} /></div>
      <div className={styles.canvasBoard}><div className={styles.canvasSignal}><SignalGlyph /><strong>{props.signal}</strong><p>{props.signalDetail}</p></div>{props.facts.map((fact, index) => <div className={`${styles.canvasFact} ${styles[`canvasFact${index + 1}`]}`} key={fact.value}><strong>{fact.value}</strong><span>{fact.label}</span></div>)}</div>
    </section>
    <section className={styles.canvasGrid}>{props.chapters.map((chapter, index) => <article key={chapter.index} className={styles.canvasChapter}><ChapterHeading chapter={chapter} /><Points chapter={chapter} chapterIndex={index} /></article>)}</section>
  </>;
}

function StudioLayout(props: SharedProps) {
  return <>
    <section className={styles.studioHero} aria-labelledby="authority-title">
      <div className={styles.studioTitle}><p className={styles.eyebrow}>{props.eyebrow}</p><h1 id="authority-title">{props.title} <span>{props.accent}</span></h1></div>
      <div className={styles.studioBrief}><p>{props.introduction}</p><div><SignalGlyph /><strong>{props.signal}</strong><span>{props.signalDetail}</span></div><Actions {...props} /></div>
    </section>
    <section className={styles.studioFacts}>{props.facts.map((fact, index) => <article key={fact.value}><span>0{index + 1}</span><strong>{fact.value}</strong><p>{fact.label}</p></article>)}</section>
    <section className={styles.studioProcess}>{props.chapters.map((chapter, index) => <article key={chapter.index}><ChapterHeading chapter={chapter} /><Points chapter={chapter} chapterIndex={index} /></article>)}</section>
  </>;
}

function Closing(props: SharedProps) {
  return <section className={styles.closing}><div className={styles.closingInner}>
    <p className={styles.eyebrow}>Prochaine étape</p><h2>{props.closingTitle}</h2><p>{props.closingText}</p><Actions {...props} />
  </div></section>;
}

export function AuthorityPage(rawProps: AuthorityPageProps) {
  const props: SharedProps = {
    primaryLabel: "Parler à l’équipe",
    primaryHref: "/contact?intent=demo",
    secondaryLabel: "Explorer le produit",
    secondaryHref: "/features",
    tone: "violet",
    layout: "split",
    ...rawProps,
  };
  const layouts = { split: SplitLayout, ledger: LedgerLayout, constellation: ConstellationLayout, timeline: TimelineLayout, editorial: EditorialLayout, stage: StageLayout, canvas: CanvasLayout, studio: StudioLayout };
  const Layout = layouts[props.layout ?? "split"];
  return <div className="marketing-shell"><Header /><main id="main-content" className={`${styles.page} ${styles[props.tone ?? "violet"]} ${styles[props.layout ?? "split"]}`}><Layout {...props} /><Closing {...props} /></main><Footer /></div>;
}
