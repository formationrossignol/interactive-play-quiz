import { supabase } from "@/lib/supabase";

export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  playedAt: string;
}

interface QuizAttemptRow {
  id: string;
  user_id: string;
  quiz_id: string;
  quiz_title: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  played_at: string;
}

const fromRow = (row: QuizAttemptRow): QuizAttempt => ({
  id: row.id,
  userId: row.user_id,
  quizId: row.quiz_id,
  quizTitle: row.quiz_title,
  score: row.score,
  totalQuestions: row.total_questions,
  correctAnswers: row.correct_answers,
  playedAt: row.played_at,
});

export async function recordQuizAttempt(attempt: {
  userId: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
}): Promise<void> {
  const { error } = await supabase.from("quiz_attempts").insert({
    user_id: attempt.userId,
    quiz_id: attempt.quizId,
    quiz_title: attempt.quizTitle,
    score: attempt.score,
    total_questions: attempt.totalQuestions,
    correct_answers: attempt.correctAnswers,
  });
  if (error) throw error;
}

export async function listQuizAttempts(userId: string, limit = 100): Promise<QuizAttempt[]> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("id,user_id,quiz_id,quiz_title,score,total_questions,correct_answers,played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as QuizAttemptRow[]).map(fromRow);
}
