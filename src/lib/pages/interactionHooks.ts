import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  castVote, removeVote, submitIdea,
  isSubscribed, subscribe, unsubscribe,
  submitReport, fetchMyReports, submitReview,
} from './interactionsRepo';
import type { NewReport, NewReview } from './types';

export function useVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, voted }: { itemId: string; voted: boolean }) =>
      voted ? removeVote(itemId) : castVote(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pages', 'roadmap'] }),
  });
}

export function useSubmitIdea() {
  return useMutation({ mutationFn: (text: string) => submitIdea(text) });
}

export function useChangelogSubscription() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['pages', 'subscription'], queryFn: isSubscribed });
  const toggle = useMutation({
    mutationFn: (subscribed: boolean) => (subscribed ? unsubscribe() : subscribe()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pages', 'subscription'] }),
  });
  return { isSubscribed: !!query.data, isLoading: query.isLoading, toggle };
}

export function useMyReports() {
  return useQuery({ queryKey: ['pages', 'my-reports'], queryFn: fetchMyReports });
}

export function useSubmitReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewReport) => submitReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pages', 'my-reports'] }),
  });
}

export function useSubmitReview() {
  return useMutation({ mutationFn: (input: NewReview) => submitReview(input) });
}
