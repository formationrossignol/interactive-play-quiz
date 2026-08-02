import type { QuestionTypePage } from "@/lib/questionTypePages";
import styles from "./QuestionHeroVisual.module.css";

const MARKS: Record<string, string> = {
  choice: "A",
  text: "Aa",
  ranking: "1—3",
  matching: "↔",
  fill: "___",
  drag: "↗",
  hotspot: "+",
  slider: "—●—",
  stars: "✦",
  nps: "09",
};

export function QuestionHeroVisual({ questionType }: { questionType: QuestionTypePage }) {
  const sampleOptions = questionType.options.slice(0, 4);
  return (
    <div className={`${styles.shell} ${styles[questionType.demoKind]}`} aria-label={`Aperçu du format ${questionType.navTitle}`}>
      <div className={styles.core}>
        <div className={styles.topline}>
          <span>{questionType.mode}</span>
          <i>Question 01</i>
        </div>
        <div className={styles.mark} aria-hidden="true">{MARKS[questionType.demoKind]}</div>
        <h2>{questionType.question}</h2>
        <div className={styles.options}>
          {sampleOptions.map((option, index) => (
            <span key={option}><i>{String.fromCharCode(65 + index)}</i>{option}</span>
          ))}
        </div>
        <div className={styles.footer}><span>BRIVIA / FORMAT</span><b>{questionType.navTitle}</b></div>
      </div>
    </div>
  );
}
