import jsYaml from 'js-yaml';
import type { SavedQuiz } from './quizStorage';

export type ImportDraft = Omit<SavedQuiz, 'id' | 'createdAt' | 'userId'>;

// ── Helpers ────────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function parseScalar(v: unknown): string | number | boolean | unknown {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v);
  return v;
}

function normalizeTrueFalseAnswer(val: unknown): unknown {
  if (val === true || val === 'true') return 'true';
  if (val === false || val === 'false') return 'false';
  return val;
}

function mapYamlQuestion(q: any, idx: number): any {
  const type = q.type || 'multiple-choice';
  const rawAnswer = q.correctAnswer !== undefined ? q.correctAnswer : (q.correct_answer !== undefined ? q.correct_answer : 0);
  const correctAnswer = type === 'true-false' ? normalizeTrueFalseAnswer(rawAnswer) : rawAnswer;
  const answers = Array.isArray(q.answers) ? q.answers : (type === 'true-false' ? ['Vrai', 'Faux'] : []);
  return {
    id: `imported-${Date.now()}-${idx}`,
    type,
    question: q.question || '',
    answers,
    correctAnswer,
    timeLimit: q.timeLimit ?? q.time_limit ?? 30,
    points: q.points ?? 100,
    scale: Array.isArray(q.scale) ? q.scale : [],
    items: Array.isArray(q.items) ? q.items : [],
    maxLength: q.maxLength ?? undefined,
    maxStars: q.maxStars ?? undefined,
    minLabel: q.minLabel ?? undefined,
    maxLabel: q.maxLabel ?? undefined,
  };
}

function baseDraft(overrides: Partial<ImportDraft> = {}): ImportDraft {
  return {
    title: 'Importé',
    description: '',
    questions: [],
    isPublic: false,
    isFavorite: false,
    tags: [],
    speedBonus: true,
    transitionTime: 5,
    category: 'Autre',
    type: 'quiz',
    ...overrides,
  };
}

// ── Quiz / Poll YAML ────────────────────────────────────────────────────────

export function parseQuizYaml(content: string, forceType?: 'quiz' | 'poll'): ImportDraft {
  const data = jsYaml.load(content, { schema: jsYaml.JSON_SCHEMA }) as any;
  if (!data || typeof data !== 'object') throw new Error('Invalid YAML');

  const type: 'quiz' | 'poll' = forceType ?? (data.type === 'poll' ? 'poll' : 'quiz');
  const questions = Array.isArray(data.questions)
    ? data.questions.map(mapYamlQuestion)
    : [];

  return baseDraft({
    title: data.title || (type === 'poll' ? 'Sondage importé' : 'Quiz importé'),
    description: data.description || '',
    category: data.category || 'Autre',
    tags: Array.isArray(data.tags) ? data.tags : [],
    questions,
    type,
  });
}

// ── Quiz CSV ────────────────────────────────────────────────────────────────

export function parseQuizCsv(content: string, forceType: 'quiz' | 'poll' = 'quiz'): ImportDraft {
  const lines = content.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV vide');

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));

  const questions = lines.slice(1).map((line, i) => {
    const vals = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, hi) => { row[h] = vals[hi] ?? ''; });

    const qType = row.type || (forceType === 'poll' ? 'single-choice' : 'multiple-choice');

    // Collect answer / option columns
    const answerKeys = ['answer1','answer2','answer3','answer4','option1','option2','option3','option4','option5'];
    const answers = qType === 'true-false'
      ? ['Vrai', 'Faux']
      : answerKeys.map(k => row[k]).filter(Boolean);

    let correctAnswer: string | number | boolean = row.correctanswer || row.correct || '0';
    if (qType === 'true-false') {
      correctAnswer = correctAnswer === 'false' ? 'false' : 'true';
    } else if (!isNaN(Number(correctAnswer as string))) {
      correctAnswer = parseInt(correctAnswer as string);
    }

    const timeLimit = parseInt(row.timelimit || row.time || '30') || 30;
    const points = parseInt(row.points || '100') || 100;

    return {
      id: `imported-${Date.now()}-${i}`,
      type: qType,
      question: row.question || '',
      answers,
      correctAnswer,
      timeLimit,
      points,
      scale: qType === 'likert-scale' || qType === 'frequency-scale' ? answers : [],
    };
  });

  return baseDraft({
    title: forceType === 'poll' ? 'Sondage importé' : 'Quiz importé',
    questions,
    type: forceType,
  });
}

// ── Flashcard Markdown ──────────────────────────────────────────────────────
// Format:
// # Titre
//
// Q: Recto de la carte
// R: Verso de la carte
//
// Q: ...
// R: ...

export function parseFlashcardMarkdown(content: string): ImportDraft {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Flashcards importées';

  const cards: any[] = [];
  // Match Q: ... R: ... pairs (multiline recto/verso supported)
  const pattern = /Q:\s*(.+?)[\r\n]+R:\s*(.+?)(?=[\r\n]+Q:|[\r\n]*$)/gs;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = pattern.exec(content)) !== null) {
    cards.push({
      id: `imported-${Date.now()}-${idx++}`,
      type: 'flashcard',
      recto: m[1].trim(),
      verso: m[2].trim(),
    });
  }

  if (cards.length === 0) throw new Error('Aucune carte trouvée. Utilisez le format Q: / R:');

  return baseDraft({ title, questions: cards, type: 'flashcard' });
}

// ── Slide Markdown ──────────────────────────────────────────────────────────
// Format:
// # Titre de la présentation
//
// ---
//
// ## Titre slide 1
// Contenu...
//
// ---
//
// ## Titre slide 2
// Contenu...

export function parseSlideMarkdown(content: string): ImportDraft {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Présentation importée';

  const sections = content.split(/\n---\n/);
  const slides: any[] = [];

  sections.forEach((section, si) => {
    const trimmed = section.trim();
    if (!trimmed) return;
    // Skip first section if it's only the main title
    if (si === 0 && /^#\s/.test(trimmed) && trimmed.split('\n').filter(l => l.trim()).length <= 1) return;

    const slideTitleMatch = trimmed.match(/^##\s+(.+)$/m);
    const slideTitle = slideTitleMatch ? slideTitleMatch[1].trim() : `Slide ${slides.length + 1}`;
    const contentAfterTitle = trimmed.replace(/^##\s+.+$/m, '').trim();

    slides.push({
      id: `imported-${Date.now()}-${si}`,
      type: 'slide',
      title: slideTitle,
      content: contentAfterTitle,
    });
  });

  if (slides.length === 0) throw new Error('Aucune diapositive trouvée. Utilisez --- pour séparer les slides.');

  return baseDraft({ title, questions: slides, type: 'slide' });
}
