import { supabase } from "@/lib/supabase";
import { usernamesByIds } from "@/lib/sharing/sharingRepo";
import type {
  CreateManualEvaluationInput,
  GradeableContent,
  ManualEvaluation,
  ManualGrade,
  ManualGradeHistory,
  PublishedGrade,
  RosterMember,
  SaveManualGradeInput,
} from "./types";

interface EvaluationRow extends Omit<ManualEvaluation, "groupIds" | "validation_labels"> {
  validation_labels: string[];
  manual_evaluation_groups?: Array<{ group_id: string }> | null;
}

function mapEvaluation(row: EvaluationRow): ManualEvaluation {
  return {
    ...row,
    groupIds: (row.manual_evaluation_groups ?? []).map((item) => item.group_id),
  };
}

const EVALUATION_SELECT = `
  id,
  owner_id,
  content_id,
  name,
  description,
  context_label,
  grading_type,
  minimum_score,
  maximum_score,
  decimal_places,
  pass_threshold,
  coefficient,
  rounding_rule,
  validation_labels,
  evaluation_date,
  entry_deadline,
  archived_at,
  created_at,
  updated_at,
  manual_evaluation_groups(group_id)
`;

export async function listOwnedManualEvaluations(ownerId: string): Promise<ManualEvaluation[]> {
  const { data, error } = await supabase
    .from("manual_evaluations")
    .select(EVALUATION_SELECT)
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .order("evaluation_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as EvaluationRow[]).map(mapEvaluation);
}

export async function listOwnedGradeableContent(ownerId: string): Promise<GradeableContent[]> {
  const { data, error } = await supabase
    .from("content")
    .select("id, type, data")
    .eq("user_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: { id: string; type: string; data: Record<string, unknown> }) => ({
    id: row.id,
    type: row.type,
    title: typeof row.data?.title === "string" ? row.data.title : "Contenu sans titre",
  }));
}

export async function createManualEvaluation(input: CreateManualEvaluationInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_manual_evaluation", {
    p_name: input.name,
    p_description: input.description,
    p_context_label: input.contextLabel,
    p_content_id: input.contentId,
    p_grading_type: input.gradingType,
    p_minimum_score: input.minimumScore,
    p_maximum_score: input.maximumScore,
    p_decimal_places: input.decimalPlaces,
    p_pass_threshold: input.passThreshold,
    p_coefficient: input.coefficient,
    p_rounding_rule: input.roundingRule,
    p_evaluation_date: input.evaluationDate,
    p_entry_deadline: input.entryDeadline,
    p_group_ids: input.groupIds,
  });
  if (error) throw error;
  return data as string;
}

export async function listEvaluationRoster(groupIds: string[]): Promise<RosterMember[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, user_id")
    .in("group_id", groupIds)
    .not("user_id", "is", null);
  if (error) throw error;

  const groupsByUser = new Map<string, Set<string>>();
  (data ?? []).forEach(({ group_id, user_id }: { group_id: string; user_id: string | null }) => {
    if (!user_id) return;
    const memberships = groupsByUser.get(user_id) ?? new Set<string>();
    memberships.add(group_id);
    groupsByUser.set(user_id, memberships);
  });

  const identities = await usernamesByIds([...groupsByUser.keys()]);
  const usernameById = new Map(identities.map((identity) => [identity.id, identity.username]));
  return [...groupsByUser.entries()]
    .map(([userId, memberships]) => ({
      userId,
      username: usernameById.get(userId) ?? "Apprenant",
      groupIds: [...memberships],
    }))
    .sort((a, b) => a.username.localeCompare(b.username, "fr"));
}

export async function listManualGrades(evaluationId: string): Promise<ManualGrade[]> {
  const { data, error } = await supabase
    .from("manual_grades")
    .select("*")
    .eq("evaluation_id", evaluationId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveManualGrade(input: SaveManualGradeInput): Promise<ManualGrade> {
  const { data, error } = await supabase.rpc("save_manual_grade", {
    p_evaluation_id: input.evaluationId,
    p_learner_id: input.learnerId,
    p_score: input.score,
    p_validation_value: input.validationValue,
    p_attendance_status: input.attendanceStatus,
    p_appreciation: input.appreciation,
    p_workflow_status: input.workflowStatus,
    p_expected_version: input.expectedVersion,
    p_change_reason: input.changeReason ?? "",
  });
  if (error) throw error;
  return data as ManualGrade;
}

export async function publishManualGrades(evaluationId: string): Promise<number> {
  const { data, error } = await supabase.rpc("publish_manual_grades", {
    p_evaluation_id: evaluationId,
  });
  if (error) throw error;
  return data as number;
}

export async function listManualGradeHistory(gradeId: string): Promise<ManualGradeHistory[]> {
  const { data, error } = await supabase
    .from("manual_grade_history")
    .select("*")
    .eq("grade_id", gradeId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

interface PublishedGradeRow extends ManualGrade {
  manual_evaluations: EvaluationRow;
}

export async function listMyPublishedGrades(learnerId: string): Promise<PublishedGrade[]> {
  const { data, error } = await supabase
    .from("manual_grades")
    .select(`
      *,
      manual_evaluations(
        id,
        owner_id,
        content_id,
        name,
        description,
        context_label,
        grading_type,
        minimum_score,
        maximum_score,
        decimal_places,
        pass_threshold,
        coefficient,
        rounding_rule,
        validation_labels,
        evaluation_date,
        entry_deadline,
        archived_at,
        created_at,
        updated_at
      )
    `)
    .eq("learner_id", learnerId)
    .eq("workflow_status", "published")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PublishedGradeRow[]).map(({ manual_evaluations, ...grade }) => ({
    ...grade,
    evaluation: mapEvaluation({ ...manual_evaluations, manual_evaluation_groups: [] }),
  }));
}
