"use client";

import Image from "next/image";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import type { QuestionTypePage } from "@/lib/questionTypePages";
import styles from "./QuestionTypeDemo.module.css";

export function QuestionTypeDemo({ questionType }: { questionType: QuestionTypePage }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [slider, setSlider] = useState(25);
  const [order, setOrder] = useState(questionType.options);
  const [matches, setMatches] = useState<Record<number, string>>({});
  const [placements, setPlacements] = useState<Record<number, string>>({});

  const hasAnswer = useMemo(() => {
    if (questionType.demoKind === "text" || questionType.demoKind === "fill") return text.trim().length > 0;
    if (questionType.demoKind === "matching") return Object.keys(matches).length === questionType.options.length;
    if (questionType.demoKind === "drag") return Object.keys(placements).length === questionType.options.length;
    if (questionType.demoKind === "ranking" || questionType.demoKind === "slider") return true;
    return selected !== null;
  }, [matches, placements, questionType.demoKind, questionType.options.length, selected, text]);

  const reset = () => {
    setSelected(null);
    setText("");
    setSlider(25);
    setOrder(questionType.options);
    setMatches({});
    setPlacements({});
  };

  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= order.length) return;
    const next = [...order];
    [next[index], next[destination]] = [next[destination], next[index]];
    setOrder(next);
  };

  const renderChoice = () => (
    <div className={styles.choiceGrid}>
      {questionType.options.map((option, index) => (
        <button
          key={option}
          className={selected === index ? styles.choiceSelected : styles.choice}
          type="button"
          aria-pressed={selected === index}
          onClick={() => setSelected(index)}
        >
          <span>{String.fromCharCode(65 + index)}</span>
          {option}
        </button>
      ))}
    </div>
  );

  const renderBody = () => {
    switch (questionType.demoKind) {
      case "text":
        return (
          <label className={styles.field}>
            <span>Votre réponse</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={questionType.slug === "open-text" ? 5 : 2}
              placeholder={questionType.slug === "open-text" ? "Décrivez votre proposition..." : "Saisissez votre réponse..."}
            />
          </label>
        );
      case "fill":
        return (
          <p className={styles.fillSentence}>
            Une information sensible doit rester{" "}
            <input
              aria-label="Terme manquant"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="terme manquant"
            />{" "}
            pendant son stockage et son transfert.
          </p>
        );
      case "ranking":
        return (
          <ol className={styles.rankingList}>
            {order.map((option, index) => (
              <li key={option}>
                <span className={styles.rankNumber}>{index + 1}</span>
                <strong>{option}</strong>
                <span className={styles.rankActions}>
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Monter ${option}`}>
                    <ChevronUp size={17} />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === order.length - 1} aria-label={`Descendre ${option}`}>
                    <ChevronDown size={17} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        );
      case "matching":
        return (
          <div className={styles.matchingList}>
            {questionType.options.map((pair, index) => {
              const [term, answer] = pair.split(" : ");
              return (
                <label key={pair}>
                  <span>{term}</span>
                  <select
                    value={matches[index] ?? ""}
                    onChange={(event) => setMatches((current) => ({ ...current, [index]: event.target.value }))}
                  >
                    <option value="">Choisir une responsabilité</option>
                    {questionType.options.map((candidate) => {
                      const candidateAnswer = candidate.split(" : ")[1];
                      return <option key={candidateAnswer} value={candidateAnswer}>{candidateAnswer}</option>;
                    })}
                  </select>
                  <small className={styles.demoHint}>Exemple attendu : {answer}</small>
                </label>
              );
            })}
          </div>
        );
      case "drag":
        return (
          <div className={styles.placementGrid}>
            {["Analyser le besoin", "Produire le support", "Faire relire"].map((item, index) => (
              <label key={item}>
                <span>{item}</span>
                <select
                  value={placements[index] ?? ""}
                  onChange={(event) => setPlacements((current) => ({ ...current, [index]: event.target.value }))}
                >
                  <option value="">Choisir une phase</option>
                  {questionType.options.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            ))}
          </div>
        );
      case "hotspot":
        return (
          <div className={styles.hotspot}>
            <Image
              src={questionType.image}
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, 48vw"
            />
            {[["18%", "25%"], ["55%", "45%"], ["76%", "70%"]].map(([left, top], index) => (
              <button
                key={`${left}-${top}`}
                type="button"
                style={{ left, top }}
                className={selected === index ? styles.hotspotSelected : undefined}
                aria-label={`Zone ${index + 1}`}
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              />
            ))}
          </div>
        );
      case "slider":
        return (
          <label className={styles.slider}>
            <span className={styles.sliderValue}>{slider} minutes</span>
            <input
              type="range"
              min="0"
              max="60"
              step="5"
              value={slider}
              onChange={(event) => setSlider(Number(event.target.value))}
            />
            <span className={styles.sliderBounds}><small>0 min</small><small>60 min</small></span>
          </label>
        );
      case "stars":
        return (
          <div className={styles.stars} role="group" aria-label="Note sur cinq">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
                aria-pressed={selected === value}
                onClick={() => setSelected(value)}
                className={selected !== null && value <= selected ? styles.starSelected : undefined}
              >
                ★
              </button>
            ))}
          </div>
        );
      case "nps":
        return (
          <div>
            <div className={styles.npsGrid}>
              {Array.from({ length: 11 }, (_, value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected === value}
                  className={selected === value ? styles.npsSelected : undefined}
                  onClick={() => setSelected(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className={styles.npsBounds}>
              <span>Pas du tout probable</span>
              <span>Tout à fait probable</span>
            </div>
          </div>
        );
      default:
        return renderChoice();
    }
  };

  return (
    <div className={styles.demo}>
      <div className={styles.demoHeader}>
        <div>
          <span>{questionType.mode}</span>
          <strong>{questionType.navTitle}</strong>
        </div>
        <button type="button" className={styles.reset} onClick={reset}>
          <RotateCcw size={16} aria-hidden="true" />
          Recommencer
        </button>
      </div>
      <div className={styles.demoQuestion}>
        <h2>{questionType.question}</h2>
        <p>{questionType.instruction}</p>
      </div>
      {renderBody()}
      <div className={styles.demoFooter} aria-live="polite">
        <span>{hasAnswer ? "Réponse prête à être envoyée" : "Choisissez une réponse pour continuer"}</span>
        <button type="button" disabled={!hasAnswer}>Valider</button>
      </div>
    </div>
  );
}
