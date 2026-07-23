import { createCourse, genId } from './courseStorage';
import { saveQuiz } from './quizStorage';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

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

/* ─── Prompt système Qualiopi ────────────────────────────────── */
const SYSTEM_PROMPT = `Tu es un expert en ingénierie pédagogique certifié Qualiopi (Référentiel National Qualité, décret du 6 juin 2019). Tu concevoir des formations professionnelles rigoureuses et conformes aux exigences du référentiel.

Exigences Qualiopi à respecter :
— Objectifs pédagogiques rédigés avec des verbes opérationnels de la taxonomie de Bloom (identifier, analyser, évaluer, concevoir, distinguer, appliquer, démontrer…)
— Progression pédagogique logique : du simple vers le complexe, des savoirs vers les savoir-faire
— Contenus structurés : théorie, exemples concrets, points-clés mémorisables
— Évaluation des acquis en fin de chaque module (quiz de validation des compétences)
— Durées réalistes et formatées : 15–30 min par leçon de lecture, 45–90 min par module

Règles impératives de génération :
— Réponds UNIQUEMENT avec du JSON valide, aucun texte avant ou après
— Le champ "content" de chaque leçon doit être du HTML riche :
  • <p>paragraphes</p>
  • <h2>sous-titres de section</h2>
  • <strong>termes clés en gras</strong>
  • <code>éléments techniques</code>
  • <div class="keypoint">💡 Point clé à retenir</div> pour les éléments cruciaux
— Les quiz doivent comporter 5 à 8 questions par module
— Types de questions autorisés : "single-choice" (avec 4 réponses) et "true-false"
— correctAnswer = index 0-based pour single-choice, "true" ou "false" pour true-false
— Maximum 4 modules, maximum 3 leçons de contenu par module (hors quiz)
— Génère du contenu pédagogique substantiel (pas de placeholders)`;

function buildUserPrompt(filename: string): string {
  return `Analyse le document "${filename}" fourni ci-dessus et génère un cours professionnel complet, conforme Qualiopi.

Réponds UNIQUEMENT avec ce JSON (aucun texte avant ou après) :

{
  "title": "Titre du cours",
  "description": "Description concise du cours en 2-3 phrases",
  "prerequisites": "Prérequis nécessaires (connaissances, expérience, équipements)",
  "target_audience": "Public cible de la formation",
  "total_hours": 4,
  "category": "Catégorie (ex: Informatique, Management, Sécurité…)",
  "modules": [
    {
      "title": "Titre du module 1",
      "pedagogical_objective": "À l'issue de ce module, le stagiaire sera capable de [verbe Bloom] [compétence observable et mesurable]",
      "duration_minutes": 60,
      "lessons": [
        {
          "title": "Titre de la leçon",
          "estimated_minutes": 20,
          "content": "<p>Contenu HTML substantiel...</p><h2>Section</h2><p>Suite...</p><div class=\\"keypoint\\">💡 Point clé</div>"
        }
      ],
      "quiz": {
        "title": "Évaluation — Module 1",
        "questions": [
          {
            "question": "Question de validation ?",
            "type": "single-choice",
            "answers": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": 0,
            "points": 100,
            "timeLimit": 30
          },
          {
            "question": "Affirmation vraie ou fausse ?",
            "type": "true-false",
            "answers": ["Vrai", "Faux"],
            "correctAnswer": "true",
            "points": 100,
            "timeLimit": 20
          }
        ]
      }
    }
  ]
}`;
}

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
  });

  return course.id;
}

/* ─── Point d'entrée public ──────────────────────────────────── */
export async function generateCourseFromFile(
  file: File,
  apiKey: string,
  onProgress: (msg: string) => void,
): Promise<string> {
  onProgress('Lecture du fichier…');
  const content = await buildMessageContent(file);

  onProgress('Analyse du contenu avec l\'IA…');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [...content, { type: 'text', text: buildUserPrompt(file.name) }],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Erreur API (${res.status}) : ${err}`);
  }

  const data = await res.json() as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text ?? '';

  onProgress('Structuration du cours Qualiopi…');
  const gen = parseResponse(text);

  onProgress('Création des quiz de validation…');
  return buildAndSave(gen);
}
