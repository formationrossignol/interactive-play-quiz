import { useEffect, useState } from "react";
import type { EditableQuestion } from "@/lib/questionTypes";
import { cn } from "@/lib/utils";
import { getPollOptions } from "@/lib/pollResults";
import { PLAYER_ANSWER_SHAPES as answerShapes } from "@/lib/answerVisuals";

/** The interactive "answer this question" input — every quiz/poll question
 *  type PlayerView supports live. Extracted out of PlayerView so it can also
 *  drive solo play (QuizSession's isSolo mode) without a second, drifting
 *  copy of nine question-type interactions. Type-specific working state
 *  (slider position, ranking order, matching pairs, blank values, open text)
 *  lives here and resets whenever `question` changes. */
export function QuestionAnswerPanel({
  question,
  isPoll = false,
  hasAnswered,
  selectedAnswer,
  onSubmit,
}: {
  question: EditableQuestion;
  isPoll?: boolean;
  hasAnswered: boolean;
  selectedAnswer: number | string | null;
  onSubmit: (answer: number | string) => void;
}) {
  const [openTextValue, setOpenTextValue] = useState("");
  const [rankingOrder, setRankingOrder] = useState<string[]>([]);
  const [blankValues, setBlankValues] = useState<string[]>([]);
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [matchingSelectedLeft, setMatchingSelectedLeft] = useState<string | null>(null);
  const [matchingPairs, setMatchingPairs] = useState<Record<string, string>>({});

  useEffect(() => {
    setOpenTextValue("");
    setMatchingSelectedLeft(null);
    setMatchingPairs({});
    if (question.type === "ranking") setRankingOrder([...(question.items ?? [])]);
    if (question.type === "fill-blank") setBlankValues((question.blanks ?? []).map(() => ""));
    if (question.type === "slider") setSliderValue(question.min ?? 0);
  }, [question]);

  return (
    <>
      {/* Multiple / Single Choice Answers */}
      {['multiple-choice', 'single-choice'].includes(question.type) && question.answers && (
        <div className="ap-answers">
          {question.answers.map((answer: string, index: number) => (
            <button
              key={index}
              className={cn(
                `ap-answer ap-answer--solid ap-answer--${(index % 4) + 1}`,
                selectedAnswer === index && "ap-answer--selected",
                hasAnswered && selectedAnswer !== index && "ap-answer--dim"
              )}
              onClick={() => onSubmit(index)}
              disabled={hasAnswered}
            >
              <span className="ap-answer__shape">{answerShapes[index % 4]}</span>
              <span className="ap-answer__text">{answer}</span>
            </button>
          ))}
        </div>
      )}

      {/* True / False */}
      {question.type === 'true-false' && (
        <div className="ap-answers">
          {[{ label: question.answers?.[0] ?? 'Vrai', value: 'true' }, { label: question.answers?.[1] ?? 'Faux', value: 'false' }].map(({ label, value }, index) => (
            <button
              key={value}
              className={cn(
                `ap-answer ap-answer--solid ap-answer--${index + 1}`,
                selectedAnswer === value && "ap-answer--selected",
                hasAnswered && selectedAnswer !== value && "ap-answer--dim"
              )}
              onClick={() => onSubmit(value)}
              disabled={hasAnswered}
            >
              <span className="ap-answer__shape">{index === 0 ? 'V' : 'F'}</span>
              <span className="ap-answer__text">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Short Answer */}
      {question.type === 'short-answer' && !hasAnswered && (
        <form
          className="flex flex-col gap-3 px-2"
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.currentTarget.elements.namedItem('answer') as HTMLInputElement);
            if (input.value.trim()) onSubmit(input.value.trim());
          }}
        >
          <input
            name="answer"
            type="text"
            placeholder="Votre réponse…"
            className="w-full rounded-xl border-2 border-white/30 bg-white/15 p-4 text-white placeholder-white/50 text-lg outline-none focus:border-white/60"
            disabled={hasAnswered}
            autoComplete="off"
          />
          <button
            type="submit"
            className="ap-btn ap-btn--lg ap-btn--pill"
            style={{ background: "var(--ap-ink)" }}
          >
            Valider
          </button>
        </form>
      )}

      {/* Slider */}
      {question.type === 'slider' && !hasAnswered && (
        <div className="flex flex-col gap-4 px-2">
          <div className="text-center text-white text-3xl font-bold">{sliderValue}</div>
          <input
            type="range"
            min={question.min ?? 0}
            max={question.max ?? 100}
            step={question.step ?? 1}
            value={sliderValue}
            onChange={(e) => setSliderValue(Number(e.target.value))}
            className="w-full accent-white"
          />
          <div className="flex justify-between text-white/60 text-sm">
            <span>{question.minLabel ?? question.min ?? 0}</span>
            <span>{question.maxLabel ?? question.max ?? 100}</span>
          </div>
          <button className="ap-btn ap-btn--lg ap-btn--pill" style={{ background: "var(--ap-ink)" }} onClick={() => onSubmit(sliderValue)}>
            Valider
          </button>
        </div>
      )}

      {/* Fill in the blank */}
      {question.type === 'fill-blank' && !hasAnswered && (
        <form className="flex flex-col gap-3 px-2" onSubmit={(e) => {
          e.preventDefault();
          if (blankValues.some(v => !v.trim())) return;
          onSubmit(JSON.stringify(blankValues.map(v => v.trim())));
        }}>
          <p className="text-white/80 text-sm text-center" style={{ fontFamily: 'var(--ap-font-body)' }}>
            {(question.text ?? '').split('{{blank}}').map((segment: string, i: number, arr: string[]) => (
              <span key={i}>
                {segment}
                {i < arr.length - 1 && (
                  <input
                    className="inline-block mx-1 rounded-lg border-b-2 border-white bg-white/15 text-white px-2 py-1 text-sm w-24 outline-none focus:border-white/80"
                    value={blankValues[i] ?? ''}
                    onChange={(e) => setBlankValues(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                    autoComplete="off"
                  />
                )}
              </span>
            ))}
          </p>
          <button type="submit" className="ap-btn ap-btn--lg ap-btn--pill" style={{ background: "var(--ap-ink)" }}>
            Valider
          </button>
        </form>
      )}

      {/* Ranking */}
      {question.type === 'ranking' && !hasAnswered && (
        <div className="flex flex-col gap-2 px-2">
          {rankingOrder.map((item, idx) => (
            <div key={item} className="flex items-center gap-3 rounded-xl px-4 py-3 text-white font-bold" style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.2)' }}>
              <span className="text-white/50 w-5 text-center text-sm">{idx + 1}</span>
              <span className="flex-1 text-sm">{item}</span>
              <div className="flex flex-col gap-1">
                <button
                  className="text-white/70 hover:text-white disabled:opacity-30 text-xs leading-none"
                  disabled={idx === 0}
                  onClick={() => setRankingOrder(prev => { const next = [...prev]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; return next; })}
                >▲</button>
                <button
                  className="text-white/70 hover:text-white disabled:opacity-30 text-xs leading-none"
                  disabled={idx === rankingOrder.length - 1}
                  onClick={() => setRankingOrder(prev => { const next = [...prev]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; return next; })}
                >▼</button>
              </div>
            </div>
          ))}
          <button
            className="ap-btn ap-btn--lg ap-btn--pill mt-2"
            style={{ background: "var(--ap-ink)" }}
            onClick={() => {
              const originalItems: string[] = question.items ?? [];
              const order = rankingOrder.map(item => originalItems.indexOf(item));
              onSubmit(JSON.stringify(order));
            }}
          >
            Valider l'ordre
          </button>
        </div>
      )}

      {/* Matching */}
      {question.type === 'matching' && !hasAnswered && (() => {
        const left: { id?: string; text?: string }[] = question.leftColumn ?? [];
        const right: { id?: string; text?: string }[] = question.rightColumn ?? [];
        const paired = Object.keys(matchingPairs);
        const allPaired = left.length > 0 && paired.length === left.length;
        return (
          <div className="flex flex-col gap-3 px-2">
            <p className="text-white/60 text-xs text-center" style={{ fontFamily: 'var(--ap-font-body)' }}>
              {matchingSelectedLeft ? 'Choisissez la correspondance →' : 'Sélectionnez un élément de gauche'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-2">
                {left.map(l => (
                  <button
                    key={l.id}
                    className={cn(
                      'rounded-xl px-3 py-2 text-sm font-bold text-white text-left border-2 transition-all',
                      matchingSelectedLeft === l.id ? 'border-white bg-white/30' : matchingPairs[l.id] ? 'border-green-400/60 bg-green-500/20' : 'border-white/20 bg-white/10'
                    )}
                    onClick={() => setMatchingSelectedLeft(prev => prev === l.id ? null : l.id)}
                    disabled={!!matchingPairs[l.id]}
                  >
                    {l.text}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {right.map(r => {
                  const isPaired = Object.values(matchingPairs).includes(r.id);
                  return (
                    <button
                      key={r.id}
                      className={cn(
                        'rounded-xl px-3 py-2 text-sm font-bold text-white text-left border-2 transition-all',
                        isPaired ? 'border-green-400/60 bg-green-500/20' : matchingSelectedLeft ? 'border-white/50 bg-white/15 hover:bg-white/25' : 'border-white/20 bg-white/10 opacity-50'
                      )}
                      disabled={isPaired || !matchingSelectedLeft}
                      onClick={() => {
                        if (!matchingSelectedLeft) return;
                        setMatchingPairs(prev => ({ ...prev, [matchingSelectedLeft]: r.id }));
                        setMatchingSelectedLeft(null);
                      }}
                    >
                      {r.text}
                    </button>
                  );
                })}
              </div>
            </div>
            {allPaired && (
              <button
                className="ap-btn ap-btn--lg ap-btn--pill mt-2"
                style={{ background: "var(--ap-ink)" }}
                onClick={() => onSubmit(JSON.stringify(matchingPairs))}
              >
                Valider les associations
              </button>
            )}
          </div>
        );
      })()}

      {/* Poll scales: Likert / frequency / star rating / NPS */}
      {['likert-scale', 'frequency-scale', 'star-rating', 'nps-scale'].includes(question.type) && !hasAnswered && (() => {
        const options = getPollOptions(question);
        if (options.length === 0) return null;
        if (question.type === 'nps-scale') {
          return (
            <div className="flex flex-col gap-3 px-2">
              <div className="flex justify-between text-white/60 text-xs font-bold">
                <span>{question.minLabel ?? 'Pas du tout probable'}</span>
                <span>{question.maxLabel ?? 'Très probable'}</span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {options.map((option, index) => (
                  <button
                    key={index}
                    className="rounded-xl border-2 border-white/25 bg-white/12 py-3 text-white font-bold text-base transition-all hover:bg-white/25"
                    style={{ background: 'rgba(255,255,255,0.12)' }}
                    onClick={() => onSubmit(index)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        if (question.type === 'star-rating') {
          return (
            <div className="flex justify-center gap-2 px-2 flex-wrap">
              {options.map((_, index) => (
                <button
                  key={index}
                  aria-label={`${index + 1} étoile${index > 0 ? 's' : ''}`}
                  className="text-4xl transition-transform hover:scale-125"
                  style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}
                  onClick={() => onSubmit(index)}
                >
                  ⭐
                </button>
              ))}
            </div>
          );
        }
        // Likert / frequency: vertical option list
        return (
          <div className="flex flex-col gap-2 px-2">
            {options.map((option, index) => (
              <button
                key={index}
                className="rounded-xl border-2 border-white/25 px-4 py-3 text-white font-bold text-sm text-left transition-all hover:bg-white/25"
                style={{ background: 'rgba(255,255,255,0.12)' }}
                onClick={() => onSubmit(index)}
              >
                {option}
              </button>
            ))}
          </div>
        );
      })()}

      {/* Poll open text */}
      {question.type === 'open-text' && !hasAnswered && (
        <form
          className="flex flex-col gap-3 px-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (openTextValue.trim()) {
              onSubmit(openTextValue.trim());
              setOpenTextValue('');
            }
          }}
        >
          <textarea
            value={openTextValue}
            onChange={(e) => setOpenTextValue(e.target.value.slice(0, question.maxLength ?? 500))}
            placeholder="Votre réponse…"
            rows={4}
            className="w-full rounded-xl border-2 border-white/30 bg-white/15 p-4 text-white placeholder-white/50 text-base outline-none focus:border-white/60 resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-xs font-bold">
              {openTextValue.length}/{question.maxLength ?? 500}
            </span>
            <button
              type="submit"
              className="ap-btn ap-btn--pill"
              style={{ background: "var(--ap-ink)", opacity: openTextValue.trim() ? 1 : 0.5 }}
              disabled={!openTextValue.trim()}
            >
              Envoyer
            </button>
          </div>
        </form>
      )}
    </>
  );
}
