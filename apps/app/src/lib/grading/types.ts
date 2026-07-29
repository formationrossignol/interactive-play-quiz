export type GradingType = "numeric" | "validation";
export type RoundingRule = "none" | "tenth" | "half" | "integer";
export type GradeWorkflowStatus = "draft" | "published";
export type ValidationValue = "validated" | "not_validated" | "review" | "not_evaluated";
export type AttendanceStatus =
  | "present"
  | "absent"
  | "absent_excused"
  | "absent_unexcused"
  | "not_submitted"
  | "exempt"
  | "not_evaluated";

export interface ManualEvaluation {
  id: string;
  owner_id: string;
  content_id: string | null;
  name: string;
  description: string;
  context_label: string;
  grading_type: GradingType;
  minimum_score: number;
  maximum_score: number;
  decimal_places: number;
  pass_threshold: number | null;
  coefficient: number;
  rounding_rule: RoundingRule;
  validation_labels: string[];
  evaluation_date: string;
  entry_deadline: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  groupIds: string[];
}

export interface ManualGrade {
  id: string;
  evaluation_id: string;
  learner_id: string;
  score: number | null;
  validation_value: ValidationValue | null;
  attendance_status: AttendanceStatus;
  appreciation: string;
  workflow_status: GradeWorkflowStatus;
  published_at: string | null;
  locked_at: string | null;
  version: number;
  last_edited_by: string;
  last_change_reason: string;
  created_at: string;
  updated_at: string;
}

export interface ManualGradeHistory {
  id: number;
  grade_id: string;
  evaluation_id: string;
  learner_id: string;
  changed_by: string;
  reason: string;
  old_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  changed_at: string;
}

export interface RosterMember {
  userId: string;
  username: string;
  groupIds: string[];
}

export interface GradeableContent {
  id: string;
  type: string;
  title: string;
}

export interface CreateManualEvaluationInput {
  name: string;
  description: string;
  contextLabel: string;
  contentId: string | null;
  gradingType: GradingType;
  minimumScore: number;
  maximumScore: number;
  decimalPlaces: number;
  passThreshold: number | null;
  coefficient: number;
  roundingRule: RoundingRule;
  evaluationDate: string;
  entryDeadline: string | null;
  groupIds: string[];
}

export interface SaveManualGradeInput {
  evaluationId: string;
  learnerId: string;
  score: number | null;
  validationValue: ValidationValue | null;
  attendanceStatus: AttendanceStatus;
  appreciation: string;
  workflowStatus: GradeWorkflowStatus;
  expectedVersion: number;
  changeReason?: string;
}

export interface PublishedGrade extends ManualGrade {
  evaluation: ManualEvaluation;
}
