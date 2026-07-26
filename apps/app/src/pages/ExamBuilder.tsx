import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createExam, updateExam, getExamById, getHostExams, type Exam } from '@/lib/examStorage';
import { getUserQuizzes } from '@/lib/quizStorage';
import { getCurrentUser } from '@/lib/auth';
import { CONTENT_CAPS, getPlan } from '@/lib/plans';
import { PlanLimitBlocker } from '@/components/PlanLimitBlocker';
import { Breadcrumb } from '@/components/Breadcrumb';
import { MultiStepProgress } from '@/components/MultiStepProgress';
import { upsertContentBySource } from '@/lib/content/contentRepo';
import { toast } from 'sonner';
import { useSaveShortcut } from '@/hooks/useSaveShortcut';
import { showError } from '@/lib/errorTaxonomy';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Eye,
  Link2,
  Rocket,
  Save,
  Shuffle,
  Timer,
  Trophy,
} from 'lucide-react';

const now = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const inHours = (n: number) => {
  const d = new Date(Date.now() + n * 3600000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

interface FormState {
  title: string;
  description: string;
  quizId: string;
  openAt: string;
  closeAt: string;
  hasDuration: boolean;
  durationMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  passingScore: number;
  showResultsPolicy: Exam['showResultsPolicy'];
  showDetailPolicy: Exam['showDetailPolicy'];
  scoreRetentionPolicy: Exam['scoreRetentionPolicy'];
  status: Exam['status'];
}

const STEP_META = [
  { label: 'Informations', description: 'Titre et quiz source', icon: ClipboardList },
  { label: 'Planification', description: 'Période et durée', icon: CalendarDays },
  { label: 'Comportement', description: 'Ordre et notation', icon: Shuffle },
  { label: 'Résultats', description: 'Visibilité des scores', icon: Eye },
] as const;
const STEPS = STEP_META.map(({ label }) => label);

const DEFAULTS: FormState = {
  title: '',
  description: '',
  quizId: '',
  openAt: now(),
  closeAt: inHours(72),
  hasDuration: false,
  durationMinutes: 60,
  maxAttempts: 1,
  shuffleQuestions: false,
  shuffleAnswers: false,
  passingScore: 70,
  showResultsPolicy: 'immediately',
  showDetailPolicy: 'score-correction',
  scoreRetentionPolicy: 'best',
  status: 'draft',
};

export default function ExamBuilder() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const examId = params.get('examId');
  const presetQuizId = params.get('quizId');

  const [form, setForm] = useState<FormState>({ ...DEFAULTS, quizId: presetQuizId ?? '' });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Exam | null>(null);
  const [used, setUsed] = useState(0);
  const user = getCurrentUser();

  const quizzes = user ? getUserQuizzes(user.id).filter((q) => q.type === 'quiz') : [];

  const cap = CONTENT_CAPS[getPlan(user)].exam;
  const atCap = !examId && cap !== null && used >= cap;
  const isEditing = !!examId;

  useEffect(() => {
    if (user) getHostExams(user.id).then((exams) => setUsed(exams.length));
  }, [user?.id]);

  useEffect(() => {
    if (!examId) return;
    getExamById(examId).then((exam) => {
      if (!exam) return;
      const openLocal = new Date(exam.openAt);
      openLocal.setMinutes(openLocal.getMinutes() - openLocal.getTimezoneOffset());
      const closeLocal = new Date(exam.closeAt);
      closeLocal.setMinutes(closeLocal.getMinutes() - closeLocal.getTimezoneOffset());
      setForm({
        title: exam.title,
        description: exam.description,
        quizId: exam.quizId,
        openAt: openLocal.toISOString().slice(0, 16),
        closeAt: closeLocal.toISOString().slice(0, 16),
        hasDuration: exam.durationMinutes !== null,
        durationMinutes: exam.durationMinutes ?? 60,
        maxAttempts: exam.maxAttempts,
        shuffleQuestions: exam.shuffleQuestions,
        shuffleAnswers: exam.shuffleAnswers,
        passingScore: exam.passingScore,
        showResultsPolicy: exam.showResultsPolicy,
        showDetailPolicy: exam.showDetailPolicy,
        scoreRetentionPolicy: exam.scoreRetentionPolicy,
        status: exam.status,
      });
      setSaved(exam);
    });
  }, [examId]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  // Only the first step (title/quiz source) has fields the rest of the form
  // depends on — later steps have no invalid state, just choices.
  const stepError = (s: number): string | null => {
    if (s === 0) {
      if (!form.title.trim()) return 'Titre requis';
      if (!form.quizId) return 'Choisir un quiz source';
    }
    if (s === 1 && new Date(form.closeAt) <= new Date(form.openAt)) {
      return "La date de fermeture doit être après l'ouverture";
    }
    return null;
  };

  const goNext = () => {
    const err = stepError(step);
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));
  const goToStep = (target: number) => {
    if (!isEditing && target > step) {
      const err = stepError(step);
      if (err) { toast.error(err); return; }
    }
    setStep(target);
  };

  const handleSave = async (publish: boolean) => {
    if (!form.title.trim()) { toast.error('Titre requis'); return; }
    if (!form.quizId) { toast.error('Choisir un quiz source'); return; }
    if (new Date(form.closeAt) <= new Date(form.openAt)) {
      toast.error('La date de fermeture doit être après l\'ouverture');
      return;
    }
    setSaving(true);
    try {
      const payload: Omit<Exam, 'id' | 'hostId' | 'joinCode' | 'createdAt' | 'updatedAt' | 'maxParticipants'> = {
        title: form.title.trim(),
        description: form.description.trim(),
        quizId: form.quizId,
        openAt: new Date(form.openAt).toISOString(),
        closeAt: new Date(form.closeAt).toISOString(),
        durationMinutes: form.hasDuration ? form.durationMinutes : null,
        maxAttempts: form.maxAttempts,
        shuffleQuestions: form.shuffleQuestions,
        shuffleAnswers: form.shuffleAnswers,
        passingScore: form.passingScore,
        showResultsPolicy: form.showResultsPolicy,
        showDetailPolicy: form.showDetailPolicy,
        scoreRetentionPolicy: form.scoreRetentionPolicy,
        status: publish ? 'scheduled' : (saved?.status ?? 'draft'),
      };

      let exam: Exam | null;
      if (saved) {
        exam = await updateExam(saved.id, payload);
      } else {
        exam = await createExam(payload);
      }

      if (!exam) throw new Error('Échec de sauvegarde');
      setSaved(exam);
      // Mirror into the Supabase `content` table so it shows up in "Mes examens"
      // (which reads from there, not from the legacy `lms_exams` localStorage store).
      try {
        await upsertContentBySource(user.id, 'exam', exam.id, exam as unknown as Record<string, unknown>, false);
      } catch (e) { console.error('[ExamBuilder] content mirror failed', e); }
      // Also mirror the backing quiz: ExamRoom's participant-side read
      // (getContentBySource) depends on this row existing, and a quiz saved
      // before the content-mirroring code shipped (or never re-saved since)
      // would otherwise have no Supabase row, breaking the join flow.
      const quiz = quizzes.find((q) => q.id === form.quizId);
      if (quiz) {
        try {
          await upsertContentBySource(user.id, 'quiz', quiz.id, quiz as unknown as Record<string, unknown>, !!quiz.isPublic);
        } catch (e) { console.error('[ExamBuilder] quiz mirror failed', e); }
      }
      toast.success(publish ? 'Examen publié !' : saved ? 'Examen mis à jour' : 'Brouillon sauvegardé');
      if (publish) setTimeout(() => navigate(`/exam/${exam!.id}/admin`), 600);
    } catch (e) {
      showError(e, 'ExamBuilder.save', 'Impossible d’enregistrer cet examen. Réessayez dans un instant.');
    } finally {
      setSaving(false);
    }
  };
  useSaveShortcut(() => handleSave(false), !saving);

  if (!user) return null;

  if (atCap) {
    return (
      <PlanLimitBlocker
        title="Limite du plan Starter atteinte"
        description={`Le plan Starter est limité à ${cap} examens. Passez au plan Pro pour en créer davantage.`}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`
        .eb-input {
          width: 100%; padding: 10px 14px;
          font-family: var(--ap-font-body); font-weight: 700; font-size: 14px;
          color: var(--ap-ink); background: var(--ap-paper-2);
          border: var(--ap-border-w) solid var(--ap-line); border-radius: var(--ap-r-sm);
          outline: none; box-sizing: border-box; transition: border-color .15s;
        }
        .eb-input:focus { border-color: var(--ap-brand); }
        .eb-label { display: block; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ap-muted); margin-bottom: 6px; }
        .eb-shell { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 20px; align-items: start; }
        .eb-step-nav { position: sticky; top: 84px; background: var(--ap-card); border: var(--ap-border-w) solid var(--ap-line); border-radius: var(--ap-r-lg); padding: 8px; }
        .eb-step-btn { width: 100%; display: flex; align-items: center; gap: 10px; padding: 11px 10px; border: none; border-radius: var(--ap-r-sm); background: transparent; color: var(--ap-ink); font-family: var(--ap-font-body); text-align: left; cursor: pointer; }
        .eb-step-btn:hover { background: var(--ap-paper-2); }
        .eb-step-btn.on { background: var(--ap-brand-soft); color: var(--ap-brand-deep); }
        .eb-section { background: var(--ap-card); border: var(--ap-border-w) solid var(--ap-line); border-radius: var(--ap-r-lg); padding: 22px; margin-bottom: 14px; }
        .eb-section-title { font-family: var(--ap-font-display); font-weight: 600; font-size: 16px; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
        .eb-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .eb-toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .eb-check { width: 20px; height: 20px; border: var(--ap-border-w) solid var(--ap-line); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background .15s, border-color .15s; }
        .eb-check.on { background: var(--ap-brand); border-color: var(--ap-brand); }
        .eb-radio-group { display: flex; flex-direction: column; gap: 8px; }
        .eb-radio { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: var(--ap-border-w) solid var(--ap-line); border-radius: var(--ap-r-sm); cursor: pointer; transition: border-color .15s, background .15s; }
        .eb-radio.on { border-color: var(--ap-brand); background: var(--ap-brand-soft); }
        .eb-radio-dot { width: 16px; height: 16px; border-radius: 50%; border: var(--ap-border-w) solid var(--ap-line); flex-shrink: 0; margin-top: 2px; transition: background .15s, border-color .15s; }
        .eb-radio.on .eb-radio-dot { background: var(--ap-brand); border-color: var(--ap-brand); }
        .eb-range { width: 100%; accent-color: var(--ap-brand); }
        .eb-actions { position: sticky; bottom: 12px; z-index: 5; display: flex; gap: 12px; padding: 12px; margin: 0 -12px; border-radius: var(--ap-r-lg); background: color-mix(in srgb, var(--ap-paper) 92%, transparent); backdrop-filter: blur(8px); }
        @media (max-width: 760px) {
          .eb-shell { grid-template-columns: 1fr; }
          .eb-step-nav { position: static; display: grid; grid-template-columns: repeat(2, 1fr); }
          .eb-row { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Topbar */}
      <div style={{
        background: 'var(--ap-card)', borderBottom: 'var(--ap-border-w) solid var(--ap-line)',
        padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 16,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Breadcrumb
          onHome={() => { window.location.href = '/'; }}
          items={[
            { label: 'Mes examens', onClick: () => navigate('/my-exams') },
            { label: saved ? "Modifier l'examen" : 'Nouvel examen' },
          ]}
        />
        <div style={{ flex: 1 }} />
        {saved && (
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '.06em', padding: '4px 10px', borderRadius: 999,
            background: saved.status === 'draft' ? 'var(--ap-paper-2)' : 'var(--ap-pres-soft)',
            color: saved.status === 'draft' ? 'var(--ap-muted)' : 'var(--ap-pres-deep)',
          }}>
            {saved.status === 'draft' ? 'Brouillon' : `CODE: ${saved.joinCode}`}
          </span>
        )}
      </div>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 16px' }}>

        {/* Join code banner */}
        {saved && saved.status !== 'draft' && (
          <div style={{
            background: 'var(--ap-pres-soft)', border: '2px solid var(--ap-pres)',
            borderRadius: 'var(--ap-r-lg)', padding: '16px 24px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <Link2 style={{ width: 28, height: 28, color: 'var(--ap-pres-deep)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ap-pres-deep)', marginBottom: 2 }}>
                Code d'accès participants
              </div>
              <div style={{ fontFamily: 'var(--ap-font-mono)', fontWeight: 800, fontSize: 28, color: 'var(--ap-pres-deep)', letterSpacing: '.1em' }}>
                {saved.joinCode}
              </div>
            </div>
            <button
              onClick={() => { navigate(`/exam/${saved.id}/admin`); }}
              style={{
                marginLeft: 'auto', padding: '8px 16px', borderRadius: 999,
                background: 'var(--ap-pres)', color: '#fff', border: 'none',
                fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 13, cursor: 'pointer',
              }}
            >
              Voir résultats <ArrowRight style={{ width: 14, height: 14, display: 'inline', verticalAlign: -2 }} />
            </button>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ap-muted)' }}>
              Rubrique {step + 1}/{STEPS.length} — {STEPS[step]}
            </span>
          </div>
          <MultiStepProgress totalSteps={STEPS.length} currentStep={step} />
        </div>

        <div className="eb-shell">
          <nav className="eb-step-nav" aria-label="Rubriques de l'examen">
            {STEP_META.map(({ label, description, icon: Icon }, index) => (
              <button
                type="button"
                key={label}
                className={`eb-step-btn ${step === index ? 'on' : ''}`}
                aria-current={step === index ? 'step' : undefined}
                onClick={() => goToStep(index)}
              >
                <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>{label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--ap-muted)', marginTop: 1 }}>{description}</span>
                </span>
              </button>
            ))}
          </nav>

          <main style={{ minWidth: 0 }}>

        {step === 0 && (
        <div className="eb-section">
          <div className="eb-section-title"><ClipboardList style={{ width: 18, height: 18 }} /> Informations générales</div>
          <div style={{ marginBottom: 16 }}>
            <label className="eb-label">Titre de l'examen</label>
            <input className="eb-input" placeholder="Ex : Examen final, Module 3" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="eb-label">Description (optionnel)</label>
            <textarea
              className="eb-input"
              rows={3}
              placeholder="Instructions pour les participants…"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div>
            <label className="eb-label">Quiz source</label>
            <select
              className="eb-input"
              value={form.quizId}
              onChange={(e) => set('quizId', e.target.value)}
            >
              <option value="">Choisir un quiz</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>{q.title} ({q.questions.length} questions)</option>
              ))}
            </select>
          </div>
        </div>
        )}

        {step === 1 && (
        <>
        {/* Dates */}
        <div className="eb-section">
          <div className="eb-section-title"><CalendarDays style={{ width: 18, height: 18 }} /> Période d'accès</div>
          <div className="eb-row">
            <div>
              <label className="eb-label">Ouverture</label>
              <input type="datetime-local" className="eb-input" value={form.openAt} onChange={(e) => set('openAt', e.target.value)} />
            </div>
            <div>
              <label className="eb-label">Fermeture</label>
              <input type="datetime-local" className="eb-input" value={form.closeAt} onChange={(e) => set('closeAt', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Timing & attempts */}
        <div className="eb-section">
          <div className="eb-section-title"><Timer style={{ width: 18, height: 18 }} /> Durée & tentatives</div>
          <div style={{ marginBottom: 20 }}>
            <label
              className="eb-toggle"
              style={{ marginBottom: 12 }}
              onClick={() => set('hasDuration', !form.hasDuration)}
            >
              <div className={`eb-check ${form.hasDuration ? 'on' : ''}`}>
                {form.hasDuration && <Check style={{ width: 12, height: 12, color: '#fff', strokeWidth: 3 }} />}
              </div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Limiter la durée</span>
            </label>
            {form.hasDuration && (
              <div>
                <label className="eb-label">Durée maximale : <strong>{form.durationMinutes} min</strong></label>
                <input
                  type="range" className="eb-range"
                  min={5} max={240} step={5}
                  value={form.durationMinutes}
                  onChange={(e) => set('durationMinutes', Number(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--ap-muted)', marginTop: 4 }}>
                  <span>5 min</span><span>4 h</span>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="eb-label">Nombre de tentatives max : <strong>{form.maxAttempts === 99 ? 'Illimité' : form.maxAttempts}</strong></label>
            <input
              type="range" className="eb-range"
              min={1} max={10} step={1}
              value={Math.min(form.maxAttempts, 10)}
              onChange={(e) => set('maxAttempts', Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--ap-muted)', marginTop: 4 }}>
              <span>1</span><span>10</span>
            </div>
          </div>
        </div>
        </>
        )}

        {step === 2 && (
        <>
        {/* Options */}
        <div className="eb-section">
          <div className="eb-section-title"><Shuffle style={{ width: 18, height: 18 }} /> Options d'affichage</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label className="eb-toggle" onClick={() => set('shuffleQuestions', !form.shuffleQuestions)}>
              <div className={`eb-check ${form.shuffleQuestions ? 'on' : ''}`}>
                {form.shuffleQuestions && <Check style={{ width: 12, height: 12, color: '#fff', strokeWidth: 3 }} />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Mélanger les questions</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)' }}>Ordre différent pour chaque participant</div>
              </div>
            </label>
            <label className="eb-toggle" onClick={() => set('shuffleAnswers', !form.shuffleAnswers)}>
              <div className={`eb-check ${form.shuffleAnswers ? 'on' : ''}`}>
                {form.shuffleAnswers && <Check style={{ width: 12, height: 12, color: '#fff', strokeWidth: 3 }} />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Mélanger les réponses</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)' }}>Ordre des options aléatoire</div>
              </div>
            </label>
          </div>
        </div>

        {/* Score */}
        <div className="eb-section">
          <div className="eb-section-title"><Trophy style={{ width: 18, height: 18 }} /> Score & réussite</div>
          <div style={{ marginBottom: 20 }}>
            <label className="eb-label">Score minimal de réussite : <strong style={{ color: 'var(--ap-brand)' }}>{form.passingScore}%</strong></label>
            <input
              type="range" className="eb-range"
              min={0} max={100} step={5}
              value={form.passingScore}
              onChange={(e) => set('passingScore', Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--ap-muted)', marginTop: 4 }}>
              <span>0%</span><span>100%</span>
            </div>
          </div>
          <div>
            <label className="eb-label">Si plusieurs tentatives, retenir</label>
            <div className="eb-radio-group">
              {([
                ['best', 'Meilleur score', 'Le score le plus élevé'],
                ['last', 'Dernier score', 'Le score de la dernière tentative'],
                ['average', 'Moyenne', 'La moyenne de toutes les tentatives'],
              ] as const).map(([val, label, desc]) => (
                <div key={val} className={`eb-radio ${form.scoreRetentionPolicy === val ? 'on' : ''}`} onClick={() => set('scoreRetentionPolicy', val)}>
                  <div className="eb-radio-dot" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
        )}

        {step === 3 && (
        <>
        {/* Results policy */}
        <div className="eb-section">
          <div className="eb-section-title"><Eye style={{ width: 18, height: 18 }} /> Affichage des résultats</div>
          <div style={{ marginBottom: 20 }}>
            <label className="eb-label">Quand montrer les résultats</label>
            <div className="eb-radio-group">
              {([
                ['immediately', 'Immédiatement', 'Dès la soumission de la tentative'],
                ['after-close', 'Après fermeture', 'Une fois la période d\'examen terminée'],
                ['never', 'Jamais', 'Les participants ne voient aucun résultat'],
              ] as const).map(([val, label, desc]) => (
                <div key={val} className={`eb-radio ${form.showResultsPolicy === val ? 'on' : ''}`} onClick={() => set('showResultsPolicy', val)}>
                  <div className="eb-radio-dot" />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {form.showResultsPolicy !== 'never' && (
            <div>
              <label className="eb-label">Niveau de détail</label>
              <div className="eb-radio-group">
                {([
                  ['score-only', 'Score uniquement', 'Le participant voit son pourcentage et réussite/échec'],
                  ['score-answers', 'Score + réponses', 'Score + ses propres réponses sans correction'],
                  ['score-correction', 'Correction complète', 'Score + toutes les réponses avec les bonnes réponses'],
                ] as const).map(([val, label, desc]) => (
                  <div key={val} className={`eb-radio ${form.showDetailPolicy === val ? 'on' : ''}`} onClick={() => set('showDetailPolicy', val)}>
                    <div className="eb-radio-dot" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ap-muted)' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </>
        )}

        {/* Actions */}
        <div className="eb-actions">
          {!isEditing && step > 0 && (
            <button
              onClick={goPrev}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 999,
                border: 'var(--ap-border-w) solid var(--ap-line)', background: 'var(--ap-card)',
                fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 15,
                color: 'var(--ap-ink)', cursor: 'pointer',
              }}
            >
              <ArrowLeft style={{ width: 16, height: 16, display: 'inline', verticalAlign: -3, marginRight: 6 }} />
              Précédent
            </button>
          )}
          {!isEditing && step < STEPS.length - 1 ? (
            <button
              onClick={goNext}
              style={{
                flex: 2, padding: '14px 0', borderRadius: 999, border: 'none',
                background: 'var(--ap-brand)', color: '#fff',
                fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 15,
                cursor: 'pointer', boxShadow: '0 4px 0 var(--ap-brand-deep)',
              }}
            >
              Suivant
              <ArrowRight style={{ width: 16, height: 16, display: 'inline', verticalAlign: -3, marginLeft: 6 }} />
            </button>
          ) : (
            <>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 999,
                  border: 'var(--ap-border-w) solid var(--ap-line)', background: 'var(--ap-card)',
                  fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 15,
                  color: 'var(--ap-ink)', cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? .6 : 1,
                }}
              >
                {saving ? '…' : (
                  <><Save style={{ width: 16, height: 16, display: 'inline', verticalAlign: -3, marginRight: 6 }} />Sauvegarder brouillon</>
                )}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                style={{
                  flex: 2, padding: '14px 0', borderRadius: 999, border: 'none',
                  background: 'var(--ap-brand)', color: '#fff',
                  fontFamily: 'var(--ap-font-body)', fontWeight: 800, fontSize: 15,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 0 var(--ap-brand-deep)',
                  opacity: saving ? .6 : 1,
                }}
              >
                {saving ? '…' : saved?.status === 'draft' ? (
                  <><Rocket style={{ width: 16, height: 16, display: 'inline', verticalAlign: -3, marginRight: 6 }} />Publier l'examen</>
                ) : (
                  <><Save style={{ width: 16, height: 16, display: 'inline', verticalAlign: -3, marginRight: 6 }} />Mettre à jour</>
                )}
              </button>
            </>
          )}
        </div>
          </main>
        </div>
      </div>
    </div>
  );
}
