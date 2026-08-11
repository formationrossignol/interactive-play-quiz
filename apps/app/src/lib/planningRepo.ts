import { supabase } from './supabase';

export type PlanningEventKind = 'quiz' | 'course' | 'exam' | 'meeting';

export interface PlanningEvent {
  id: string;
  user_id: string;
  title: string;
  kind: PlanningEventKind;
  starts_at: string;
  ends_at: string;
}

export async function listMyPlanningEvents(): Promise<PlanningEvent[]> {
  const { data, error } = await supabase.from('planning_events').select('*').order('starts_at');
  if (error) throw error;
  return (data ?? []) as PlanningEvent[];
}

export async function createPlanningEvent(input: {
  title: string; kind: PlanningEventKind; startsAt: string; endsAt: string;
}): Promise<PlanningEvent> {
  const { data, error } = await supabase.from('planning_events').insert({
    title: input.title, kind: input.kind, starts_at: input.startsAt, ends_at: input.endsAt,
  }).select().single();
  if (error) throw error;
  return data as PlanningEvent;
}

export async function updatePlanningEvent(id: string, input: {
  title: string; kind: PlanningEventKind; startsAt: string; endsAt: string;
}): Promise<PlanningEvent> {
  const { data, error } = await supabase.from('planning_events').update({
    title: input.title, kind: input.kind, starts_at: input.startsAt, ends_at: input.endsAt,
  }).eq('id', id).select().single();
  if (error) throw error;
  return data as PlanningEvent;
}

export async function deletePlanningEvent(id: string): Promise<void> {
  const { error } = await supabase.from('planning_events').delete().eq('id', id);
  if (error) throw error;
}
