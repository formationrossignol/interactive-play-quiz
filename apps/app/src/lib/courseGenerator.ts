import { createCourse, genId } from './courseStorage';
import { saveQuiz } from './quizStorage';
import { supabase } from './supabase';

/* ─── Types internes ─────────────────────────────────────────── */
interface GenQuestion {
  question: string;
  type: 'single-choice' | 'true-false' | 'short-answer';
  answers?: string[];
  correctAnswer: number | string;
  points?: number;
  timeLimit?: number;
}

interface GenLesson {
  title: string;
  content: string;
  estimated_minutes?: number;
}

interface GenModule {
  title: string;
  pedagogical_objective: string;
  duration_minutes?: number;
  lessons: GenLesson[];
  quiz: {
    title: string;
    questions: GenQuestion[];
  };
}

interface GenCourse {
  title: string;
  description: string;
  prerequisites?: string;
  target_audience?: string;
  total_hours?: number;
  category?: string;
  modules: GenModule[];
}

/* ─── Lecture de fichier ─────────────────────────────────────── */
async function buildMessageContent(file: File): Promise<object[]> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx');

  if (isPdf) {
    const base64 = await fileToBase64(file);
    return [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }];
  }

  if (isDocx) {
    // Dynamic import — only loaded when needed
    const mammoth = await import('mammoth');
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return [{ type: 'text', text: value }];
  }

  // TXT, MD, tout autre texte
  const text = await file.text();
  return [{ type: 'text', text }];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// The Qualiopi system/user prompts now live server-side in
// supabase/functions/generate-course — the client only ever sends the
// parsed source document, never a prompt the caller could tamper with.

/* ─── Parsing ────────────────────────────────────────────────── */
function parseResponse(text: string): GenCourse {
  // Extraire le premier bloc JSON complet
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse IA invalide — aucun JSON trouvé');
  try {
    return JSON.parse(match[0]) as GenCourse;
  } catch (e) {
    throw new Error('Erreur de parsing JSON : ' + (e as Error).message);
  }
}

/* ─── Construction & sauvegarde ─────────────────────────────── */
function buildAndSave(gen: GenCourse): string {
  const modules = gen.modules.map((m) => {
    // Créer le quiz lié
    const quiz = saveQuiz({
      title: m.quiz.title,
      description: `Quiz de validation — ${m.title}\n\nObjectif : ${m.pedagogical_objective}`,
      questions: m.quiz.questions.map((q) => ({
        id: genId(),
        type: q.type,
        question: q.question,
        answers: q.answers ?? ['Vrai', 'Faux'],
        correctAnswer: q.correctAnswer,
        points: q.points ?? 100,
        timeLimit: q.timeLimit ?? 30,
      })),
      isPublic: false,
      isFavorite: false,
      tags: [],
      type: 'quiz',
      category: 'Formation',
      speedBonus: true,
      transitionTime: 5,
    });

    // Leçons de contenu + leçon quiz finale
    const lessons = [
      ...m.lessons.map((l) => ({
        id: genId(),
        title: l.title,
        type: 'text' as const,
        content: l.content,
        estimatedMinutes: l.estimated_minutes ?? 20,
      })),
      {
        id: genId(),
        title: m.quiz.title,
        type: 'quiz' as const,
        content: '',
        linkedItemId: quiz.id,
        estimatedMinutes: Math.ceil(m.quiz.questions.length * 1.5),
      },
    ];

    return { id: genId(), title: m.title, lessons };
  });

  const descParts = [gen.description];
  if (gen.prerequisites) descParts.push(`\n\n**Prérequis :** ${gen.prerequisites}`);
  if (gen.target_audience) descParts.push(`\n**Public cible :** ${gen.target_audience}`);

  const course = createCourse({
    title: gen.title,
    description: descParts.join(''),
    modules,
    isPublic: false,
    isFavorite: false,
    category: gen.category ?? 'Formation',
    tags: [],
    generatedByAI: true,
  });

  return course.id;
}

/* ─── Point d'entrée public ──────────────────────────────────── */
export async function generateCourseFromFile(
  file: File,
  onProgress: (msg: string) => void,
): Promise<string> {
  onProgress('Lecture du fichier…');
  const content = await buildMessageContent(file);

  onProgress('Analyse du contenu avec l\'IA…');
  const { data, error } = await supabase.functions.invoke<{ text: string }>('generate-course', {
    body: { content, filename: file.name },
  });
  if (error) {
    let message = 'Erreur lors de la génération du cours';
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const body = await ctx.json() as { error?: string };
        if (body?.error) message = body.error;
      } catch { /* response body wasn't JSON — keep the generic message */ }
    }
    throw new Error(message);
  }
  const text = data?.text ?? '';

  onProgress('Structuration du cours Qualiopi…');
  const gen = parseResponse(text);

  onProgress('Création des quiz de validation…');
  return buildAndSave(gen);
}
